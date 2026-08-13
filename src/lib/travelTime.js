// 이동수단별 소요시간(분) 근사 계산. 경로알고리즘.html §2를 그대로 이식한 것.
// 실API(카카오모빌리티·ODsay) 붙기 전까지 쓰는 근사치 — CP6-4에서 대체 예정.
import { haversineKm } from './distance.js'

const SPEED = { walk: 4, car: 24 } // km/h
const DETOUR = 1.3 // 직선거리 → 실제 도로 보정 계수

// 두 좌표({lat,lng}) 사이 이동시간(분). mode: 'car' | 'transit' | 'walk'
export function travelMin(a, b, mode) {
  const km = haversineKm(a, b) * DETOUR
  if (mode === 'transit') return Math.round((km / SPEED.car) * 60 * 1.4 + 6)
  return Math.round((km / SPEED[mode]) * 60)
}
