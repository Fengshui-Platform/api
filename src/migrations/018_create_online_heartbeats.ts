import type { Pool } from 'mysql2/promise'

export async function up(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS online_heartbeats (
      session_id  VARCHAR(64)  NOT NULL PRIMARY KEY,
      user_id     INT UNSIGNED DEFAULT NULL,
      page        VARCHAR(128) DEFAULT NULL,
      ip_address  VARCHAR(45)  NOT NULL,
      last_seen   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_last_seen (last_seen)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function down(pool: Pool) {
  await pool.query('DROP TABLE IF EXISTS online_heartbeats')
}
