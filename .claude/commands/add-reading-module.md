# add-reading-module

## Mục đích
Scaffold đầy đủ một reading module mới (ví dụ: "career", "health", "yearly_horoscope"). Bao gồm: route + middleware chain (verifyToken + requireCredits), controller với credit deduction logic, AI prompt template (free teaser + paid full), TypeScript types, và đăng ký vào app.ts.

## Cách dùng
`/add-reading-module <module_name> <display_name> <credits_cost>`

Ví dụ:
- `/add-reading-module career "Tử vi nghề nghiệp" 1`
- `/add-reading-module health "Sức khoẻ & vận mệnh" 1`
- `/add-reading-module yearly "Tử vi năm 2026" 1`

## Các bước thực hiện

### Bước 1 — Cập nhật ENUM trong DB

Kiểm tra `readings.module` ENUM và `ai_prompts.module` ENUM. Nếu module mới chưa có trong ENUM, cần tạo migration ALTER TABLE:

```sql
-- migrations/0NN_add_<module>_to_readings_module.sql

ALTER TABLE readings
  MODIFY COLUMN module
    ENUM('numerology','love','finance','sim','fengshui_home','horoscope','<new_module>')
    NOT NULL;

ALTER TABLE ai_prompts
  MODIFY COLUMN module
    ENUM('numerology','love','finance','sim','fengshui_home','horoscope','<new_module>')
    NOT NULL;
```

### Bước 2 — Cập nhật TypeScript types

Cập nhật `src/types/reading.types.ts`:

```typescript
// Thêm module mới vào union type
export type ReadingModule =
  | 'numerology'
  | 'love'
  | 'finance'
  | 'sim'
  | 'fengshui_home'
  | 'horoscope'
  | '<new_module>'  // THÊM VÀO ĐÂY

// Request type cho module mới
export interface <ModuleName>ReadingRequest {
  full_name: string           // Họ tên người dùng (bắt buộc)
  birth_date: string          // "YYYY-MM-DD" (bắt buộc)
  // Thêm các fields đặc thù của module:
  // career_field?: string    // Ví dụ: lĩnh vực nghề nghiệp
  // birth_time?: string      // Giờ sinh (nếu cần)
}

// Response type (phần AI trả về sau parse)
export interface <ModuleName>ReadingResult {
  summary: string
  sections: {
    // Định nghĩa các section của module này
    overview: {
      visible: boolean
      content?: {
        title: string
        description: string
      }
      teaser?: string         // Hiển thị cho free tier
      locked?: boolean
    }
    // ... các sections khác
  }
  lucky_numbers?: number[]
  lucky_colors?: string[]
  recommendations?: string[]
}

// Reading record lưu vào DB
export interface <ModuleName>Reading {
  reading_id: number
  module: '<new_module>'
  tier: 'free' | 'paid'
  result: <ModuleName>ReadingResult
  credits_used: number
  credits_remaining: number
  ai_model_used: string
}
```

### Bước 3 — Tạo validator

Tạo `src/middleware/validators/<module>.validator.ts`:

```typescript
import { body } from 'express-validator'

export const validate<ModuleName>Reading = [
  body('full_name')
    .trim()
    .notEmpty().withMessage('Họ tên không được để trống')
    .isLength({ min: 2, max: 100 }).withMessage('Họ tên từ 2 đến 100 ký tự'),

  body('birth_date')
    .trim()
    .notEmpty().withMessage('Ngày sinh không được để trống')
    .isISO8601().withMessage('Ngày sinh phải đúng định dạng YYYY-MM-DD')
    .custom((value: string) => {
      const date = new Date(value)
      const now = new Date()
      if (date >= now) throw new Error('Ngày sinh phải là ngày trong quá khứ')
      const minYear = 1900
      if (date.getFullYear() < minYear) throw new Error(`Năm sinh phải từ ${minYear} trở đi`)
      return true
    }),

  // Thêm validators cho các fields đặc thù:
  // body('career_field').optional().trim().isLength({ max: 100 }),
]
```

### Bước 4 — Tạo service method

Thêm method vào `src/services/reading.service.ts` hoặc tạo `src/services/<module>.service.ts`:

