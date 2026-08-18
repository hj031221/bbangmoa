import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

// 빵집 연결 기록장. 로그인 필수 — 비로그인 시 항상 빈 배열.
export function useDiaryEntries() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = () => {
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
        setLoading(false)
        if (error) {
          console.error('[기록장] 조회 실패', error)
          return
        }
        setEntries(data)
      })
  }

  useEffect(reload, [user])

  const addEntry = (bakery, text) => {
    if (!user) return Promise.resolve()
    return supabase
      .from('diary_entries')
      .insert({ user_id: user.id, bakery_id: bakery.id, bakery, text })
      .then(({ error }) => {
        if (error) {
          console.error('[기록장] 작성 실패', error)
          return
        }
        reload()
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
