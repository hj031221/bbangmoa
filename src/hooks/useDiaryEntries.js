import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

const DIARY_SELECT = 'id,user_id,bakery_id,bakery,text,created_at,updated_at,verified,verified_at'

// 빵집 연결 기록장. 로그인 필수 — 비로그인 시 항상 빈 배열.
// targetUserId 가 있으면(친구 목록 읽기 전용 조회) 그 id 로 조회한다.
export function useDiaryEntries(targetUserId) {
  const { user } = useAuth()
  const queryUserId = targetUserId ?? user?.id
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  // reload 는 effect(마운트/유저 변경)에서도, addEntry 등 mutation 이후에도 직접 호출된다.
  // effect 쪽 호출만 alive 가드로 stale 응답을 무시하고, 직접 호출은 항상 최신 응답을 반영한다.
  const reload = (alive = { current: true }) => {
    if (!queryUserId) {
      setEntries([])
      return
    }
    setLoading(true)
    supabase
      .from('diary_entries')
      .select(DIARY_SELECT)
      .eq('user_id', queryUserId)
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
  }, [queryUserId])

  const addEntry = (bakery, text, location = null) => {
    if (!user) return Promise.resolve({ error: new Error('로그인이 필요해요.') })

    // 이슈 #69: create_diary_entry 는 bakery_coords(서버 신뢰 좌표)만 보고 verified 를
    // 판정한다. 저장 직전에 서버측 좌표 해석을 1회 시도해 캐시를 채운다. 실패해도
    // (미해결/함수 오류) 기록은 그대로 저장되며 그 경우 verified=false 가 된다 — 흐름을 막지 않는다.
    return supabase.functions
      .invoke('resolve-bakery-coords', { body: { bakery_id: bakery.id, name: bakery.name } })
      .catch((err) => console.error('[기록장] 좌표 해석 실패', err))
      .then(() =>
        supabase.rpc('create_diary_entry', {
          p_bakery: bakery,
          p_text: text,
          p_lat: location?.lat ?? null,
          p_lng: location?.lng ?? null,
        }),
      )
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
