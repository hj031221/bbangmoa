import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

const DEFAULT_TARGET = 3
const clamp = (n) => Math.min(20, Math.max(1, Math.round(n)))

// profiles.stamp_target(구별 스탬프 목표, 1~20)를 읽고, 본인 값은 갱신한다.
// targetUserId 가 있으면 그 사용자(친구)의 값을 읽기만 한다 — setTarget 은 no-op.
export function useStampTarget(targetUserId) {
  const { user } = useAuth()
  const queryUserId = targetUserId ?? user?.id
  const [target, setTargetState] = useState(DEFAULT_TARGET)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!queryUserId) {
      setTargetState(DEFAULT_TARGET)
      return
    }
    const alive = { current: true }
    setLoading(true)
    supabase
      .from('profiles')
      .select('stamp_target')
      .eq('user_id', queryUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive.current) return
        setLoading(false)
        if (error) {
          console.error('[스탬프목표] 조회 실패', error)
          return
        }
        setTargetState(Number.isInteger(data?.stamp_target) ? data.stamp_target : DEFAULT_TARGET)
      })
    return () => {
      alive.current = false
    }
  }, [queryUserId])

  const setTarget = (n) => {
    if (targetUserId || !user) return Promise.resolve()
    const clamped = clamp(n)
    const prev = target
    setTargetState(clamped) // 낙관적
    return supabase
      .from('profiles')
      .update({ stamp_target: clamped })
      .eq('user_id', user.id)
      .then(({ error }) => {
        if (error) {
          console.error('[스탬프목표] 저장 실패', error)
          setTargetState(prev) // 롤백
        }
      })
  }

  return { target, setTarget, loading }
}
