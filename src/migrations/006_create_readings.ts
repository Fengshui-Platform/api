import type { Pool } from 'mysql2/promise'

export async function up(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS readings (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id     INT UNSIGNED NULL,
      session_id  VARCHAR(128) NULL,
      ip_address  VARCHAR(45)  NULL,
      module      ENUM('numerology','love','finance','sim','fengshui_home','horoscope') NOT NULL,
      input_data  JSON         NOT NULL,
      result_data JSON         NULL,
      ai_model_id INT UNSIGNED NULL,
      tokens_used INT UNSIGNED NOT NULL DEFAULT 0,
      is_free     TINYINT(1)   NOT NULL DEFAULT 0,
      credits_used INT UNSIGNED NOT NULL DEFAULT 0,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id    (user_id),
      INDEX idx_module     (module),
      INDEX idx_is_free    (is_free),
      INDEX idx_created_at (created_at),
      CONSTRAINT fk_reading_user  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE SET NULL,
      CONSTRAINT fk_reading_model FOREIGN KEY (ai_model_id) REFERENCES ai_models(id)  ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function down(pool: Pool) {
  await pool.query('DROP TABLE IF EXISTS readings')
}
