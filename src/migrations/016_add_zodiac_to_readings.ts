import type { Pool } from 'mysql2/promise'

export async function up(pool: Pool) {
  await pool.query(`
    ALTER TABLE readings
      MODIFY COLUMN module ENUM('numerology','love','finance','sim','fengshui_home','horoscope','zodiac') NOT NULL
  `)
}

export async function down(pool: Pool) {
  await pool.query(`
    ALTER TABLE readings
      MODIFY COLUMN module ENUM('numerology','love','finance','sim','fengshui_home','horoscope') NOT NULL
  `)
}
