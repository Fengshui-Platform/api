# Fengshui Platform — API

Backend cho nền tảng xem bói / phong thuỷ AI. Express.js + TypeScript + MySQL.

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Runtime | Node.js 20, TypeScript (strict) |
| Framework | Express.js 4 |
| Database | MySQL 8 — raw SQL với `mysql2/promise` |
| Auth | JWT cookie-based (httpOnly, 15m access / 30d refresh) |
| Migration | Umzug (tự động tạo DB khi deploy) |
| AI | OpenAI / Anthropic / Gemini — multi-provider, tự fallback |
| Payment | Web2M QR banking (polling, không webhook) |
| Storage | Cloudinary (avatar) |
| Logger | Winston |

---

## Yêu cầu

- Node.js >= 20
- MySQL 8
- (Tuỳ chọn) Docker + Docker Compose

---

## Cài đặt & Chạy Dev

### 1. Clone và cài dependencies

```bash
cd api
npm install
```

### 2. Tạo file `.env`

```bash
cp .env.example .env
```

Điền đầy đủ các biến trong `.env` (xem mục [Biến môi trường](#biến-môi-trường) bên dưới).

### 3. Chạy migration (tạo DB)

```bash
npm run migrate
```

> Migration tự động tạo tất cả bảng và seed dữ liệu mặc định (gói credits, settings).

### 4. Khởi động server

```bash
npm run dev
```

Server chạy tại `http://localhost:3000`. Hot-reload tự động khi sửa file `.ts`.

---

## Scripts

```bash
npm run dev             # Dev server với hot-reload (tsx + nodemon)
npm run build           # Build TypeScript → dist/
npm start               # Chạy production (cần build trước)

npm run migrate         # Chạy pending migrations (dev)
npm run migrate:prod    # Chạy pending migrations (production, sau build)
npm run migrate:down    # Rollback 1 migration gần nhất
npm run migrate:status  # Xem trạng thái migrations

npm run typecheck       # Kiểm tra TypeScript không build
npm run lint            # ESLint + auto-fix
```

---

## Biến môi trường

Tạo file `.env` từ `.env.example`:

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=fengshui
DB_USER=root
DB_PASSWORD=your_password

# JWT
JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars

# Encryption (AES-256 cho API key AI)
ENCRYPTION_KEY=your_32_byte_hex_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Web2M Payment
BANK_NAME=Vietcombank
BANK_NUMBER=1234567890
BANK_ACCOUNT_HOLDER=NGUYEN VAN A
BANK_TOKEN=your_web2m_token
API_GET_QR=https://api.web2m.com/...
API_GET_TRANSACTION_V2=https://api.web2m.com/...

# Business
CREDIT_VALIDITY_DAYS=50
```

---

## Cấu trúc thư mục

```
src/
├── app.ts                  # Express setup, mount routes
├── server.ts               # Entry point
├── migrate.ts              # Migration runner
├── migrations/             # Migration files (001→011)
├── config/                 # database, jwt, cloudinary, web2m
├── types/                  # TypeScript interfaces
├── middleware/             # auth, checkCredits, rateLimit, validate, errorHandler
├── models/                 # Raw SQL query helpers
├── services/               # ai, auth, payment, reading, upload
├── controllers/            # Route handlers
│   └── admin/
└── routes/                 # Route definitions
    └── admin/
```

---

## API Endpoints

### Auth — `/api/v1/auth`

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/register` | Đăng ký tài khoản |
| POST | `/login` | Đăng nhập |
| POST | `/refresh` | Làm mới access token |
| POST | `/logout` | Đăng xuất |
| GET | `/me` | Thông tin user hiện tại |

### Readings — `/api/v1/readings`

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/numerology` | Xem số vận mệnh (free lần đầu) | Optional |
| POST | `/numerology/premium` | Phân tích chuyên sâu | Required + Credits |
| POST | `/love` | Xem tình duyên | Required + Credits |
| POST | `/finance` | Xem tài chính | Required + Credits |
| POST | `/sim` | Xem sim số | Required + Credits |
| POST | `/fengshui-home` | Xem phong thuỷ nhà ở | Required + Credits |
| POST | `/horoscope` | Xem tử vi | Required + Credits |
| GET | `/history` | Lịch sử đã xem | Required |

### Credits — `/api/v1/credits`

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/packages` | Danh sách gói lượt |
| POST | `/orders` | Tạo đơn hàng + QR |
| GET | `/orders/:id/status` | Kiểm tra trạng thái thanh toán |
| GET | `/usage` | Lịch sử sử dụng lượt |

### User — `/api/v1/users`

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/profile` | Xem hồ sơ |
| PATCH | `/profile` | Cập nhật hồ sơ |
| POST | `/avatar` | Upload avatar |
| PATCH | `/password` | Đổi mật khẩu |

### Admin — `/api/v1/admin` *(yêu cầu role admin)*

| Nhóm | Endpoints |
|---|---|
| Stats | `GET /stats` — tổng quan dashboard |
| Users | `GET /users`, `GET /users/:id`, `PATCH /users/:id/credits`, `PATCH /users/:id/status` |
| Packages | CRUD `/packages` |
| Orders | `GET /orders`, `PATCH /orders/:id/status` |
| AI Models | CRUD `/ai-models`, `POST /ai-models/:id/set-default` |
| Prompts | CRUD `/prompts` |
| Settings | `GET /settings`, `PUT /settings` |

---

## Hệ thống Credits

Credits có **3 trạng thái**:

| Trạng thái | Điều kiện | Hành vi |
|---|---|---|
| `active` | Có lượt + còn hạn | Cho phép dùng |
| `frozen` | Có lượt + hết 50 ngày | Khoá, trả 402 `CREDITS_FROZEN` |
| `empty` | Hết lượt | Trả 402 `NO_CREDITS` |

**Mua thêm lượt khi đang frozen** → mở khoá + cộng dồn + gia hạn 50 ngày.

**Gói mặc định:**

| Gói | Lượt | Giá | Hiệu lực |
|---|---|---|---|
| Cơ Bản | 20 | 79,000 đ | 50 ngày |
| Tiêu Chuẩn | 60 | 199,000 đ | 50 ngày |
| Cao Cấp | 120 | 349,000 đ | 50 ngày |

---

## Response Format

Tất cả response đều theo cùng format:

```json
// Thành công
{ "success": true, "data": {}, "message": "..." }

// Lỗi
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Mô tả lỗi" } }

// Phân trang
{ "success": true, "data": { "items": [], "total": 100, "page": 1, "limit": 20, "totalPages": 5 } }
```

---

## Deploy với Docker

### Build & chạy

```bash
docker compose up -d
```

Migration tự động chạy khi container khởi động. Nếu không có gì mới thì bỏ qua.

### Thêm migration mới

Tạo file trong `src/migrations/` theo format `NNN_ten_migration.ts`:

```typescript
import type { Pool } from 'mysql2/promise'

export async function up(pool: Pool) {
  await pool.query(`ALTER TABLE users ADD COLUMN phone_verified TINYINT(1) NOT NULL DEFAULT 0`)
}

export async function down(pool: Pool) {
  await pool.query(`ALTER TABLE users DROP COLUMN phone_verified`)
}
```

Chạy:

```bash
npm run migrate         # dev
npm run migrate:prod    # production (sau build)
```

---

## AI Multi-Provider

API key các provider được mã hoá AES-256 trong DB. Khi gọi AI:

1. Lấy danh sách model active, sắp theo priority
2. Thử model default trước
3. Nếu lỗi → tự động fallback sang model tiếp theo
4. Trừ credit **sau khi AI thành công** (không trừ nếu AI lỗi)

Thêm model mới qua Admin API hoặc trực tiếp trong DB.
