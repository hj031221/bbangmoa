// 이동수단별 소요시간(분) 근사 계산. 경로알고리즘.html §2를 그대로 이식한 것.
import { haversineKm } from './distance.js'
import { fetchDriving, fetchDrivingMultiWaypoint } from '../api/kakaoMobility.js'
import { fetchTransit } from '../api/odsay.js'
import { findNearbyParking } from '../api/kakaoLocal.js'

const SPEED = { walk: 4, car: 24 } // km/h
const DETOUR = 1.3 // 직선거리 → 실제 도로 보정 계수

// 두 좌표({lat,lng}) 사이 이동시간(분) 근사치. mode: 'car' | 'transit' | 'walk'
export function travelMin(a, b, mode) {
  const km = haversineKm(a, b) * DETOUR
  if (mode === 'transit') return Math.round((km / SPEED.car) * 60 * 1.4 + 6)
  return Math.round((km / SPEED[mode]) * 60)
}

// 두 좌표 사이 거리(km) 근사치 — travelMin()과 짝을 이루는 거리 버전. 실API가 없거나 실패했을 때
// 이 값이 폴백으로 쓰인다(직선거리를 그대로 안 쓰고 DETOUR로 보정).
export function estimateKm(a, b) {
  return haversineKm(a, b) * DETOUR
}

// CP11-4 — 목적지 좌표 그대로는 도로망을 못 찾는 지점(대청호 같은 호수·공원 초입, 카카오
// result_code 103/전체 실패)이 실제로 있다. 그 지점 근처(findNearbyParking)에 차로 실제 갈 수
// 있는 대체 지점을 찾아 재시도한다 — "① 직행 시도 → ② 실패 시 근처 대체 지점으로 재시도 →
// ③ 그것도 안 되면 어림값" 사다리 중 ②단계. 자동차 전용(대중교통엔 "주차장 대체 지점" 개념이
// 안 맞아 적용 안 함).
async function fetchDrivingWithSubstitute(a, b) {
  const direct = await fetchDriving(a, b)
  if (direct) return direct

  const subB = await findNearbyParking(b.lat, b.lng)
  if (subB) {
    const viaB = await fetchDriving(a, subB)
    if (viaB) return viaB
  }
  const subA = await findNearbyParking(a.lat, a.lng)
  if (subA) {
    const viaA = await fetchDriving(subA, b)
    if (viaA) return viaA
  }
  return null
}

// 구간마다 따로 fetchLeg()를 불러 이어붙인다(폴백 경로). 구간 하나가 실패해도(예: 호수·공원 등
// 도로망을 못 찾는 지점) 그 구간만 estimateKm/travelMin 근사치로 메우고 나머지는 실API 값을 쓴다.
// 전 구간이 다 실패했을 때만 null.
// legEstimated[i] — 그 구간이 실API 값인지(false) 근사치 폴백인지(true)를 명시적으로 표시한다.
// (예전엔 legPaths[i]가 채워져 있는지로 지도의 실선/점선을 판정했는데, 폴백도 항상
// [출발점,도착점] 2점짜리 배열을 채워 넣어서 실측처럼 항상 실선으로 보이던 버그가 있었다 — 이제
// "이 구간이 추정인가"를 별도 값으로 명시해서 지도가 정확히 구분할 수 있게 한다.)
async function estimateLegByLeg(fetchLeg, points, travelMode) {
  const legs = []
  for (let i = 0; i < points.length - 1; i++) legs.push(fetchLeg(points[i], points[i + 1]))
  const results = await Promise.all(legs)
  if (results.every((r) => r == null)) return null

  let totalMinutes = 0
  let totalDistanceKm = 0
  const legPaths = []
  const legDistancesKm = []
  const legMinutes = []
  const legEstimated = []
  for (let i = 0; i < results.length; i++) {
    const leg = results[i]
    if (leg) {
      const km = Number.isFinite(leg.distanceKm) ? leg.distanceKm : estimateKm(points[i], points[i + 1])
      totalMinutes += leg.minutes
      totalDistanceKm += km
      legDistancesKm.push(km)
      legMinutes.push(leg.minutes)
      legPaths.push(leg.path && leg.path.length > 0 ? leg.path : [points[i], points[i + 1]])
      legEstimated.push(false)
    } else {
      const min = travelMin(points[i], points[i + 1], travelMode)
      const km = estimateKm(points[i], points[i + 1])
      totalMinutes += min
      totalDistanceKm += km
      legDistancesKm.push(km)
      legMinutes.push(min)
      legPaths.push([points[i], points[i + 1]])
      legEstimated.push(true)
    }
  }
  return { totalMinutes, totalDistanceKm, legPaths, legDistancesKm, legMinutes, legEstimated }
}

// CP6-4/CP11-4 — origin→stops 순서의 총 이동시간(분)·거리(km) + 구간별 실제 경로 좌표를 실API로
// 구한다. 도보는 실API를 안 붙인다(근사로 충분, §08) → legPaths도 항상 직선(폴백)이다.
// 자동차는 다중 경유지 API(한 번의 호출로 전체 동선을 한 번에 계산)를 먼저 시도하고, 그게
// 실패하면(코스 중 한 곳이라도 도로망을 못 찾으면 전체가 실패하는 게 카카오 쪽 제약이라 실제로
// 겪음) 구간별 개별 호출(대체 지점 재시도 포함)로 폴백한다. 대중교통은 다중 경유지 API가 없어
// 처음부터 구간별로 부른다. 전 구간이 다 실패했을 때만(키 미설정·인증 실패 등) null — 호출부가
// 근사치로 폴백.
// → { totalMinutes, totalDistanceKm, legPaths, legDistancesKm, legMinutes, legEstimated } | null
export async function estimateActualRoute(origin, orderedStops, travelMode) {
  if (orderedStops.length === 0) return null
  const points = [origin, ...orderedStops]

  if (travelMode === 'car') {
    const multi = await fetchDrivingMultiWaypoint(points)
    if (multi) {
      return {
        totalMinutes: multi.minutes,
        totalDistanceKm: multi.distanceKm,
        legPaths: multi.legPaths,
        legDistancesKm: multi.legDistancesKm,
        legMinutes: multi.legMinutes,
        legEstimated: multi.legPaths.map(() => false), // 다중경유지 성공 = 전 구간 실측
      }
    }
    return estimateLegByLeg(fetchDrivingWithSubstitute, points, travelMode)
  }
  if (travelMode === 'transit') {
    return estimateLegByLeg(fetchTransit, points, travelMode)
  }
  return null
}
