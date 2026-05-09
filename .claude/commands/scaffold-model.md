# scaffold-model

## Mục đích
Scaffold một DB model file mới sử dụng raw SQL với mysql2 pool. Model bao gồm các method chuẩn: `findById`, `findAll` (có pagination), `create`, `update`, `softDelete` — tất cả đều typed với TypeScript.

## Cách dùng
`/scaffold-model <TableName> <description>`

Ví dụ:
- `/scaffold-model CreditPackage Gói lượt (credit packages)`
- `/scaffold-model AiPrompt Prompt AI theo module và tier`
- `/scaffold-model FreeUsageLog Log lượt miễn phí theo IP`

## Các bước thực hiện

### Bước 1 — Xác định table schema

Hỏi hoặc suy luận từ context:
1. Tên table trong DB (snake_case, plural): ví dụ `credit_packages`
2. Các columns và kiểu dữ liệu
3. Table có `is_active` (soft delete) không?
4. Table có `updated_at` không?
5. Foreign keys nào liên quan?

Tham chiếu các table đã có trong WORKFLOW.md:
- `users`: id, full_name, email, credits_balance, credits_expires_at, is_active, ...
- `credit_packages`: id, name, credits, price, validity_days, is_active, sort_order
- `credit_orders`: id, user_id, package_id, credits, amount, topup_code, status, ...
- `credit_usage_log`: id, user_id, reading_id, module, credits_used, balance_after
- `readings`: id, user_id, session_id, module, input_data, result_data, ai_model_id, tokens_used
- `ai_models`: id, name, provider, model_id, api_key_enc, is_active, is_default, priority
- `ai_prompts`: id, module, tier, system_prompt, user_template, version, is_active
- `refresh_tokens`: id, user_id, token_hash, expires_at
- `free_usage_log`: id, ip_address, session_id, used_at
- `site_settings`: key, value, type, description

### Bước 2 — Tạo TypeScript interface

Thêm vào `src/types/<module>.types.ts` (hoặc tạo mới nếu chưa có):

```typescript
// src/types/<module>.types.ts

// Đại diện cho 1 row trong DB — dùng BIGINT UNSIGNED → number trong TypeScript
export interface <TableName> {
  id: number
  // Thêm tất cả columns:
  name: string
  is_active: boolean          // TINYINT(1) → boolean
  created_at: Date | string   // DATETIME → Date
  updated_at?: Date | string  // nullable nếu ON UPDATE
}

// Dữ liệu để CREATE (omit id, created_at, updated_at)
export interface Create<TableName>Dto {
  name: string
  // ... các fields cần thiết khi tạo mới
}

// Dữ liệu để UPDATE (tất cả fields đều optional)
export interface Update<TableName>Dto {
  name?: string
  is_active?: boolean
  // ...
}

// Query options cho findAll
export interface <TableName>FindAllOptions {
  page?: number
  limit?: number
  search?: string
  is_active?: boolean
  // ... filter options khác
}
```

### Bước 3 — Tạo model file

Tạo `src/models/<tableName>.model.ts`:

```typescript
import { pool } from '@/config/database'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { logger } from '@/utils/logger'
import {
  <TableName>,
  Create<TableName>Dto,
  Update<TableName>Dto,
  <TableName>FindAllOptions,
} from '@/types/<module>.types'

export class <TableName>Model {

  // ─── findById ────────────────────────────────────────────────────
  static async findById(id: number): Promise<<TableName> | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM <table_name> WHERE id = ? LIMIT 1',
      [id]
    )
    return (rows[0] as <TableName>) ?? null
  }

  // ─── findAll với pagination ───────────────────────────────────────
  static async findAll(options: <TableName>FindAllOptions = {}): Promise<{
    items: <TableName>[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const {
      page  = 1,
      limit = 20,
      search,
      is_active,
    } = options

    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: unknown[]    = []

    // Dynamic WHERE clauses
    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
    if (is_active !== undefined) {
      conditions.push('is_active = ?')
      params.push(is_active ? 1 : 0)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM <table_name> ${where}`,
      params
    )
    const total = (countRows[0] as { total: number }).total

    // Fetch items
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM <table_name> ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return {
      items:      rows as <TableName>[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  // ─── create ──────────────────────────────────────────────────────
  static async create(dto: Create<TableName>Dto): Promise<<TableName>> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO <table_name> (col1, col2, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())`,
      [dto.col1, dto.col2]
    )

    const created = await this.findById(result.insertId)
    if (!created) throw new Error('Không thể tạo <TableName>')
    return created
  }

  // ─── update ──────────────────────────────────────────────────────
  static async update(id: number, dto: Update<TableName>Dto): Promise<boolean> {
    const setClauses: string[] = []
    const params: unknown[]    = []

    // Build dynamic SET — chỉ update các field được cung cấp
    if (dto.name !== undefined)      { setClauses.push('name = ?');      params.push(dto.name) }
    if (dto.is_active !== undefined) { setClauses.push('is_active = ?'); params.push(dto.is_active ? 1 : 0) }
    // Thêm các fields khác tương tự...

    if (setClauses.length === 0) return false

    setClauses.push('updated_at = NOW()')
    params.push(id)

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE <table_name> SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    )
    return result.affectedRows > 0
  }

  // ─── softDelete (nếu table có is_active) ─────────────────────────
  static async softDelete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE <table_name> SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [id]
    )
    return result.affectedRows > 0
  }

  // ─── hardDelete (dùng cẩn thận — chỉ cho admin hoặc cleanup jobs) ─
  static async hardDelete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM <table_name> WHERE id = ?',
      [id]
    )
    return result.affectedRows > 0
  }

  // ─── Các method đặc thù của table (thêm bên dưới) ────────────────
  // Ví dụ cho users:
  // static async findByEmail(email: string): Promise<User | null> { ... }
  // static async addCredits(userId: number, credits: number, expiresAt: Date): Promise<void> { ... }
}
```

### Bước 4 — Thêm method đặc thù (nếu cần)

Tuỳ theo table, thêm các method đặc biệt:

**Cho `users` table:**
```typescript
static async findByEmail(email: string): Promise<User | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
    [email]
  )
  return (rows[0] as User) ?? null
}

// Cộng credits (kể cả giải băng — KHÔNG reset existing balance)
static async addCredits(userId: number, credits: number, newExpiresAt: Date): Promise<void> {
  await pool.execute(
    `UPDATE users
     SET credits_balance   = credits_balance + ?,
         credits_expires_at = ?,
         updated_at         = NOW()
     WHERE id = ?`,
    [credits, newExpiresAt, userId]
  )
}

// Trừ 1 credit (sau khi AI thành công)
static async deductCredit(userId: number): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE users
     SET credits_balance = credits_balance - 1,
         updated_at = NOW()
     WHERE id = ? AND credits_balance > 0`,
    [userId]
  )
  if (result.affectedRows === 0) throw new Error('Không đủ credits')

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT credits_balance FROM users WHERE id = ?',
    [userId]
  )
  return (rows[0] as { credits_balance: number }).credits_balance
}
```

**Cho `credit_orders` table:**
```typescript
static async findByTopupCode(topupCode: string): Promise<CreditOrder | null> { ... }
static async findPendingByUser(userId: number): Promise<CreditOrder[]> { ... }
static async markAsPaid(orderId: number, txId: string): Promise<void> { ... }
static async incrementRetry(orderId: number): Promise<void> { ... }
```

**Cho `ai_models` table:**
```typescript
static async getActiveModels(): Promise<AiModel[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM ai_models WHERE is_active = 1 ORDER BY is_default DESC, priority ASC'
  )
  return rows as AiModel[]
}

