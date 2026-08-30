// src/hooks/useSavedCourses.js
import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

// 저장된 "대전한바퀴" 코스 목록. 로그인 필수 — 비로그인 시 항상 빈 배열.
// targetUserId 가 있으면(친구 목록 읽기 전용 조회) 그 id 로 조회한다.
export function useSavedCourses(targetUserId) {
  const { user } = useAuth()
  const queryUserId = targetUserId ?? user?.id
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!queryUserId) {
      setCourses([])
      return
    }
    let alive = true
    setLoading(true)
    supabase
      .from('saved_courses')
      .select('*')
      .eq('user_id', queryUserId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return
        setLoading(false)
        if (error) {
          console.error('[찜한 코스] 조회 실패', error)
          return
        }
        setCourses(data)
      })
    return () => {
      alive = false
    }
  }, [queryUserId])

  const removeCourse = (id) => {
    setCourses((prev) => prev.filter((c) => c.id !== id))
    supabase
      .from('saved_courses')
      .delete()
      .eq('id', id)
      .then(({ error }) => error && console.error('[찜한 코스] 삭제 실패', error))
  }

  // 이슈 #60 — 저장된 코스 이름 나중에 수정하기. 실패해도 로컬 상태는 이미 낙관적으로
  // 바뀐 채로 두지 않는다(에러면 원래 값으로 복구) — removeCourse는 실패해도 되돌릴 방법이
  // 마땅치 않아 그냥 두는 기존 패턴이지만, rename은 실패 시 이전 title로 롤백이 간단해서 한다.
  const renameCourse = async (id, title) => {
    const prevCourses = courses
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
    const { error } = await supabase.from('saved_courses').update({ title }).eq('id', id)
    if (error) {
      console.error('[찜한 코스] 이름 수정 실패', error)
      setCourses(prevCourses)
      return { error }
    }
  }

  return { courses, loading, removeCourse, renameCourse }
}
