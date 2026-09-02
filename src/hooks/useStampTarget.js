import { useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

const DEFAULT_TARGET = 3
const clamp = (n) => Math.min(20, Math.max(1, Math.round(n)))

// profiles.stamp_target(구별 스탬프 목표, 1~20)를 읽고, 본인 값은 갱신한다.
// targetUserId가 있으면 그 사용자(친구)의 값을 읽기만 한다 — setTarget은 no-op.
export function useStampTarget(targetUserId) {
  const { user } = useAuth()
  const queryUserId = targetUserId ?? user?.id
  const [target, setTargetState] = useState(DEFAULT_TARGET)
  const [loading, setLoading] = useState(Boolean(queryUserId))
  const confirmedTargetRef = useRef(DEFAULT_TARGET)
  const queryUserIdRef = useRef(queryUserId)
  const loadVersionRef = useRef(0)
  const mutationVersionRef = useRef(0)
  const updateQueueRef = useRef(Promise.resolve())

  queryUserIdRef.current = queryUserId

  useEffect(() => {
    const loadVersion = ++loadVersionRef.current
    const mutationVersionAtStart = mutationVersionRef.current

    if (!queryUserId) {
      confirmedTargetRef.current = DEFAULT_TARGET
      setTargetState(DEFAULT_TARGET)
      setLoading(false)
      return
    }

    const alive = { current: true }
    confirmedTargetRef.current = DEFAULT_TARGET
    setTargetState(DEFAULT_TARGET)
    setLoading(true)
    supabase
      .from('profiles')
      .select('stamp_target')
      .eq('user_id', queryUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive.current || loadVersion !== loadVersionRef.current) return
        setLoading(false)
        if (error) {
          console.error('[스탬프목표] 조회 실패', error)
          return
        }

        // 조회 이후 사용자가 목표를 바꿨다면 오래된 조회값으로 덮지 않는다.
        if (mutationVersionRef.current !== mutationVersionAtStart) return

        const loadedTarget = Number.isInteger(data?.stamp_target)
          ? clamp(data.stamp_target)
          : DEFAULT_TARGET
        confirmedTargetRef.current = loadedTarget
        setTargetState(loadedTarget)
      })
    return () => {
      alive.current = false
    }
  }, [queryUserId])

  const setTarget = (n) => {
    if (targetUserId || !user) return Promise.resolve()
    const clamped = clamp(n)
    const mutationVersion = ++mutationVersionRef.current
    const ownerId = user.id
    setTargetState(clamped)

    // 빠른 연속 변경도 DB에는 선택 순서대로 저장한다.
    const update = updateQueueRef.current.then(async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ stamp_target: clamped })
        .eq('user_id', ownerId)

      // 조회 대상이 바뀌었다면 이전 화면의 요청으로 현재 화면을 갱신하지 않는다.
      if (queryUserIdRef.current !== ownerId) return

      if (error) {
        console.error('[스탬프목표] 저장 실패', error)
        if (mutationVersionRef.current === mutationVersion) {
          setTargetState(confirmedTargetRef.current)
        }
      } else {
        confirmedTargetRef.current = clamped
      }
    })

    // 한 요청의 실패가 뒤에 예약된 저장을 막지 않도록 큐는 항상 이어간다.
    updateQueueRef.current = update.catch(() => {})
    return update
  }

  return { target, setTarget, loading }
}
