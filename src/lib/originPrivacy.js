import { haversineKm } from './distance.js'

// GPS로 받은 원본 좌표는 코스 저장 시 서버(Supabase)로 절대 보내지 않는다(#39) — 위치정보법상
// "서버로 전송하는 자체만으로" 신고 대상이 될 수 있다는 기준(위치정보지원센터 안내) 때문이다.
// preset/pick/search는 사용자가 능동적으로 고른 지점이라(자동 취득 개인위치정보가 아님) 그대로
// 저장한다.
//
// fail-safe: 가장 가까운 프리셋으로 치환하는 게 기본이지만, 프리셋이 비어있는 지역(예: 아직
// 프리셋을 안 채운 신규 도시)이라도 원본 좌표를 그대로 통과시키면 안 된다 — 그 경우 지역
// 대표 좌표(region.center, 모든 REGIONS 항목에 항상 존재)로 대체한다. region 자체가 없는
// 이론상 도달 불가능한 상황에서도 원본을 내보내지 않고 null을 반환해 저장을 막는다("복구
// 불가능하면 안전한 쪽으로 실패").
export function sanitizeOriginForSave(origin, region) {
  if (!origin || origin.source !== 'gps') return origin

  const presets = region?.origins ?? []
  if (presets.length > 0) {
    let nearest = presets[0]
    let best = haversineKm(origin, nearest)
    for (const p of presets.slice(1)) {
      const d = haversineKm(origin, p)
      if (d < best) {
        best = d
        nearest = p
      }
    }
    return { lat: nearest.lat, lng: nearest.lng, label: nearest.name, source: 'preset' }
  }

  if (region?.center) {
    return { lat: region.center.lat, lng: region.center.lng, label: region.label || '지역 대표 위치', source: 'preset' }
  }

  return null
}