```typescript
import { pool } from '@/config/database'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { AIService } from '@/services/ai.service'
import { UserModel } from '@/models/user.model'
import { logger } from '@/utils/logger'
import { <ModuleName>ReadingRequest, <ModuleName>Reading } from '@/types/reading.types'

export class <ModuleName>Service {

  static async generateReading(
    request: <ModuleName>ReadingRequest,
    userId: number,
    tier: 'free' | 'paid'
  ): Promise<<ModuleName>Reading> {

    // 1. Gọi AI (TRƯỚC khi trừ credit — nếu AI lỗi thì không mất credit)
    const aiResult = await AIService.call({
      module: '<new_module>',
      planLevel: tier,      // 'free' | 'paid' — map với ai_prompts.tier
      userData: {
        full_name:  request.full_name,
        birth_date: request.birth_date,
        // Thêm các field đặc thù:
        // career_field: request.career_field ?? '',
      },
    })

    // 2. Parse JSON từ AI response
    let parsedResult: <ModuleName>ReadingResult
    try {
      parsedResult = JSON.parse(aiResult.content) as <ModuleName>ReadingResult
    } catch {
      logger.error(`[<MODULE>_SERVICE] AI returned invalid JSON: ${aiResult.content.substring(0, 200)}`)
      throw new Error('AI trả về dữ liệu không hợp lệ, vui lòng thử lại')
    }

    // 3. Trừ credit (chỉ với paid tier, KHÔNG trừ free)
    let creditsRemaining = 0
    if (tier === 'paid') {
      creditsRemaining = await UserModel.deductCredit(userId)
    }

    // 4. Lưu reading vào DB
    const [readingResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO readings
         (user_id, module, input_data, result_data, ai_model_id, tokens_used,
          is_free, credits_used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        '<new_module>',
        JSON.stringify(request),           // input_data
        JSON.stringify(parsedResult),      // result_data
        aiResult.modelId,                  // ai_model_id
        aiResult.tokensUsed,               // tokens_used
        tier === 'free' ? 1 : 0,           // is_free
        tier === 'paid' ? 1 : 0,           // credits_used
      ]
    )

    const readingId = readingResult.insertId

    // 5. Ghi credit_usage_log (chỉ với paid tier)
    if (tier === 'paid') {
      await pool.execute(
        `INSERT INTO credit_usage_log
           (user_id, reading_id, module, credits_used, balance_after, created_at)
         VALUES (?, ?, ?, 1, ?, NOW())`,
        [userId, readingId, '<new_module>', creditsRemaining]
      )
    }

    logger.info(
      `[<MODULE>_SERVICE] Reading created: readingId=${readingId} userId=${userId} ` +
      `tier=${tier} tokens=${aiResult.tokensUsed}`
    )

    return {
      reading_id:        readingId,
      module:            '<new_module>',
      tier,
      result:            parsedResult,
      credits_used:      tier === 'paid' ? 1 : 0,
      credits_remaining: creditsRemaining,
      ai_model_used:     `model-${aiResult.modelId}`,
    }
  }

  // Lấy reading cũ từ history (KHÔNG tốn credit)
  static async getReadingById(readingId: number, userId: number): Promise<<ModuleName>Reading | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM readings
       WHERE id = ? AND user_id = ? AND module = '<new_module>'
       LIMIT 1`,
      [readingId, userId]
    )

    if (!rows.length) return null

    const row = rows[0] as {
      id: number
      module: string
      result_data: string
      is_free: number
      credits_used: number
      created_at: Date
    }

    return {
      reading_id:        row.id,
      module:            '<new_module>',
      tier:              row.is_free ? 'free' : 'paid',
      result:            JSON.parse(row.result_data) as <ModuleName>ReadingResult,
      credits_used:      row.credits_used,
      credits_remaining: 0, // không cần khi xem lại
      ai_model_used:     '',
    }
  }
}
```

### Bước 5 — Tạo controller

Tạo `src/controllers/<module>.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { <ModuleName>Service } from '@/services/<module>.service'
import { logger } from '@/utils/logger'
import { <ModuleName>ReadingRequest } from '@/types/reading.types'

// POST /readings/<module> — Tạo reading mới (tốn 1 credit)
export const create<ModuleName>Reading = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details: errors.array(),
      },
    })
    return
  }

  try {
    const userId  = req.user!.id
    const request = req.body as <ModuleName>ReadingRequest

    const reading = await <ModuleName>Service.generateReading(request, userId, 'paid')

    res.status(201).json({
      success: true,
      data:    reading,
      message: 'Đã tạo kết quả xem thành công',
    })
  } catch (error) {
    logger.error(`[<MODULE>_CONTROLLER] create<ModuleName>Reading error:`, error)

    // Handle known errors
    if (error instanceof Error && error.message.includes('credits')) {
      res.status(402).json({
        success: false,
        error: { code: 'NO_CREDITS', message: error.message },
      })
      return
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
      },
    })
  }
}

