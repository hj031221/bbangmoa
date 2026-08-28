import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

// 기록장 댓글. entryId 가 바뀌면(다른 기록 열기) 다시 조회한다.
// 댓글 자체엔 작성자 닉네임이 없어 profiles 조회로 합친다(useFriends 와 동일한 2단계 패턴).
export function useDiaryComments(entryId) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = () => {
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
          console.error('[기록장] 댓글 조회 실패', error)
          setLoading(false)
          return
        }
        const userIds = [...new Set(data.map((c) => c.user_id))]
        let nicknameById = {}
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, nickname')
            .in('user_id', userIds)
          if (profilesError) console.error('[기록장] 댓글 작성자 조회 실패', profilesError)
          nicknameById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.nickname]))
        }
        setLoading(false)
        setComments(data.map((c) => ({ ...c, nickname: nicknameById[c.user_id] || '이름 없음' })))
      })
  }

  useEffect(() => {
    reload()
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
      .then(({ error }) => error && console.error('[기록장] 댓글 삭제 실패', error))
  }

  return { comments, loading, add, remove }
}
