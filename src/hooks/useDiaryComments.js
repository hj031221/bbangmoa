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

  // reload 는 effect(entry 전환)에서도, add/remove 이후에도 호출된다 — 같은 entry 안에서도
  // 겹쳐 호출될 수 있다(예: 초기 조회가 끝나기 전에 댓글을 등록하면 add() 가 또 reload() 를 부름).
  // 그래서 entryId 비교만으로는 부족하다 — 늦게 도착한 "먼저 보낸" 요청이 나중에 보낸 요청의
  // 결과를 덮어쓸 수 있기 때문. 매 reload() 마다 증가하는 요청 번호를 매겨, 응답이 왔을 때
  // "가장 최근에 보낸 요청"인지 확인해서 아니면 버린다 — entry 전환이든 같은 entry 내 중복
  // 호출이든 이 하나로 전부 걸러진다.
  const latestRequestIdRef = useRef(0)

  const reload = () => {
    const requestEntryId = entryId
    const requestId = ++latestRequestIdRef.current
    const isStale = () => latestRequestIdRef.current !== requestId
    if (!requestEntryId) {
      setComments([])
      return
    }
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
