import { haversineKm, isWithinBbox } from './distance.js'

export function nearestAttraction(bakery, spots, { maxKm = Infinity } = {}) {
  if (!Number.isFinite(bakery?.lat) || !Number.isFinite(bakery?.lng)) return null
  let best = null
  for (const spot of spots) {
    if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) continue
    const km = haversineKm(bakery, spot)
    if (km <= maxKm && (!best || km < best.km)) best = { name: spot.name, lat: spot.lat, lng: spot.lng, km }
  }
  return best
}

export function resolveMapSelection(bakeries, selectedId, recommendationMode = false) {
  return bakeries.find((b) => b.id === selectedId) || (recommendationMode ? bakeries[0] : null) || null
}

export function mapLocationNotice({ origin, status, coords, label, bbox }) {
  if (origin) return '출발: ' + (origin.label || origin.name || '선택한 위치') + ' · 가까운 순'
  if (status === 'ready' && coords) return isWithinBbox(coords, bbox)
    ? '현재 위치 기준 거리' + (label ? ' · ' + label : '')
    : '현재 위치가 대전 밖이에요 · 역 기준 거리로 표시'
  if (status === 'denied') return '위치 접근이 허용되지 않았어요 · 역 기준 거리로 표시'
  if (status === 'unsupported') return '현재 위치를 지원하지 않아요 · 역 기준 거리로 표시'
  return '현재 위치 확인 중 · 역 기준 거리로 표시'
}
