import type { Pool } from 'mysql2/promise'

export async function up(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_view_logs (
      id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64)  NOT NULL,
      user_id    INT UNSIGNED DEFAULT NULL,
      page       VARCHAR(128) NOT NULL,
      referrer   VARCHAR(512) DEFAULT NULL,
      user_agent VARCHAR(512) DEFAULT NULL,
      ip_address VARCHAR(45)  NOT NULL,
      created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pv_session    (session_id),
      INDEX idx_pv_user       (user_id),
      INDEX idx_pv_page_date  (page, created_at),
      INDEX idx_pv_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_events (
      id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64)  NOT NULL,
      user_id    INT UNSIGNED DEFAULT NULL,
      event_type VARCHAR(64)  NOT NULL,
      module     VARCHAR(32)  DEFAULT NULL,
      meta       JSON         DEFAULT NULL,
      ip_address VARCHAR(45)  NOT NULL,
      created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fe_session    (session_id),
      INDEX idx_fe_user       (user_id),
      INDEX idx_fe_event_date (event_type, created_at),
      INDEX idx_fe_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function down(pool: Pool) {
  await pool.query('DROP TABLE IF EXISTS feature_events')
  await pool.query('DROP TABLE IF EXISTS page_view_logs')
}
