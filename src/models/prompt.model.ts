import pool from '@/config/database'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import type { ReadingModule, PromptTier } from '@/types/reading.types'

export interface PromptRow {
  id: number
  module: ReadingModule
  tier: PromptTier
  system_prompt: string
  user_template: string
  version: number
  is_active: boolean
  created_at: Date
}

interface PromptRowPacket extends PromptRow, RowDataPacket {}

export const PromptModel = {
  async getActive(module: ReadingModule, tier: PromptTier): Promise<PromptRow | null> {
    const [rows] = await pool.query<PromptRowPacket[]>(
      `SELECT * FROM prompts
       WHERE module = ? AND tier = ? AND is_active = 1
       ORDER BY version DESC
       LIMIT 1`,
      [module, tier]
    )
    return rows[0] ?? null
  },

  async findAll(opts?: { module?: ReadingModule }): Promise<PromptRow[]> {
    if (opts?.module) {
      const [rows] = await pool.query<PromptRowPacket[]>(
        'SELECT * FROM prompts WHERE module = ? ORDER BY module ASC, tier ASC, version DESC',
        [opts.module]
      )
      return rows
    }
    const [rows] = await pool.query<PromptRowPacket[]>(
      'SELECT * FROM prompts ORDER BY module ASC, tier ASC, version DESC'
    )
    return rows
  },

  async findById(id: number): Promise<PromptRow | null> {
    const [rows] = await pool.query<PromptRowPacket[]>(
      'SELECT * FROM prompts WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] ?? null
  },

  async create(data: {
    module: ReadingModule
    tier: PromptTier
    system_prompt: string
    user_template: string
    version?: number
  }): Promise<number> {
    // Auto-increment version within same module+tier
    const [[versionRow]] = await pool.query<(RowDataPacket & { max_v: number | null })[]>(
      'SELECT MAX(version) AS max_v FROM prompts WHERE module = ? AND tier = ?',
      [data.module, data.tier]
    )
    const nextVersion = (versionRow?.max_v ?? 0) + 1

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO prompts (module, tier, system_prompt, user_template, version, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        data.module,
        data.tier,
        data.system_prompt,
        data.user_template,
        data.version ?? nextVersion,
      ]
    )
    return result.insertId
  },

  async update(id: number, data: Partial<Pick<PromptRow,
    'system_prompt' | 'user_template' | 'is_active'
  >>): Promise<void> {
    const fields = Object.keys(data) as (keyof typeof data)[]
    if (fields.length === 0) return

    const setClauses = fields.map(f => `\`${f}\` = ?`).join(', ')
    const values: unknown[] = fields.map(f => data[f])
    values.push(id)

    await pool.query<ResultSetHeader>(
      `UPDATE prompts SET ${setClauses} WHERE id = ?`,
      values
    )
  },

  async deactivate(id: number): Promise<void> {
    await pool.query<ResultSetHeader>(
      'UPDATE prompts SET is_active = 0 WHERE id = ?',
      [id]
    )
  },
}
