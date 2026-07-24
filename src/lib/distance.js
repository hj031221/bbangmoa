// 좌표 거리 계산 유틸 (하버사인 공식).
function toRad(deg) {
  return (deg * Math.PI) / 180
}

// 두 좌표({lat,lng}) 사이 직선거리(km)
export function haversineKm(a, b) {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

// 좌표가 bbox(지역 경계) 안에 있는지
export function isWithinBbox(coords, bbox) {
  if (!coords || !bbox) return false
  return (
    coords.lat >= bbox.minLat &&
    coords.lat <= bbox.maxLat &&
    coords.lng >= bbox.minLng &&
    coords.lng <= bbox.maxLng
  )
}

// km → "850m" | "1.2km"
export function formatDistance(km) {
  if (!Number.isFinite(km)) return null
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
}
