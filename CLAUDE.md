# Fengshui Platform — API Backend

Express.js + TypeScript backend. Đọc file này trước khi viết bất kỳ code nào.

---

## Stack & Tools

- **Runtime**: Node.js 20, TypeScript (strict mode), tsx (dev), tsc (build → dist/)
- **Framework**: Express.js 4
- **Database**: MySQL 8 via `mysql2/promise` — **raw SQL, không dùng ORM**
- **Auth**: JWT cookie-based (httpOnly, sameSite: strict)
- **Payment**: Web2M QR polling (không có webhook)
- **Storage**: Cloudinary (images)
- **AI**: OpenAI / Anthropic / Gemini — multi-provider với fallback
- **Logger**: Winston (`src/utils/logger.ts`)
- **Validation**: express-validator
- **Path alias**: `@/` → `src/`

---

## Cấu trúc thư mục

```
src/
  types/           # interfaces, enums, express.d.ts
  config/          # database.ts, web2m.config.ts, cloudinary.ts, jwt.ts
  middleware/      # auth.middleware.ts, checkCredits.ts, rateLimit.ts, validate.ts, errorHandler.ts
  routes/          # *.routes.ts + admin/
  controllers/     # *.controller.ts + admin/
  services/        # ai.service.ts, web2m.service.ts, email.service.ts, cloudinary.service.ts
  models/          # *.model.ts  (raw SQL query helpers)
  utils/           # crypto.ts, response.ts, logger.ts, generateCode.ts
  app.ts           # Express setup, mount routes
server.ts          # entry point
migrations/        # 001_create_users.sql, 002_create_refresh_tokens.sql, ...
```

---

## Quy tắc bắt buộc khi viết code

### 1. Response format — LUÔN dùng helper từ `src/utils/response.ts`

```typescript
// Thành công
return res.json(success(data, 'Thông báo tùy chọn'))

// Lỗi — dùng next(err) để error handler xử lý
return next(createError('CREDIT_NOT_FOUND', 'Không tìm thấy', 404))
```

Format chuẩn:
```json
{ "success": true, "data": {}, "message": "..." }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

### 2. Database — raw SQL với mysql2

```typescript
import pool from '@/config/database'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

// SELECT
const [rows] = await pool.query<RowDataPacket[]>(
  'SELECT * FROM users WHERE id = ?',
  [id]
)
const user = rows[0] ?? null

// INSERT
const [result] = await pool.query<ResultSetHeader>(
  'INSERT INTO users (full_name, email) VALUES (?, ?)',
  [fullName, email]
)
return result.insertId
```

**KHÔNG dùng string concat SQL. LUÔN dùng `?` placeholder.**

### 3. Middleware chain cho route premium

```typescript
router.post('/readings/love',
  authRateLimit,          // rate limiter
  verifyToken,            // kiểm tra access_token cookie → req.user
  requireCredits,         // kiểm tra credits (active/frozen/empty) → 402 nếu không đủ
  validate(loveSchema),   // express-validator
  ReadingController.love  // controller
)
```

### 4. Trừ credit — CHỈ trừ SAU KHI AI thành công

```typescript
// controller pattern
const result = await AIService.call({ module: 'love', tier: 'paid', userData })
// AI xong mới trừ
await UserModel.deductCredit(userId)
await CreditUsageLogModel.create({ userId, module: 'love', creditsUsed: 1, ... })
await ReadingModel.create({ userId, module: 'love', creditsUsed: 1, ... })
```

### 5. Auth — cookie-based JWT

```typescript
// Set cookie khi login/refresh — KHÔNG trả token trong body
res.cookie('access_token', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000,
})
```

### 6. Mã hoá API key AI

```typescript
import { encrypt, decrypt } from '@/utils/crypto'
// Lưu vào DB: encrypt(apiKey)
// Dùng: decrypt(row.api_key_enc)
```

### 7. Error handling — dùng try/catch + next

```typescript
export const myController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ...
  } catch (err) {
    next(err) // errorHandler.ts xử lý
  }
}
```

### 8. Credits — 3 trạng thái

```typescript
function getCreditsStatus(balance: number, expiresAt: Date | null): 'active' | 'frozen' | 'empty' {
  if (balance <= 0) return 'empty'
  if (!expiresAt || new Date(expiresAt) < new Date()) return 'frozen'
  return 'active'
}
```

- **active** → cho dùng
- **frozen** → có lượt nhưng hết 50 ngày → 402 CREDITS_FROZEN
- **empty** → hết lượt → 402 NO_CREDITS

### 9. Web2M topup code

```typescript
// Format: TOPUP + yyyyMMdd + 8 hex chars
// Ví dụ: TOPUP2026050982A1B2C3
const TOPUP_REGEX = /TOPUP(\d{8})([A-Za-z0-9]{8,})/i
```

### 10. TypeScript — không dùng `any`

```typescript
// ĐÚNG
const user = req.user!  // đã augment express.d.ts
const rows = result as UserRow[]

// SAI
const data: any = ...
```

---

## Database Schema tóm tắt

| Bảng | Cột quan trọng |
|---|---|
| `users` | `credits_balance INT`, `credits_expires_at DATETIME`, `role ENUM('user','admin')` |
| `credit_packages` | `credits INT`, `price DECIMAL`, `validity_days INT DEFAULT 50` |
| `credit_orders` | `topup_code VARCHAR(100) UNIQUE`, `status ENUM('pending','paid','failed','expired')`, `credits INT` |
| `credit_usage_log` | `user_id`, `reading_id`, `module`, `credits_used INT DEFAULT 1`, `balance_after INT` |
| `readings` | `module ENUM(...)`, `is_free TINYINT(1)`, `credits_used INT`, `result_data LONGTEXT` |
| `ai_models` | `api_key_enc TEXT` (AES encrypted), `is_default`, `priority INT` |
| `ai_prompts` | `module`, `tier ENUM('free','paid')`, `system_prompt`, `user_template` |
| `refresh_tokens` | `token_hash VARCHAR(255)` (SHA-256 hash, không lưu plain text) |

---

## Khi viết tính năng mới

**Chỉ cần mô tả bằng ngôn ngữ tự nhiên**, Claude sẽ tự động theo convention trên.

Ví dụ:
- "Viết API endpoint lấy lịch sử tiêu lượt của user" → Claude tạo route + controller + model + types
- "Thêm module xem phong thuỷ nhà ở" → Claude tạo route + AI prompt + credit deduction
- "Fix bug Web2M không match topup code" → Claude check regex + amount + date logic

**Slash commands** (cho task phức tạp):
- `/scaffold-route` — scaffold route + controller + service + validator
- `/scaffold-model` — scaffold DB model file
- `/add-migration` — thêm SQL migration
- `/add-reading-module` — thêm module phong thuỷ đầy đủ
- `/debug-web2m` — debug thanh toán
- `/debug-ai` — debug AI service
- `/review-endpoint` — security review
- `/gen-types` — generate TypeScript types

---

## Môi trường

```env
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
ENCRYPTION_KEY                    # AES-256 cho API key
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
BANK_NAME, BANK_NUMBER, BANK_ACCOUNT_HOLDER, BANK_TOKEN
API_GET_QR, API_GET_TRANSACTION_V2
CREDIT_VALIDITY_DAYS=50
```

## Scripts

```bash
npm run dev        # tsx watch (hot reload)
npm run build      # tsc → dist/
npm run typecheck  # tsc --noEmit (không build)
npm run lint       # eslint src
npm test           # jest
```
