import { useEffect, useState } from 'react'
import { supabase, supabaseEnabled } from '../lib/supabase'

// 구글/카카오 로그인 상태 훅. Supabase 키 미설정 시엔 항상 로그아웃 상태로 동작한다.
//
// 반환:
//   user    : Supabase user 객체 | null
//   loading : 최초 세션 조회 중 여부
//   signInWithGoogle / signInWithKakao : OAuth 리다이렉트 시작
//   signOut : 로그아웃
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(supabaseEnabled())

  useEffect(() => {
    if (!supabaseEnabled()) return

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signInWithGoogle = () =>
    supabase?.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

  // 주의: Supabase 가 Kakao OAuth 요청에 account_email 스코프를 서버 단에서 강제 포함한다
  // (options.scopes 로 좁혀도 무시됨 — 확인됨: 실제 전송된 scope=account_email profile_image profile_nickname).
  // 카카오 앱이 "비즈 앱 전환 + 이메일 동의항목 심사"를 통과하기 전까진 KOE205 로 막힌다.
  const signInWithKakao = () =>
    supabase?.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin },
    })

  const signOut = () => supabase?.auth.signOut()

  return { user, loading, signInWithGoogle, signInWithKakao, signOut }
}
