import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] 环境变量未配置，部分功能将不可用')
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
)
