import type { Pool } from 'mysql2/promise'

export async function up(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credit_usage_logs (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id      INT UNSIGNED NOT NULL,
      reading_id   INT UNSIGNED NULL,
      module       VARCHAR(50)  NOT NULL,
      credits_used INT          NOT NULL,
      balance_after INT UNSIGNED NOT NULL,
      created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id    (user_id),
      INDEX idx_created_at (created_at),
      CONSTRAINT fk_usage_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
      CONSTRAINT fk_usage_reading FOREIGN KEY (reading_id) REFERENCES readings(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function down(pool: Pool) {
  await pool.query('DROP TABLE IF EXISTS credit_usage_logs')
}
