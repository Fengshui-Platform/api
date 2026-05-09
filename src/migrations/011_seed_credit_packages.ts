import type { Pool } from 'mysql2/promise'

export async function up(pool: Pool) {
  await pool.query(`
    INSERT IGNORE INTO credit_packages (name, credits, price, validity_days, description, sort_order) VALUES
      ('Gói Cơ Bản',    20,  79000, 50, '20 lượt xem trong 50 ngày',  1),
      ('Gói Tiêu Chuẩn', 60, 199000, 50, '60 lượt xem trong 50 ngày',  2),
      ('Gói Cao Cấp',   120, 349000, 50, '120 lượt xem trong 50 ngày', 3)
  `)
}

export async function down(pool: Pool) {
  await pool.query(`DELETE FROM credit_packages WHERE name IN ('Gói Cơ Bản', 'Gói Tiêu Chuẩn', 'Gói Cao Cấp')`)
}
