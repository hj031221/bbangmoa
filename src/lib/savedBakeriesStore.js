// 찜한 빵집 목록의 "단일 진실 원천" (이슈 #80 최종 리뷰 Critical 1).
//
// 왜 모듈 레벨 스토어인가: useSavedBakeries 는 목록을 훅 인스턴스별 useState 로 들고 있었다.
// 한 화면에 이 훅을 쓰는 컴포넌트가 둘 이상 마운트되면(예: BakeryMapPage 목록 + 그 안의
// RecommendCard 상세 카드) 각자 자기 스냅샷을 들고 있다가, 한쪽에서 찜을 토글하면 그쪽 배열만
// 갱신되고 다른 쪽은 낡은 배열을 그대로 들고 있는다. 그 상태에서 다른 쪽에서 또 토글하면
// 낡은 배열 기준으로 계산된 결과가 localStorage 전체를 덮어써 먼저 한 찜이 조용히 사라졌다
// (두 번의 탭으로 재현되는 실제 데이터 유실).
//
// 그래서 목록 자체를 모듈 스코프로 올리고 pub/sub 로 모든 인스턴스에 즉시 방송한다.
// 훅은 useSyncExternalStore 로 이 스냅샷을 구독하므로, 어느 인스턴스에서 토글하든
// (1) 계산 기준이 항상 최신 공유 목록이고 (2) 다른 인스턴스도 같은 프레임에 리렌더된다.
//
// 로그인 상태에서는 이 스토어가 Supabase 조회 결과를 담는 캐시 역할만 하고 localStorage 에는
// 쓰지 않는다(기존 정책 유지) — 그래서 persist 여부를 호출자가 넘긴다.

const STORAGE_KEY = 'bbangmoa_saved'

export function readLocalSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalSaved(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 사파리 프라이빗 모드 등 저장 불가 환경 — 화면 상태는 유지하고 조용히 넘어간다.
  }
}

let state = null // null = 아직 초기화 전(첫 조회 때 localStorage 에서 읽는다)
const listeners = new Set()

// useSyncExternalStore 의 getSnapshot — 값이 바뀌지 않는 한 같은 배열 참조를 돌려줘야 한다.
export function getSavedSnapshot() {
  if (state === null) state = readLocalSaved()
  return state
}

export function subscribeSaved(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit() {
  for (const listener of [...listeners]) listener()
}

// 목록 통째 교체. persist:true 일 때만 localStorage 에 반영한다(로그아웃 상태에서만 사용).
export function setSavedList(list, { persist = false } = {}) {
  state = Array.isArray(list) ? list : []
  if (persist) writeLocalSaved(state)
  emit()
}

// localStorage 기준으로 다시 읽어온다(로그아웃 상태 진입/초기 동기화).
// 내용이 같으면 아무것도 하지 않는다 — 이 함수는 훅이 마운트될 때마다 불리는데, 매번 새 배열로
// 갈아끼우면 구독 중인 모든 컴포넌트가 의미 없이 리렌더된다.
export function reloadSavedFromLocal() {
  const next = readLocalSaved()
  const current = getSavedSnapshot()
  const same = current.length === next.length && current.every((b, i) => b?.id === next[i]?.id)
  if (same) return
  setSavedList(next)
}

// 찜 토글. 계산 기준은 항상 "지금" 공유 스냅샷 — 호출한 컴포넌트가 들고 있던 값이 아니다.
// 반환값의 alreadySaved 로 호출자가 DB insert/delete 를 고른다.
export function toggleSavedBakery(bakery, { persist = false } = {}) {
  const current = getSavedSnapshot()
  const alreadySaved = current.some((b) => b.id === bakery.id)
  const next = alreadySaved
    ? current.filter((b) => b.id !== bakery.id)
    : [...current, bakery]
  setSavedList(next, { persist })
  return { alreadySaved, next }
}
