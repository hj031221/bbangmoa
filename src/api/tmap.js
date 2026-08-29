// CP12 — TMAP 보행자 경로안내 API. 도보 실측용, 무료 키(VITE_TMAP_APP_KEY) 사용.
// 실패하면 null을 반환 — 호출부(travelTime.js)가 근사치로 폴백한다.
// 응답 파싱(구간 분리 등 순수 로직)은 src/lib/tmapParse.js — 그쪽 주석에 구조 설명이 있다.
import { roundToSum } from '../lib/rounding.js'
import { parsePedestrianResponse } from '../lib/tmapParse.js'

const APP_KEY = import.meta.env.VITE_TMAP_APP_KEY
const ENDPOINT = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1'

// points: [{lat,lng}, ...] 최소 2개. passList 상한(경유지 5개)을 넘으면 null.
async function callPedestrianApi(points) {
  if (!APP_KEY || points.length < 2) return null
  const [start, ...rest] = points
  const end = rest[rest.length - 1]
  const passStops = rest.slice(0, -1)
  if (passStops.length > 5) return null

  const body = {
    startX: String(start.lng),
    startY: String(start.lat),
    endX: String(end.lng),
    endY: String(end.lat),
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    startName: '출발',
    endName: '도착',
  }
  if (passStops.length > 0) {
    body.passList = passStops.map((p) => `${p.lng},${p.lat}`).join('_')
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', appKey: APP_KEY },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null // 키 없음/미인증 401 등 — 검증된 실패 형태
    const data = await res.json()
    return parsePedestrianResponse(data, points.length)
  } catch {
    return null
  }
}

// 두 좌표({lat,lng}) 사이 실제 보행 이동시간(분) + 실거리(km) + 실제 보행로 경로 좌표.
// fetchDriving/fetchTransit과 동일한 반환 계약.
// → { minutes, distanceKm, path: [{lat,lng}, ...] } | null
export async function fetchWalking(a, b) {
  const result = await callPedestrianApi([a, b])
  if (!result) return null
  const leg = result.legs[0]
  return {
    minutes: Math.round(leg.timeS / 60),
    distanceKm: leg.distanceM / 1000,
    path: leg.path,
  }
}

// 여러 지점을 한 번의 호출로(passList, 경유지 최대 5개) — fetchDrivingMultiWaypoint와 같은 계약.
// 구간별 거리·시간이 실측으로 정확히 분리된다(검증됨) — 카카오 다중경유지의
// hasSectionMetrics===false 비례분배 폴백 같은 게 필요 없다(항상 실측).
// → { minutes, distanceKm, legPaths, legDistancesKm, legMinutes, legEstimated } | null
export async function fetchWalkingMultiWaypoint(points) {
  const result = await callPedestrianApi(points)
  if (!result) return null
  const totalMinutes = Math.round(result.totalTime / 60)
  return {
    minutes: totalMinutes,
    distanceKm: result.totalDistance / 1000,
    legPaths: result.legs.map((l) => l.path),
    legDistancesKm: result.legs.map((l) => l.distanceM / 1000),
    // 구간별로 각자 반올림하면 합이 총계와 어긋날 수 있어(예: 34+34+34=102 vs 헤더 101) —
    // roundToSum으로 총계에 정확히 맞춘다(kakaoMobility.js와 동일 패턴).
    legMinutes: roundToSum(
      result.legs.map((l) => l.timeS / 60),
      totalMinutes,
    ),
    legEstimated: result.legs.map(() => false),
  }
}
