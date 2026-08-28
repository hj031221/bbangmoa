import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { buildProfileAvatarUrl } from '../lib/avatarUrl'

// 기록장 댓글. entryId 가 바뀌면(다른 기록 열기) 다시 조회한다.
// 댓글 자체엔 작성자 닉네임/아바타가 없어 profiles 조회로 합친다(useFriends 와 동일한 2단계 패턴).
// avatar_url 은 storage 객체 경로만 저장하므로(schema.sql CHECK) 공개 URL 을 여기서 조립한다 —
// avatar_version 을 캐시버스터로 붙인다(경로가 {uid}/avatar.jpg 로 고정이라 없으면 스토리지 기본
// 캐시(3600초) 동안 사진을 바꿔도 예전 아바타가 남을 수 있다).
export function useDiaryComments(entryId) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)

  // reload 는 effect(entry 전환)에서도, add/remove 이후에도 직접 호출된다.
  // effect 쪽 호출만 alive 가드로 stale 응답을 무시한다 — 없으면 entry 를 빠르게 옮겨다닐 때
  // 이전 entry 의 댓글(작성자 프로필 조회까지 포함된 2단계 응답)이 늦게 도착해 지금 보고 있는
  // entry 의 댓글 목록을 덮어쓸 수 있다(useDiaryEntries.js 와 동일한 패턴).
  const reload = (alive = { current: true }) => {
    if (!entryId) {
      setComments([])
      return
    }
    setLoading(true)
    supabase
      .from('diary_comments')
      .select('id, user_id, text, created_at')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true })
      .then(async ({ data, error }) => {
        if (error) {
          if (!alive.current) return
          console.error('[기록장] 댓글 조회 실패', error)
          setLoading(false)
          return
        }
        const userIds = [...new Set(data.map((c) => c.user_id))]
        let nicknameById = {}
        let avatarUrlById = {}
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, nickname, avatar_url, avatar_version')
            .in('user_id', userIds)
          if (profilesError) console.error('[기록장] 댓글 작성자 조회 실패', profilesError)
          nicknameById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.nickname]))
          avatarUrlById = Object.fromEntries(
            (profiles ?? []).map((p) => [p.user_id, buildProfileAvatarUrl(supabase, p)])
          )
        }
        if (!alive.current) return
        setLoading(false)
        setComments(
          data.map((c) => ({
            ...c,
            nickname: nicknameById[c.user_id] || '이름 없음',
            avatarUrl: avatarUrlById[c.user_id] ?? null,
          }))
        )
      })
  }

  useEffect(() => {
    const alive = { current: true }
    reload(alive)
    return () => {
      alive.current = false
    }
  }, [entryId])

  const add = async (text) => {
    const trimmed = text.trim()
    if (!user || !entryId || !trimmed) return { error: new Error('로그인이 필요해요.') }
    const { error } = await supabase
      .from('diary_comments')
      .insert({ entry_id: entryId, user_id: user.id, text: trimmed })
    if (error) {
      console.error('[기록장] 댓글 작성 실패', error)
      return { error }
    }
    reload()
    return { error: null }
  }

  const remove = (id) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
    supabase
      .from('diary_comments')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (!error) return
        console.error('[기록장] 댓글 삭제 실패', error)
        reload() // 낙관적으로 지운 걸 되돌린다 — 실패했는데도 화면에서만 사라진 채로 남지 않도록.
      })
  }

  return { comments, loading, add, remove }
}
