import { haversineKm } from './distance.js'

// GPS로 받은 원본 좌표는 코스 저장 시 서버(Supabase)로 절대 보내지 않는다 — 가장 가까운
// 프리셋 지점으로 치환해서 저장한다(#39). 위치정보법상 "서버로 전송하는 자체만으로" 신고
// 대상이 될 수 있다는 기준(위치정보지원센터 안내) 때문에, 원본 좌표가 우리 서버로 아예
// 들어가지 않게 막는 것이 목적이다. preset/pick/search는 사용자가 능동적으로 고른 지점이라
// (자동 취득 개인위치정보가 아님) 그대로 저장한다.
export function sanitizeOriginForSave(origin, region) {
  if (!origin || origin.source !== 'gps') return origin
  const presets = region?.origins ?? []
  if (presets.length === 0) return origin

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
