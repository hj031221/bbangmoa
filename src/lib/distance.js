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

// 좌표 배열을 순서대로 이은 폴리라인의 총 길이(km) — 구간 거리를 실측 필드 없이 근사 배분할 때
// "실제 길이"를 가중치로 쓰기 위한 것(꼭짓점 개수는 거리와 무관해서 가중치로 쓰면 안 됨).
export function pathLengthKm(path) {
  let km = 0
  for (let i = 0; i + 1 < path.length; i++) km += haversineKm(path[i], path[i + 1])
  return km
}

// 경로 좌표 배열의 중점. points[Math.floor(length/2)]로 인덱스만 고르면, 2점짜리(직선 폴백)
// 배열에선 index 1 = 도착점이라 라벨이 중점이 아니라 목적지 핀 위에 겹쳐 그려지는 문제가 있다.
// 짝수 길이면 가운데 두 점의 실제 좌표 평균을 쓴다.
export function midpointOf(points) {
  if (points.length === 1) return points[0]
  const half = Math.floor(points.length / 2)
  if (points.length % 2 === 0) {
    const a = points[half - 1]
    const b = points[half]
    return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
  }
  return points[half]
}
