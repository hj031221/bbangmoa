// 이동수단별 소요시간(분) 근사 계산. 경로알고리즘.html §2를 그대로 이식한 것.
import { haversineKm } from './distance.js'
import { fetchDriving, fetchDrivingMultiWaypoint } from '../api/kakaoMobility.js'
import { fetchWalking, fetchWalkingMultiWaypoint } from '../api/tmap.js'
import { findNearbyParking } from '../api/kakaoLocal.js'

const SPEED = { walk: 4.5, car: 24 } // km/h — walk는 TMAP 실측 평균(4.49)과 일치하도록 확정(#53)
const DETOUR = 1.3 // 직선거리 → 실제 도로 보정 계수(car/transit 공용)
// 도보 전용 보정 계수 — TMAP(중앙값 1.52)과 Valhalla/OSM(중앙값 1.55) 독립 교차검증으로 확정(#53).
// car용 DETOUR(1.3)를 그대로 쓰면 실제보다 항상 적게 나온다(대전 산·호수·공원 구간에서 특히).
const WALK_DETOUR = 1.52

// 두 좌표({lat,lng}) 사이 이동시간(분) 근사치. mode: 'car' | 'transit' | 'walk'
export function travelMin(a, b, mode) {
  const km = haversineKm(a, b) * (mode === 'walk' ? WALK_DETOUR : DETOUR)
  if (mode === 'transit') return Math.round((km / SPEED.car) * 60 * 1.4 + 6)
  return Math.round((km / SPEED[mode]) * 60)
}

// 두 좌표 사이 거리(km) 근사치 — travelMin()과 짝을 이루는 거리 버전. 실API가 없거나 실패했을 때
// 이 값이 폴백으로 쓰인다(직선거리를 그대로 안 쓰고 DETOUR로 보정). mode 기본값 'car'는 기존
// 호출부(자동차 전용 대체 지점 계산 등)와의 호환 — travelMin과 짝 맞춰 walk만 다른 계수를 쓴다.
export function estimateKm(a, b, mode = 'car') {
  return haversineKm(a, b) * (mode === 'walk' ? WALK_DETOUR : DETOUR)
}

// CP11-4 — 목적지 좌표 그대로는 도로망을 못 찾는 지점(대청호 같은 호수·공원 초입, 카카오
// result_code 103/전체 실패)이 실제로 있다. 그 지점 근처(findNearbyParking)에 차로 실제 갈 수
// 있는 대체 지점을 찾아 재시도한다 — "① 직행 시도 → ② 실패 시 근처 대체 지점으로 재시도 →
// ③ 그것도 안 되면 어림값" 사다리 중 ②단계. 자동차 전용(대중교통엔 "주차장 대체 지점" 개념이
// 안 맞아 적용 안 함).
async function fetchDrivingWithSubstitute(a, b) {
  const direct = await fetchDriving(a, b)
  if (direct) return direct

  // findNearbyParking()은 getJson()이 비2xx 응답에 throw하는 걸 그대로 물려받는다 — 여기서
  // 안 잡으면 estimateLegByLeg()의 Promise.all()이 이 leg 하나 때문에 전체 reject되어, 결과
  // 화면이 아무 에러 표시 없이 조용히 멈춘다(리뷰로 발견). 대체 지점 검색 실패는 그냥 다음
  // 단계(첫 결과 없음)로 넘어가면 되는 상황이라 여기서 흡수한다.
  try {
    const subB = await findNearbyParking(b.lat, b.lng)
    if (subB) {
      const viaB = await fetchDriving(a, subB)
      if (viaB) return appendLastMile(viaB, subB, b)
    }
  } catch {
    // 다음 단계(subA)로 계속 진행
  }
  try {
    const subA = await findNearbyParking(a.lat, a.lng)
    if (subA) {
      const viaA = await fetchDriving(subA, b)
      if (viaA) return prependFirstMile(viaA, a, subA)
    }
  } catch {
    // 아래 return null로 자연히 폴백
  }
  return null
}

