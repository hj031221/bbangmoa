// 이동수단별 소요시간(분) 근사 계산. 경로알고리즘.html §2를 그대로 이식한 것.
import { haversineKm } from './distance.js'
import { fetchDriving, fetchDrivingMultiWaypoint } from '../api/kakaoMobility.js'
import { fetchTransit } from '../api/odsay.js'

const SPEED = { walk: 4, car: 24 } // km/h
const DETOUR = 1.3 // 직선거리 → 실제 도로 보정 계수

// 두 좌표({lat,lng}) 사이 이동시간(분) 근사치. mode: 'car' | 'transit' | 'walk'
export function travelMin(a, b, mode) {
  const km = haversineKm(a, b) * DETOUR
  if (mode === 'transit') return Math.round((km / SPEED.car) * 60 * 1.4 + 6)
  return Math.round((km / SPEED[mode]) * 60)
}

// 구간마다 따로 fetchLeg()를 불러 이어붙인다(폴백 경로). 구간 하나가 실패해도(예: 호수·공원 등
// 도로망을 못 찾는 지점 — 카카오 result_code 103 같은 경우가 실제로 있다) 그 구간만 travelMin
// 근사치 + 직선으로 메우고 나머지는 실API 값을 쓴다. 전 구간이 다 실패했을 때만 null.
async function estimateLegByLeg(fetchLeg, points, travelMode) {
  const legs = []
  for (let i = 0; i < points.length - 1; i++) legs.push(fetchLeg(points[i], points[i + 1]))
  const results = await Promise.all(legs)
  if (results.every((r) => r == null)) return null

  let totalMinutes = 0
  const legPaths = []
  for (let i = 0; i < results.length; i++) {
    const leg = results[i]
    if (leg) {
      totalMinutes += leg.minutes
      legPaths.push(leg.path && leg.path.length > 0 ? leg.path : [points[i], points[i + 1]])
    } else {
      totalMinutes += travelMin(points[i], points[i + 1], travelMode)
      legPaths.push([points[i], points[i + 1]])
    }
  }
  return { totalMinutes, legPaths }
}

// CP6-4 — origin→stops 순서의 총 이동시간(분) + 구간별 실제 경로 좌표를 실API로 구한다.
// 도보는 실API를 안 붙인다(근사로 충분, §08) → legPaths도 항상 직선(폴백)이다.
// 자동차는 다중 경유지 API(한 번의 호출로 전체 동선을 한 번에 계산 — §다른 사이트 사례 참고)를
// 먼저 시도하고, 그게 실패하면(코스 중 한 곳이라도 도로망을 못 찾으면 전체가 실패하는 게 카카오 쪽
// 제약이라 실제로 겪음) 구간별 개별 호출로 폴백한다. 대중교통은 다중 경유지 API가 없어 처음부터
// 구간별로 부른다. 전 구간이 다 실패했을 때만(키 미설정·인증 실패 등) null — 호출부가 근사치로 폴백.
// → { totalMinutes, legPaths: [[{lat,lng}, ...], ...] } | null
export async function estimateActualRoute(origin, orderedStops, travelMode) {
  if (orderedStops.length === 0) return null
  const points = [origin, ...orderedStops]

  if (travelMode === 'car') {
    const multi = await fetchDrivingMultiWaypoint(points)
    if (multi) return { totalMinutes: multi.minutes, legPaths: multi.legPaths }
    return estimateLegByLeg(fetchDriving, points, travelMode)
  }
  if (travelMode === 'transit') {
    return estimateLegByLeg(fetchTransit, points, travelMode)
  }
  return null
}
