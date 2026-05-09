import type { Pool } from 'mysql2/promise'

export async function up(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prompts (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      module        ENUM('numerology','love','finance','sim','fengshui_home','horoscope') NOT NULL,
      tier          ENUM('free','paid') NOT NULL,
      system_prompt TEXT       NOT NULL,
      user_template TEXT       NOT NULL,
      version       INT        NOT NULL DEFAULT 1,
      is_active     TINYINT(1) NOT NULL DEFAULT 1,
      created_at    DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_module_tier (module, tier),
      INDEX idx_is_active   (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function down(pool: Pool) {
  await pool.query('DROP TABLE IF EXISTS prompts')
}