// 대체 지점(주차장)까지는 실API로 구했어도, 그 지점→실제 목적지 구간은 실API로 다시 못 구한다
// (그 지점 자체가 도로망 탐색 실패 지점 근처라 재시도해도 또 실패할 공산이 큼). 이 구간을 안
// 더하면 "대체 지점까지"만 반영되고 마지막 구간이 통째로 빠져 거리가 다시 과소평가된다(이 PR이
// 고치려는 문제가 형태만 바꿔 재발 — 리뷰로 발견) → DETOUR 보정 어림값으로 채워 합산하고, 이
// leg 전체를 "추정 포함"(estimated:true)으로 표시한다.
function appendLastMile(real, substitutePoint, actualPoint) {
  const lastKm = estimateKm(substitutePoint, actualPoint)
  const lastMin = travelMin(substitutePoint, actualPoint, 'car')
  return {
    minutes: real.minutes + lastMin,
    distanceKm: Number.isFinite(real.distanceKm) ? real.distanceKm + lastKm : null,
    path: real.path && real.path.length > 0 ? [...real.path, actualPoint] : null,
    estimated: true,
  }
}

// origin 쪽이 도로망 탐색 실패 지점이라 대체 지점을 앞에 붙인 경우 — 실제 출발지→대체 지점
// 구간이 위와 같은 이유로 빠져있어 앞쪽에 채워 넣는다.
function prependFirstMile(real, actualPoint, substitutePoint) {
  const firstKm = estimateKm(actualPoint, substitutePoint)
  const firstMin = travelMin(actualPoint, substitutePoint, 'car')
  return {
    minutes: real.minutes + firstMin,
    distanceKm: Number.isFinite(real.distanceKm) ? real.distanceKm + firstKm : null,
    path: real.path && real.path.length > 0 ? [actualPoint, ...real.path] : null,
    estimated: true,
  }
}

// 구간마다 따로 fetchLeg()를 불러 이어붙인다(폴백 경로). 구간 하나가 실패해도(예: 호수·공원 등
// 도로망을 못 찾는 지점) 그 구간만 estimateKm/travelMin 근사치로 메우고 나머지는 실API 값을 쓴다.
// 전 구간이 다 실패했을 때만 null.
// legMinutesEstimated[i]/legDistanceEstimated[i] — 그 구간의 시간·거리 각각이 실API 값인지(false)
// 근사치 폴백인지(true)를 따로 표시한다. 왜 따로냐면: 대중교통(fetchTransit/odsay.js)은 시간은
// 항상 실API로 주지만 distanceKm 필드 자체가 없어 거리는 항상 estimateKm() 폴백이다 — 이걸 한
// 값으로 합쳐 버리면 대중교통 모드에서 "시간은 실측인데 거리는 매번 추정"인 사실을 표현할 수
// 없다(리뷰 발견: 이 분리 전엔 leg.estimated가 undefined→false로 잡혀 대중교통 거리가 항상
// "실측"으로 잘못 표시됐다). legEstimated(지도 실선/점선용)는 이 둘 중 하나라도 추정이면
// true — 지도는 "이 구간 숫자에 하나라도 지어낸 값이 섞였나"만 보면 되기 때문이다.
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
  const legMinutesEstimated = []
  const legDistanceEstimated = []
  for (let i = 0; i < results.length; i++) {
    const leg = results[i]
    if (leg) {
      const distanceReal = Number.isFinite(leg.distanceKm)
      const km = distanceReal ? leg.distanceKm : estimateKm(points[i], points[i + 1], travelMode)
      totalMinutes += leg.minutes
      totalDistanceKm += km
      legDistancesKm.push(km)
      legMinutes.push(leg.minutes)
      legPaths.push(leg.path && leg.path.length > 0 ? leg.path : [points[i], points[i + 1]])
      // leg.estimated — fetchDrivingWithSubstitute가 대체 지점을 써서 시간·거리 둘 다 일부
      // 어림값을 섞은 경우 true. distanceReal이 false면(대중교통처럼 애초에 API가 거리를
      // 안 주는 경우) leg.estimated와 무관하게 거리는 항상 추정이다.
      legMinutesEstimated.push(!!leg.estimated)
      legDistanceEstimated.push(!!leg.estimated || !distanceReal)
    } else {
      const min = travelMin(points[i], points[i + 1], travelMode)
      const km = estimateKm(points[i], points[i + 1], travelMode)
      totalMinutes += min
      totalDistanceKm += km
      legDistancesKm.push(km)
      legMinutes.push(min)
      legPaths.push([points[i], points[i + 1]])
      legMinutesEstimated.push(true)
      legDistanceEstimated.push(true)
    }
  }
  const legEstimated = legMinutesEstimated.map((t, i) => t || legDistanceEstimated[i])
  return {
    totalMinutes,
    totalDistanceKm,
    legPaths,
    legDistancesKm,
    legMinutes,
    legMinutesEstimated,
    legDistanceEstimated,
    legEstimated,
  }
}

