import { haversineKm, hasValidCoords } from './distance.js'

// 방문 인증 반경(m). 서버 create_diary_entry RPC의 `v_distance_m <= 150`과 같은 값이어야 한다
// (supabase/schema.sql) — 바꿀 땐 양쪽을 같이 바꾼다.
export const VISIT_RADIUS_M = 150

// 내 위치(coords: {lat,lng,accuracy?})와 빵집 사이 거리로 인증 범위 안/밖을 미리 계산한다.
// 서버는 bakery_coords(신뢰 좌표)로 판정하므로 이건 "예상"일 뿐이다 — 문구도 보장처럼 쓰지 않는다.
// → { distanceM, inside, lowAccuracy } | null (좌표가 없으면)
export function visitRadiusStatus(coords, bakery) {
  if (!hasValidCoords(coords) || !hasValidCoords(bakery)) return null
  const distanceM = haversineKm(coords, bakery) * 1000
  return {
    distanceM,
    inside: distanceM <= VISIT_RADIUS_M,
    lowAccuracy: Number.isFinite(coords.accuracy) && coords.accuracy > VISIT_RADIUS_M,
  }
}

function roundM(m) {
  return m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50
}

function formatM(m) {
  const r = roundM(m)
  return r >= 1000 ? `${(r / 1000).toFixed(1)}km` : `${r}m`
}

// 상태 → 화면 문구. status가 null이면 null.
export function visitRadiusMessage(status) {
  if (!status) return null
  const base = status.inside
    ? `인증 범위 안이에요 · 빵집까지 약 ${formatM(status.distanceM)}`
    : `인증 범위까지 약 ${formatM(status.distanceM - VISIT_RADIUS_M)} 남았어요`
  return status.lowAccuracy ? `${base} (위치 정확도가 낮아 달라질 수 있어요)` : base
}
