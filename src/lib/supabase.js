// Supabase 클라이언트. 계정 연동(구글/카카오 로그인) + 찜한 빵집 DB 저장에 쓴다.
// 키 미설정 시(로컬 개발 초기 등) 앱이 죽지 않도록 supabaseEnabled() 로 가드하고 쓴다.
import { createClient } from '@supabase/supabase-js'
import { hasKey } from '../api/http'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = () => hasKey(SUPABASE_URL) && hasKey(SUPABASE_ANON_KEY)

export const supabase = supabaseEnabled()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null
