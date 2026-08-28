import { useEffect, useState } from 'react'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { resizeToSquareJpeg } from '../lib/avatarImage'

// 구글/카카오 로그인 상태 훅. Supabase 키 미설정 시엔 항상 로그아웃 상태로 동작한다.
//
// 반환:
//   user    : Supabase user 객체 | null
//   loading : 최초 세션 조회 중 여부
//   signInWithGoogle / signInWithKakao : OAuth 리다이렉트 시작
//   signOut : 로그아웃
//   updateAvatar / removeAvatar / syncAvatarMirror : 프로필 아바타 업로드·제거·미러 재동기화
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

  // queryParams.prompt: 로그아웃 후 재로그인 시 이전 계정으로 자동 로그인되는 것을 막기 위해
  // 매번 계정 선택/재인증 화면을 강제로 띄운다.
  const signInWithGoogle = () =>
    supabase?.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    })

  // 주의: Supabase 가 Kakao OAuth 요청에 account_email 스코프를 서버 단에서 강제 포함한다
  // (options.scopes 로 좁혀도 무시됨 — 확인됨: 실제 전송된 scope=account_email profile_image profile_nickname).
  // 카카오 앱이 "비즈 앱 전환 + 이메일 동의항목 심사"를 통과하기 전까진 KOE205 로 막힌다.
  const signInWithKakao = () =>
    supabase?.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'login' } },
    })

  const signOut = () => supabase?.auth.signOut()

  // 프로필 편집(닉네임 변경). user_metadata.nickname 에 저장 — getDisplayName 이 최우선으로 읽는다.
  // profiles.nickname 은 친구가 볼 수 있게 별도로 미러링한다(auth.users 는 타인이 조회 불가).
  // 미러 단계만 실패하면 { ...result, error, partial: 'mirror' } 로 신호한다(비치명적) — 아바타와 동일 패턴.
  // 주의: auth 메타데이터가 먼저 반영되므로(setUser) 화면의 표시 이름은 이미 새 닉네임이다.
  // 그래서 재시도는 "값이 바뀌었는지" 비교가 아니라 이 partial 플래그로만 판단해야 한다 —
  // 그렇지 않으면 재제출 시 nickChanged 가 false 가 되어 미러가 영영 복구되지 않는다.
  const updateNickname = async (nickname) => {
    const result = await supabase?.auth.updateUser({ data: { nickname } })
    if (!result || result.error) return result ?? { error: new Error('로그인이 필요해요.') }
    setUser(result.data.user) // onAuthStateChange 이벤트에 의존하지 않고 즉시 반영
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ nickname })
      .eq('user_id', result.data.user.id)
    if (profileError) {
      console.error('[프로필] 친구용 닉네임 동기화 실패', profileError)
      return { ...result, error: profileError, partial: 'mirror' }
    }
    return result
  }

  // 프로필 아바타 업로드. avatars 버킷 {uid}/avatar.jpg 에 upsert 하고
  // user_metadata.custom_avatar_url(자기 화면 원본, 전체 URL) → profiles.avatar_url(친구 화면 미러) 순으로 저장한다.
  // (avatar_url 이 아니라 custom_avatar_url 인 이유: GoTrue 가 매 로그인마다 OAuth 제공자 사진을
  //  user_metadata.avatar_url 로 재병합하므로 우리 업로드 URL 이 덮어써진다.)
  // profiles.avatar_url 에는 전체 URL 이 아니라 storage 객체 "경로"만 저장한다 — DB CHECK 제약이
  // 이 값을 본인 고정 경로와 정확히 일치하는지만 검사하므로(schema.sql), 임의 호스트 URL 을 넣을 수 없다.
  // 친구 화면은 이 경로로 getAvatarUrl 이 아니라 useFriends 가 공개 URL 을 직접 조립한다.
  // 미러 단계만 실패하면 { ...result, error, partial: 'mirror' } 로 신호한다(비치명적).
  const updateAvatar = async (file) => {
    if (!supabase) return { error: new Error('로그인이 필요해요.') }
    // 클라이언트 검증은 UX 조기 차단 — 실제 강제선은 버킷 정책(allowed_mime_types / file_size_limit).
    if (!file?.type?.startsWith('image/')) return { error: new Error('이미지 파일만 올릴 수 있어요.') }
    if (file.size > 2 * 1024 * 1024) return { error: new Error('2MB 이하 이미지만 올릴 수 있어요.') }

    let blob
    try {
      blob = await resizeToSquareJpeg(file, 512)
    } catch (e) {
      console.error('[프로필] 이미지 처리 실패', e)
      return { error: new Error('이미지를 처리하지 못했어요.') }
    }

    const { data: { user: current } } = await supabase.auth.getUser()
    if (!current) return { error: new Error('로그인이 필요해요.') }
    const path = `${current.id}/avatar.jpg`

    // 1) Storage — 고정 경로 + upsert. 이 단계 실패면 이후 상태 변화 없음.
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (upErr) {
      console.error('[프로필] 아바타 업로드 실패', upErr)
      return { error: upErr }
    }

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${pub.publicUrl}?v=${Date.now()}` // 고정 경로라 캐시버스터 필수

    // 2) 원본(자기 화면). 실패면 롤백 없이 에러 반환.
    const result = await supabase.auth.updateUser({ data: { custom_avatar_url: url } })
    if (result.error) {
      console.error('[프로필] 아바타 저장 실패', result.error)
      return result
    }
    setUser(result.data.user)

    // 3) 미러(친구 화면). 실패해도 자기 화면은 정상 → 비치명적.
    // DB 에는 전체 URL 이 아니라 경로만 저장(CHECK 제약이 이 형식만 허용).
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: path })
      .eq('user_id', current.id)
    if (profileError) {
      console.error('[프로필] 아바타 친구용 동기화 실패', profileError)
      return { ...result, error: profileError, partial: 'mirror' }
    }
    return result
  }

  // 아바타 제거 → 이니셜로 복귀. 참조(원본)를 먼저 지우고, Storage 객체 삭제는
  // 미러 성공 여부와 무관하게 best-effort 로 실행한다(미러만 실패해 재시도해도 공개 이미지가 잔류하지 않게).
  const removeAvatar = async () => {
    if (!supabase) return { error: new Error('로그인이 필요해요.') }
    const { data: { user: current } } = await supabase.auth.getUser()
    if (!current) return { error: new Error('로그인이 필요해요.') }

    const result = await supabase.auth.updateUser({ data: { custom_avatar_url: null } })
    if (result.error) {
      console.error('[프로필] 아바타 제거 실패', result.error)
      return result
    }
    setUser(result.data.user)

    const { error: rmErr } = await supabase.storage.from('avatars').remove([`${current.id}/avatar.jpg`])
    if (rmErr) console.error('[프로필] 아바타 객체 삭제 실패(무시)', rmErr)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('user_id', current.id)
    if (profileError) {
      console.error('[프로필] 아바타 제거 동기화 실패', profileError)
      return { ...result, error: profileError, partial: 'mirror' }
    }
    return result
  }

  // partial:'mirror' 재시도용 — 현재 원본(user_metadata.custom_avatar_url) 유무를 profiles 미러에 다시 쓴다.
  // 설정/제거 양쪽 커버(제거면 값이 null). Storage 객체는 update/removeAvatar 가 이미 처리했다.
  // DB 에는 전체 URL 이 아니라 경로만 저장(CHECK 제약이 이 형식만 허용).
  const syncAvatarMirror = async () => {
    if (!supabase) return { error: new Error('로그인이 필요해요.') }
    const { data: { user: current } } = await supabase.auth.getUser()
    if (!current) return { error: new Error('로그인이 필요해요.') }
    const path = current.user_metadata?.custom_avatar_url ? `${current.id}/avatar.jpg` : null
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: path })
      .eq('user_id', current.id)
    if (error) {
      console.error('[프로필] 아바타 미러 재동기화 실패', error)
      return { error }
    }
    return { error: null }
  }

  // partial:'mirror' 재시도용 — 현재 원본(user_metadata.nickname) 값을 profiles 미러에 다시 쓴다.
  const syncNicknameMirror = async () => {
    if (!supabase) return { error: new Error('로그인이 필요해요.') }
    const { data: { user: current } } = await supabase.auth.getUser()
    if (!current) return { error: new Error('로그인이 필요해요.') }
    const nickname = current.user_metadata?.nickname ?? null
    const { error } = await supabase
      .from('profiles')
      .update({ nickname })
      .eq('user_id', current.id)
    if (error) {
      console.error('[프로필] 닉네임 미러 재동기화 실패', error)
      return { error }
    }
    return { error: null }
  }

  return {
    user, loading, signInWithGoogle, signInWithKakao, signOut,
    updateNickname, updateAvatar, removeAvatar, syncAvatarMirror, syncNicknameMirror,
  }
}