static async incrementTokens(modelId: number, tokens: number): Promise<void> {
  await pool.execute(
    'UPDATE ai_models SET total_tokens = total_tokens + ?, updated_at = NOW() WHERE id = ?',
    [tokens, modelId]
  )
}
```

**Cho `ai_prompts` table:**
```typescript
static async getActive(module: string, tier: 'free' | 'paid'): Promise<AiPrompt | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ai_prompts
     WHERE module = ? AND tier = ? AND is_active = 1
     ORDER BY version DESC LIMIT 1`,
    [module, tier]
  )
  return (rows[0] as AiPrompt) ?? null
}
```

### Bước 5 — Export

Đảm bảo export đúng cách:
```typescript
// Ở cuối file (hoặc dùng named export class):
export { <TableName>Model }
// hoặc nếu có index:
// src/models/index.ts — thêm: export { <TableName>Model } from './<tableName>.model'
```

## Convention & Rules

### Kiểu dữ liệu mapping (MySQL → TypeScript)
| MySQL | TypeScript |
|---|---|
| `BIGINT UNSIGNED` | `number` |
| `INT UNSIGNED` | `number` |
| `VARCHAR`, `TEXT`, `LONGTEXT` | `string` |
| `TINYINT(1)` | `boolean` (khi đọc từ DB row có thể là `0/1`) |
| `DATETIME` | `Date \| string` |
| `DECIMAL` | `number` (dùng `Number()` khi đọc) |
| `JSON` | `Record<string, unknown>` hoặc interface cụ thể |
| `ENUM` | Union type: `'value1' \| 'value2'` |

### Parameterized queries (BẮT BUỘC)
```typescript
// ĐÚNG:
pool.execute('SELECT * WHERE id = ? AND status = ?', [id, status])

// SAI — KHÔNG BAO GIỜ:
pool.execute(`SELECT * WHERE id = ${id}`)
pool.query(`SELECT * WHERE status = '${status}'`)
```

### Pool import
```typescript
import { pool } from '@/config/database'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
```

### Naming conventions
- File: `src/models/<camelCase>.model.ts` → `user.model.ts`, `creditOrder.model.ts`
- Class: `<PascalCase>Model` → `UserModel`, `CreditOrderModel`
- Methods: camelCase → `findById`, `findAll`, `create`, `update`, `softDelete`
- Table names trong SQL: snake_case, plural → `credit_orders`, `ai_models`

### Soft delete vs hard delete
- Các table quan trọng (users, credit_packages, ai_models) → dùng `softDelete` (`is_active = 0`)
- Log tables (readings, credit_usage_log, free_usage_log) → KHÔNG delete, chỉ query
- refresh_tokens → `hardDelete` (xoá thật khi logout / expire)

### Pagination default
- `page` default = 1
- `limit` default = 20, max = 100 (validate ở controller/validator)
- `ORDER BY id DESC` trừ khi có lý do khác (ví dụ: `sort_order ASC` cho packages)

## Checklist sau khi hoàn thành

- [ ] TypeScript interface khớp với DB schema (đúng column names)
- [ ] Tất cả queries đều dùng parameterized (`?` placeholders)
- [ ] `findById` trả về `null` nếu không tìm thấy (không throw)
- [ ] `findAll` có pagination với `page`, `limit`, `total`, `totalPages`
- [ ] `create` trả về object đã tạo (gọi `findById(insertId)`)
- [ ] `update` trả về `boolean` (affectedRows > 0)
- [ ] `softDelete` cập nhật `is_active = 0` và `updated_at = NOW()`
- [ ] `TINYINT(1)` fields được xử lý đúng (0/1 → boolean khi cần)
- [ ] Không có `any` type — dùng `RowDataPacket[]` khi cast từ mysql2
- [ ] Export class đúng tên
- [ ] Import từ `@/config/database` (không phải relative path)
