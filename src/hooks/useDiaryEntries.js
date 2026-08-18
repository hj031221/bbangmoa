import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

// 빵집 연결 기록장. 로그인 필수 — 비로그인 시 항상 빈 배열.
export function useDiaryEntries() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  // reload 는 effect(마운트/유저 변경)에서도, addEntry 등 mutation 이후에도 직접 호출된다.
  // effect 쪽 호출만 alive 가드로 stale 응답을 무시하고, 직접 호출은 항상 최신 응답을 반영한다.
  const reload = (alive = { current: true }) => {
    if (!user) {
      setEntries([])
      return
    }
    setLoading(true)
    supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive.current) return
        setLoading(false)
        if (error) {
          console.error('[기록장] 조회 실패', error)
          return
        }
        setEntries(data)
      })
  }

  useEffect(() => {
    const alive = { current: true }
    reload(alive)
    return () => {
      alive.current = false
    }
  }, [user])

  const addEntry = (bakery, text) => {
    if (!user) return Promise.resolve({ error: new Error('로그인이 필요해요.') })
    return supabase
      .from('diary_entries')
      .insert({ user_id: user.id, bakery_id: bakery.id, bakery, text })
      .then(({ error }) => {
        if (error) {
          console.error('[기록장] 작성 실패', error)
          return { error }
        }
        reload()
        return { error: null }
      })
  }

  const updateEntry = (id, text) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, text } : e)))
    return supabase
      .from('diary_entries')
      .update({ text, updated_at: new Date().toISOString() })
      .eq('id', id)
      .then(({ error }) => error && console.error('[기록장] 수정 실패', error))
  }

  const removeEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    supabase
      .from('diary_entries')
      .delete()
      .eq('id', id)
      .then(({ error }) => error && console.error('[기록장] 삭제 실패', error))
  }

  return { entries, loading, addEntry, updateEntry, removeEntry }
}
