// 이동수단별 소요시간(분) 근사 계산. 경로알고리즘.html §2를 그대로 이식한 것.
import { haversineKm } from './distance.js'
import { fetchDrivingMinutes } from '../api/kakaoMobility.js'
import { fetchTransitMinutes } from '../api/odsay.js'

const SPEED = { walk: 4, car: 24 } // km/h
const DETOUR = 1.3 // 직선거리 → 실제 도로 보정 계수

// 두 좌표({lat,lng}) 사이 이동시간(분) 근사치. mode: 'car' | 'transit' | 'walk'
export function travelMin(a, b, mode) {
  const km = haversineKm(a, b) * DETOUR
  if (mode === 'transit') return Math.round((km / SPEED.car) * 60 * 1.4 + 6)
  return Math.round((km / SPEED[mode]) * 60)
}

// CP6-4 — origin→stops 순서의 총 이동시간(분)을 실API로 구한다.
// 도보는 실API를 안 붙인다(근사로 충분, §08).
// 구간 하나가 실패해도(예: 호수·공원 등 도로망을 못 찾는 지점 — 카카오 result_code 103 같은 경우가
// 실제로 있다) 그 구간만 travelMin 근사치로 메우고 나머지는 실API 값을 쓴다. 전 구간이 다 실패했을
// 때만(키 미설정·인증 실패 등) null을 돌려줘서 호출부가 근사치 합계로 완전히 폴백하게 한다.
export async function estimateActualMinutes(origin, orderedStops, travelMode) {
  const fetchLeg =
    travelMode === 'car' ? fetchDrivingMinutes : travelMode === 'transit' ? fetchTransitMinutes : null
  if (!fetchLeg || orderedStops.length === 0) return null

  const points = [origin, ...orderedStops]
  const legs = []
  for (let i = 0; i < points.length - 1; i++) legs.push(fetchLeg(points[i], points[i + 1]))

  const results = await Promise.all(legs)
  if (results.every((m) => m == null)) return null

  let total = 0
  for (let i = 0; i < results.length; i++) {
    total += results[i] ?? travelMin(points[i], points[i + 1], travelMode)
  }
  return total
}