// CP6-4/CP11-4/CP12 — origin→stops 순서의 총 이동시간(분)·거리(km) + 구간별 실제 경로 좌표를
// 실API로 구한다.
// 자동차는 다중 경유지 API(한 번의 호출로 전체 동선을 한 번에 계산)를 먼저 시도하고, 그게
// 실패하면(코스 중 한 곳이라도 도로망을 못 찾으면 전체가 실패하는 게 카카오 쪽 제약이라 실제로
// 겪음) 구간별 개별 호출(대체 지점 재시도 포함)로 폴백한다.
// 도보는 TMAP 보행자 API(passList, 다중 경유지와 같은 방식)를 먼저 시도하고, 실패하면(대청호
// 외곽 등 ~6.7% 확률로 실측됨) 구간별 개별 호출로 폴백한다.
// 대중교통은 CP12부터 런타임 API 호출을 안 한다(ODsay 무료 쿼터 일 30건 — 실측 확인, 코스
// 계산마다 부르면 하루 7코스만에 소진돼 항상 null) → 항상 null 반환, 호출부가 보정된 근사치를
// 쓰고 화면은 카카오맵 링크로 정확한 정보를 안내한다.
// 전 구간이 다 실패했을 때만(키 미설정·인증 실패 등) null — 호출부가 근사치로 폴백.
// → { totalMinutes, totalDistanceKm, legPaths, legDistancesKm, legMinutes,
//     legMinutesEstimated, legDistanceEstimated, legEstimated, taxiFare? } | null
//   (taxiFare는 car 모드 다중경유지 성공 시에만 옴 — "버스 vs 택시" 비교용, CP12)
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
        // multi.legEstimated — section별 distance/duration이 없어 총계를 비례 분배한 구간은
        // 여기서도 true로 온다(전엔 다중경유지 성공이면 무조건 false로 하드코딩해서, 비례
        // 분배한 근사값 구간까지 실측처럼 지도에 실선으로 그려졌음). 카카오 다중경유지 API는
        // 시간·거리를 항상 같은 방식(section 필드 or 비례분배)으로 같이 주므로 자동차 경로는
        // 시간/거리 추정 여부가 항상 같이 움직인다 — 대중교통(estimateLegByLeg 쪽)만 둘이
        // 갈라진다.
        legMinutesEstimated: multi.legEstimated,
        legDistanceEstimated: multi.legEstimated,
        legEstimated: multi.legEstimated,
        taxiFare: multi.taxiFare, // CP12 — "버스 vs 택시" 비교용. 폴백 경로엔 없음(대체 지점 재시도 API는 fare를 안 줌).
      }
    }
    return estimateLegByLeg(fetchDrivingWithSubstitute, points, travelMode)
  }
  if (travelMode === 'walk') {
    const multi = await fetchWalkingMultiWaypoint(points)
    if (multi) {
      return {
        totalMinutes: multi.minutes,
        totalDistanceKm: multi.distanceKm,
        legPaths: multi.legPaths,
        legDistancesKm: multi.legDistancesKm,
        legMinutes: multi.legMinutes,
        // TMAP passList는 구간별 실측을 그대로 준다(검증됨, 카카오처럼 비례분배 근사가 섞일
        // 일이 없음) — legEstimated는 전 구간 false로 온다.
        legMinutesEstimated: multi.legEstimated,
        legDistanceEstimated: multi.legEstimated,
        legEstimated: multi.legEstimated,
      }
    }
    // passList 호출이 실패해도(경유지 중 한 곳이 대청호 외곽처럼 TMAP이 못 찾는 지점일 수
    // 있음, ~6.7% 확률로 실측 확인) 구간별 fetchWalking()으로 폴백 — 실패한 구간만
    // estimateLegByLeg의 근사치로 메운다.
    return estimateLegByLeg(fetchWalking, points, travelMode)
  }
  // transit — CP12: ODsay 무료 쿼터가 일 30건뿐이라(실측 확인) 코스 계산마다 런타임 호출하면
  // 하루 7코스만에 소진돼 이후 전부 조용히 추정으로 폴백하는 문제가 있었다. 런타임 호출 자체를
  // 걷어내고 항상 보정된 근사치(travelMin/estimateKm)를 쓴다 — 정확한 시간표는 화면의 카카오맵
  // 링크로 안내한다(PilgrimagePage.jsx). odsay.js는 지우지 않는다 — 쿼터가 복구되면 되살릴 수 있게.
  return null
}
