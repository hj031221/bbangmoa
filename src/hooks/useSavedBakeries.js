import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useAuth } from './useAuth'
import { supabase, supabaseEnabled } from '../lib/supabase'
import {
  getSavedSnapshot,
  reloadSavedFromLocal,
  setSavedList,
  subscribeSaved,
  toggleSavedBakery,
} from '../lib/savedBakeriesStore'

// 리뷰 지적: 공유 스토어(savedBakeriesStore)는 이 훅의 effect(아래, queryUserId 변화)로만
// 로그아웃을 감지했다 — 로그아웃이 일어난 화면에 이 훅을 쓰는 컴포넌트가 하나도 마운트돼
// 있지 않으면(예: 찜 목록 UI가 없는 설정 화면에서 로그아웃) 그 effect가 안 돌아, 공유 상태가
// 이전 계정의 DB 조회 결과를 그대로 들고 있다가 다음 마운트 첫 렌더에 그대로 노출된다.
// 모듈 스코프에 두면(ES 모듈은 한 번만 평가됨) 컴포넌트 마운트 여부와 무관하게 앱 수명
// 동안 항상 구독이 켜져 있다 — supabase 의존성이 있는 이 훅 파일에 둬서 savedBakeriesStore.js
// 는 계속 supabase 없이 node --test 로 순수 로직만 검증하는 경계를 유지한다.
if (supabaseEnabled()) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) reloadSavedFromLocal()
  })
}

// 찜한 빵집 저장 훅.
//   로그아웃 상태: localStorage(브라우저별) 기반.
//   로그인 상태: Supabase saved_bakeries 테이블(계정별, 기기 간 동기화).
//     로컬 목록과는 합치지 않고, 로그인 시점부터 계정 DB 기준으로 새로 시작한다.
//   targetUserId 가 있으면(친구 목록 읽기 전용 조회) 그 id 로만 조회하고 로컬스토리지·공유
//     스토어는 건드리지 않는다(읽기 전용이라 toggleSave 도 no-op).
//
// 이슈 #80 최종 리뷰 Critical 1: 내 찜 목록은 훅 인스턴스별 useState 가 아니라 모듈 레벨
// 공유 스토어(lib/savedBakeriesStore)에 둔다. 같은 화면에 이 훅이 두 번 이상 마운트돼도
// (BakeryMapPage 목록 + RecommendCard 상세 카드) 모두 같은 목록을 보고, 한쪽 토글이 즉시
// 다른 쪽에도 반영돼 서로의 저장을 덮어쓰지 않는다.
export function useSavedBakeries(targetUserId) {
  const { user } = useAuth()
  const queryUserId = targetUserId ?? user?.id
  const sharedSaved = useSyncExternalStore(subscribeSaved, getSavedSnapshot, getSavedSnapshot)
  // 친구 목록은 "내 찜"과 별개 데이터라 공유 스토어에 섞지 않고 인스턴스 로컬로 둔다.
  const [friendSaved, setFriendSaved] = useState([])
  const saved = targetUserId ? friendSaved : sharedSaved

  useEffect(() => {
    if (!queryUserId) {
      reloadSavedFromLocal()
      return undefined
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
        const rows = data.map((row) => row.bakery)
        // DB 결과는 localStorage 에 남기지 않는다(로그아웃하면 로그인 전 로컬 목록으로 복귀).
        if (targetUserId) setFriendSaved(rows)
        else setSavedList(rows, { persist: false })
      })
    return () => {
      alive = false
    }
  }, [queryUserId, targetUserId])

  const toggleSave = useCallback(
    (bakery) => {
      if (targetUserId) return // 친구 목록은 읽기 전용
      // 계산 기준은 스토어의 현재 스냅샷 — 이 컴포넌트가 마지막으로 렌더한 값이 아니다.
      const { alreadySaved } = toggleSavedBakery(bakery, { persist: !user })
      if (!user) return

      if (alreadySaved) {
        supabase
          .from('saved_bakeries')
          .delete()
          .eq('user_id', user.id)
          .eq('bakery_id', bakery.id)
          .then(({ error }) => error && console.error('[saved] DB 삭제 실패', error))
      } else {
        supabase
          .from('saved_bakeries')
          .insert({ user_id: user.id, bakery_id: bakery.id, bakery })
          .then(({ error }) => error && console.error('[saved] DB 저장 실패', error))
      }
    },
    [user, targetUserId],
  )

  // 목록이 그대로면 같은 함수 참조를 유지한다 — 이 함수를 useMemo/useEffect deps 에 넣는
  // 쪽(MapView 등)이 매 렌더마다 재계산하지 않게.
  const isSaved = useCallback((id) => saved.some((b) => b.id === id), [saved])

  return { saved, toggleSave, isSaved }
}
