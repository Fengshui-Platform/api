import type { Pool } from 'mysql2/promise'

export async function up(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS free_usage_logs (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ip_address VARCHAR(45)  NOT NULL,
      session_id VARCHAR(128) NULL,
      created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ip_date (ip_address, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function down(pool: Pool) {
  await pool.query('DROP TABLE IF EXISTS free_usage_logs')
}
