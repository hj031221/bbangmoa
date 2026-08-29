import { useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { buildProfileAvatarUrl } from '../lib/avatarUrl'

// 기록장 댓글. entryId 가 바뀌면(다른 기록 열기) 다시 조회한다.
// 댓글 자체엔 작성자 닉네임/아바타가 없어 get_diary_comment_authors RPC 로 합친다 — profiles 테이블을
// 직접 조회하지 않는 이유는 schema.sql 참고(그 조회를 허용하려고 RLS 를 넓히면 friend_code 까지
// 노출된다. RPC 는 nickname/avatar 컬럼만 반환).
// avatar_url 은 storage 객체 경로만 저장하므로(schema.sql CHECK) 공개 URL 을 여기서 조립한다 —
// avatar_version 을 캐시버스터로 붙인다(경로가 {uid}/avatar.jpg 로 고정이라 없으면 스토리지 기본
// 캐시(3600초) 동안 사진을 바꿔도 예전 아바타가 남을 수 있다).
export function useDiaryComments(entryId) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)

  // reload 는 effect(entry 전환)에서도, add/remove 이후(요청 도중 entry 전환 가능)에도 호출된다.
  // 두 가드가 각자 다른 경우를 막는다 — 하나만 쓰면 안 된다:
  //  - currentEntryIdRef: entry 전환. A 에 댓글을 달고 응답을 기다리는 사이 B 로 넘어가면, A 의
  //    reload() 가 나중에 끝나도 "지금 보고 있는 entry" 가 아니므로 버린다(요청을 보내기도 전에
  //    걸러 카운터도 건드리지 않는다 — 그래야 A 의 reload 가 counter 를 올려 "가장 최신"인 척
  //    B 의 정상 응답을 덮어쓰는 걸 막을 수 있다).
  //  - latestRequestIdRef: 같은 entry 안에서 reload() 가 겹치는 경우(초기 조회가 끝나기 전에
  //    댓글을 등록하면 add() 가 또 reload() 를 부름) — entryId 는 같아서 위 가드로는 못 거른다.
  const latestRequestIdRef = useRef(0)
  const currentEntryIdRef = useRef(entryId)
  currentEntryIdRef.current = entryId

  const reload = () => {
    const requestEntryId = entryId
    // 이 reload 가 만들어졌을 때의 entry 가 이미 "지금 보고 있는 entry" 가 아니면, 네트워크
    // 요청도 보내지 않고 여기서 끝낸다 — counter 도 올리지 않아야 뒤늦게 도착해도 최신 행세를 못 한다.
    if (requestEntryId !== currentEntryIdRef.current) return
    if (!requestEntryId) {
      setComments([])
      return
    }
    const requestId = ++latestRequestIdRef.current
    const isStale = () =>
      latestRequestIdRef.current !== requestId || currentEntryIdRef.current !== requestEntryId
    setLoading(true)
    supabase
      .from('diary_comments')
      .select('id, user_id, text, created_at')
      .eq('entry_id', requestEntryId)
      .order('created_at', { ascending: true })
      .then(async ({ data, error }) => {
        if (error) {
          if (isStale()) return
          console.error('[기록장] 댓글 조회 실패', error)
          setLoading(false)
          return
        }
        let nicknameById = {}
        let avatarUrlById = {}
        if (data.length > 0) {
          const { data: authors, error: authorsError } = await supabase.rpc(
            'get_diary_comment_authors',
            { p_entry_id: requestEntryId }
          )
          if (authorsError) console.error('[기록장] 댓글 작성자 조회 실패', authorsError)
          nicknameById = Object.fromEntries((authors ?? []).map((p) => [p.user_id, p.nickname]))
          avatarUrlById = Object.fromEntries(
            (authors ?? []).map((p) => [p.user_id, buildProfileAvatarUrl(supabase, p)])
          )
        }
        if (isStale()) return
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
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