// GET /readings/<module>/:id — Xem lại reading cũ (KHÔNG tốn credit)
export const get<ModuleName>Reading = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId    = req.user!.id
    const readingId = Number(req.params.id)

    if (isNaN(readingId) || readingId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'ID không hợp lệ' },
      })
      return
    }

    const reading = await <ModuleName>Service.getReadingById(readingId, userId)

    if (!reading) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy kết quả xem' },
      })
      return
    }

    res.json({ success: true, data: reading })
  } catch (error) {
    logger.error(`[<MODULE>_CONTROLLER] get<ModuleName>Reading error:`, error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Đã có lỗi xảy ra' },
    })
  }
}
```

### Bước 6 — Tạo route file

Tạo `src/routes/<module>.routes.ts`:

```typescript
import { Router } from 'express'
import { verifyToken } from '@/middleware/auth.middleware'
import { requireCredits } from '@/middleware/checkCredits'
import { validate } from '@/middleware/validate'
import { validate<ModuleName>Reading } from '@/middleware/validators/<module>.validator'
import {
  create<ModuleName>Reading,
  get<ModuleName>Reading,
} from '@/controllers/<module>.controller'

const router = Router()

// POST /readings/<module>
// Middleware chain: verifyToken → requireCredits → validate → controller
// requireCredits kiểm tra credits_balance > 0 AND credits_expires_at > NOW()
router.post(
  '/',
  verifyToken,
  requireCredits,
  validate(validate<ModuleName>Reading),
  create<ModuleName>Reading
)

// GET /readings/<module>/:id — Xem lại (chỉ cần auth, không cần credits)
router.get(
  '/:id',
  verifyToken,
  get<ModuleName>Reading
)

export default router
```

### Bước 7 — Đăng ký route trong app.ts

Mở `src/app.ts` và thêm:

```typescript
import <module>Router from '@/routes/<module>.routes'

// Trong phần app.use routes (cùng nhóm với các reading routes khác):
app.use('/api/v1/readings/<module>', <module>Router)
```

### Bước 8 — Thêm AI prompt vào DB

Tạo migration seed hoặc insert trực tiếp vào `ai_prompts`:

```sql
-- migrations/0NN_seed_<module>_prompts.sql

