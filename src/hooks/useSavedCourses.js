// src/hooks/useSavedCourses.js
import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

// 저장된 "대전한바퀴" 코스 목록. 로그인 필수 — 비로그인 시 항상 빈 배열.
// (PilgrimagePage.handleSave 가 insert 하는 saved_courses 테이블을 읽기만 한다.)
export function useSavedCourses() {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setCourses([])
      return
    }
    let alive = true
    setLoading(true)
    supabase
      .from('saved_courses')
      .select('*')
      .eq('user_id', user.id)
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
  }, [user])

  const removeCourse = (id) => {
    setCourses((prev) => prev.filter((c) => c.id !== id))
    supabase
      .from('saved_courses')
      .delete()
      .eq('id', id)
      .then(({ error }) => error && console.error('[찜한 코스] 삭제 실패', error))
  }

  return { courses, loading, removeCourse }
}
