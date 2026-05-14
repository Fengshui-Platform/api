export type ReadingModule = 'numerology' | 'love' | 'finance' | 'sim' | 'fengshui_home' | 'horoscope' | 'zodiac'
export type PromptTier = 'free' | 'paid'

export interface ReadingRow {
  id: number
  user_id: number | null
  session_id: string | null
  ip_address: string | null
  module: ReadingModule
  input_data: string
  result_data: string | null
  ai_model_id: number | null
  tokens_used: number
  is_free: boolean
  credits_used: number
  created_at: Date
}

export interface ReadingInputDto {
  full_name: string
  birth_date: string
  phone?: string
  gender?: 'male' | 'female' | 'other'
  // Love module
  partner_name?: string
  partner_birth_date?: string
  // Fengshui home
  house_direction?: string
}

export interface SectionResult {
  visible: boolean
  locked?: boolean
  credits_required?: number
  content?: Record<string, unknown>
  teaser?: string
}

export interface ReadingResult {
  life_path_number?: number
  soul_number?: number
  personality_number?: number
  destiny_number?: number
  summary: string
  sections: Record<string, SectionResult>
}