INSERT INTO ai_prompts (module, tier, system_prompt, user_template, version, is_active, created_at)
VALUES
(
  '<new_module>',
  'free',
  -- system_prompt cho free tier (ngắn, teaser):
  'Bạn là chuyên gia phân tích <display_name> theo thần số học và phong thuỷ phương Đông.
Nhiệm vụ: Cung cấp phân tích NGẮN GỌN, súc tích về <display_name> dựa trên ngày sinh.
Phần free tier: Chỉ cung cấp tổng quan cơ bản và gợi mở, KHÔNG tiết lộ chi tiết sâu.
QUAN TRỌNG: Trả về JSON hợp lệ theo schema đã định.
Luôn kết thúc bằng gợi ý nâng cấp lên paid tier để xem phân tích đầy đủ.',

  -- user_template với {{placeholders}}:
  'Phân tích <display_name> tổng quan cho:
- Họ tên: {{full_name}}
- Ngày sinh: {{birth_date}}

Trả về JSON với cấu trúc:
{
  "summary": "Tổng quan ngắn 2-3 câu",
  "sections": {
    "overview": {
      "visible": true,
      "content": {
        "title": "Tiêu đề phần",
        "description": "Mô tả cơ bản (tối đa 200 từ)"
      },
      "teaser": "Gợi mở: Xem phân tích đầy đủ để biết thêm về..."
    }
  },
  "upsell_message": "Nâng cấp để xem toàn bộ phân tích <display_name> chuyên sâu"
}',

  1,  -- version
  1   -- is_active
),
(
  '<new_module>',
  'paid',
  -- system_prompt cho paid tier (đầy đủ, chuyên sâu):
  'Bạn là chuyên gia hàng đầu về <display_name> theo thần số học và phong thuỷ phương Đông.
Nhiệm vụ: Cung cấp phân tích CHI TIẾT, CHUYÊN SÂU, có giá trị thực tế cho người dùng.
Paid tier: Cung cấp đầy đủ tất cả sections, không giới hạn, không teaser.
QUAN TRỌNG: Trả về JSON hợp lệ theo schema đã định. Nội dung phải tối thiểu 500 từ.
Sử dụng ngôn ngữ chuyên nghiệp nhưng dễ hiểu, phù hợp văn hoá Việt Nam.',

  -- user_template chi tiết:
  'Phân tích <display_name> chuyên sâu cho:
- Họ tên: {{full_name}}
- Ngày sinh: {{birth_date}}

Trả về JSON với cấu trúc đầy đủ:
{
  "summary": "Tổng quan toàn diện 3-5 câu",
  "sections": {
    "overview": {
      "visible": true,
      "content": {
        "title": "Tổng quan <display_name>",
        "description": "Phân tích chi tiết..."
      }
    },
    "strengths": {
      "visible": true,
      "content": {
        "title": "Điểm mạnh",
        "items": ["item1", "item2", "item3"]
      }
    },
    "challenges": {
      "visible": true,
      "content": {
        "title": "Thách thức cần vượt qua",
        "items": ["item1", "item2"]
      }
    },
    "advice": {
      "visible": true,
      "content": {
        "title": "Lời khuyên",
        "description": "Lời khuyên cụ thể..."
      }
    }
  },
  "lucky_numbers": [1, 5, 8],
  "lucky_colors": ["đỏ", "vàng"],
  "recommendations": ["Gợi ý 1", "Gợi ý 2", "Gợi ý 3"]
}',

  1,  -- version
  1   -- is_active
);
```

## Convention & Rules

### Credit deduction flow (BẮT BUỘC)
```
1. verifyToken → xác thực user
2. requireCredits → kiểm tra credits đủ và chưa frozen (402 nếu không đủ)
3. Controller nhận request → validate input
4. Service gọi AI (TRƯỚC khi trừ credit!)
5. Nếu AI thành công → UserModel.deductCredit(userId)
6. Lưu readings record (is_free=0, credits_used=1)
7. Ghi credit_usage_log
8. Trả kết quả về client
```

**Lý do gọi AI trước khi trừ credit:** Nếu AI lỗi, user không bị mất credit oan.

### AI prompt conventions
- `tier: 'free'` → prompt ngắn, teaser, gợi ý nâng cấp
- `tier: 'paid'` → prompt đầy đủ, không giới hạn, không upsell
- `{{placeholder}}` → format cho user_template interpolation
- Luôn yêu cầu AI trả về JSON hợp lệ trong system_prompt
- System prompt phải đề cập: ngôn ngữ Việt Nam, văn hoá phương Đông

### Không cần tier khi xem lại history
- GET `/readings/<module>/:id` → chỉ cần `verifyToken`, không cần `requireCredits`
- Đọc từ `readings.result_data` trong DB, KHÔNG gọi AI lại

### Module name convention
- Lowercase, snake_case: `career`, `health`, `yearly_horoscope`
- Phải nhất quán giữa: URL path, DB ENUM, TypeScript type, file names

## Checklist sau khi hoàn thành

- [ ] Migration ALTER TABLE đã thêm module mới vào ENUM (readings + ai_prompts)
- [ ] TypeScript `ReadingModule` union type đã bao gồm module mới
- [ ] Validator đã có cho tất cả required fields
- [ ] Service gọi AI TRƯỚC khi deduct credit
- [ ] Service ghi `readings` record với đúng `is_free`, `credits_used`, `ai_model_id`
- [ ] Service ghi `credit_usage_log` (chỉ khi tier === 'paid')
- [ ] `UserModel.deductCredit()` được gọi đúng chỗ
- [ ] Controller có try/catch và log lỗi với `logger.error`
- [ ] Route chain: `verifyToken → requireCredits → validate → controller` cho POST
- [ ] Route chain: `verifyToken → controller` cho GET (xem lại)
- [ ] Route đã mount vào app.ts
- [ ] AI prompts đã insert vào DB cho cả `free` và `paid` tier
- [ ] Response KHÔNG chứa thông tin nhạy cảm
- [ ] Test thủ công: gọi endpoint với token hợp lệ và credits > 0
