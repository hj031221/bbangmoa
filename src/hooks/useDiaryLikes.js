import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

// 기록장 좋아요. entryId 가 바뀌면(다른 기록 열기) 다시 조회한다.
export function useDiaryLikes(entryId) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  const [likedByMe, setLikedByMe] = useState(false)
  const [loading, setLoading] = useState(false)

  // reload 는 effect(entry 전환)에서도, toggle 실패 롤백에서도 직접 호출된다.
  // effect 쪽 호출만 alive 가드로 stale 응답을 무시한다 — 없으면 entry 를 빠르게 옮겨다닐 때
  // 이전 entry 의 응답이 늦게 도착해 지금 보고 있는 entry 의 좋아요 상태를 덮어쓸 수 있다
  // (useDiaryEntries.js 와 동일한 패턴).
  const reload = (alive = { current: true }) => {
    if (!entryId) {
      setCount(0)
      setLikedByMe(false)
      return
    }
    setLoading(true)
    supabase
      .from('diary_likes')
      .select('user_id')
      .eq('entry_id', entryId)
      .then(({ data, error }) => {
        if (!alive.current) return
        setLoading(false)
        if (error) {
          console.error('[기록장] 좋아요 조회 실패', error)
          return
        }
        setCount(data.length)
        setLikedByMe(!!user && data.some((row) => row.user_id === user.id))
      })
  }

  useEffect(() => {
    const alive = { current: true }
    reload(alive)
    return () => {
      alive.current = false
    }
  }, [entryId, user?.id])

  // 낙관적으로 반영하고, 실패하면 재조회로 되돌린다.
  const toggle = async () => {
    if (!user || !entryId) return { error: new Error('로그인이 필요해요.') }
    if (likedByMe) {
      setCount((c) => c - 1)
      setLikedByMe(false)
      const { error } = await supabase
        .from('diary_likes')
        .delete()
        .eq('entry_id', entryId)
        .eq('user_id', user.id)
      if (error) {
        console.error('[기록장] 좋아요 취소 실패', error)
        reload()
        return { error }
      }
    } else {
      setCount((c) => c + 1)
      setLikedByMe(true)
      const { error } = await supabase
        .from('diary_likes')
        .insert({ entry_id: entryId, user_id: user.id })
      if (error) {
        console.error('[기록장] 좋아요 실패', error)
        reload()
        return { error }
      }
    }
    return { error: null }
  }

  return { count, likedByMe, loading, toggle }
}
