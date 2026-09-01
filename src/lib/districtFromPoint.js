import { DISTRICT_RINGS } from '../data/daejeonDistricts.js'

// ray-casting 홀짝 판정. ring = [[lat,lng], …]. lat 을 y, lng 을 x 로 취급한다
// (ray-casting 은 좌표계 방향과 무관하므로 축을 뒤집어도 결과가 같다).
function pointInRing(lat, lng, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0]
    const xi = ring[i][1]
    const yj = ring[j][0]
    const xj = ring[j][1]
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// 좌표를 대전 5개 구 중 하나로 분류. 어느 구에도 안 들어가면 null.
// DISTRICT_RINGS 삽입 순서로 순회하며 첫 번째로 포함하는 구를 반환한다(경계 공유 시 결정적).
export function districtOf(point) {
  if (!point) return null
  const { lat, lng } = point
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  for (const [name, ring] of Object.entries(DISTRICT_RINGS)) {
    if (pointInRing(lat, lng, ring)) return name
  }
  return null
}
