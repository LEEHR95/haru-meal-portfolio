import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 설정이 필요해요.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
