import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'bbangmoa_saved'

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// 찜한 빵집 저장 훅.
//   로그아웃 상태: localStorage(브라우저별) 기반.
//   로그인 상태: Supabase saved_bakeries 테이블(계정별, 기기 간 동기화).
//     로컬 목록과는 합치지 않고, 로그인 시점부터 계정 DB 기준으로 새로 시작한다.
//   targetUserId 가 있으면(친구 목록 읽기 전용 조회) 그 id 로만 조회하고 로컬스토리지는 건드리지 않는다.
export function useSavedBakeries(targetUserId) {
  const { user } = useAuth()
  const queryUserId = targetUserId ?? user?.id
  const [saved, setSaved] = useState(targetUserId ? [] : readLocal)

  useEffect(() => {
    if (!queryUserId) {
      setSaved(readLocal())
      return
    }
    let alive = true
    supabase
      .from('saved_bakeries')
      .select('bakery')
      .eq('user_id', queryUserId)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          console.error('[saved] DB 조회 실패', error)
          return
        }
        setSaved(data.map((row) => row.bakery))
      })
    return () => {
      alive = false
    }
  }, [queryUserId])

  // 로그아웃 상태에서만 로컬에 반영 (로그인 상태는 토글 시 DB에 직접 반영, 친구 조회는 애초에 mutate 안 함)
  useEffect(() => {
    if (!targetUserId && !user) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  }, [saved, user, targetUserId])

  const toggleSave = (bakery) => {
    const alreadySaved = saved.some((b) => b.id === bakery.id)

    if (!user) {
      setSaved((prev) =>
        alreadySaved ? prev.filter((b) => b.id !== bakery.id) : [...prev, bakery],
      )
      return
    }

    if (alreadySaved) {
      setSaved((prev) => prev.filter((b) => b.id !== bakery.id))
      supabase
        .from('saved_bakeries')
        .delete()
        .eq('user_id', user.id)
        .eq('bakery_id', bakery.id)
        .then(({ error }) => error && console.error('[saved] DB 삭제 실패', error))
    } else {
      setSaved((prev) => [...prev, bakery])
      supabase
        .from('saved_bakeries')
        .insert({ user_id: user.id, bakery_id: bakery.id, bakery })
        .then(({ error }) => error && console.error('[saved] DB 저장 실패', error))
    }
  }

  const isSaved = (id) => saved.some((b) => b.id === id)

  return { saved, toggleSave, isSaved }
}
