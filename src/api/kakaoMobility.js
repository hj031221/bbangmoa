// CP6-4a — 카카오모빌리티 자동차 길찾기 실API.
// 무료 쿼터(일 10,000건) 내에서는 별도 제휴 없이 기존 REST 키 그대로 쓴다(확인됨).
// 실패하면 null을 반환 — 호출부가 근사치(travelMin)로 폴백한다.
import { pathLengthKm } from '../lib/distance.js'
import { roundToSum } from '../lib/rounding.js'

const REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY

// 두 좌표({lat,lng}) 사이 실제 자동차 이동시간(분) + 실거리(km) + 실제 도로를 따라가는 경로 좌표.
// → { minutes, distanceKm, path: [{lat,lng}, ...] } | null
export async function fetchDriving(a, b) {
  if (!REST_KEY) return null
  const origin = `${a.lng},${a.lat}`
  const destination = `${b.lng},${b.lat}`
  try {
    const res = await fetch(
      `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin}&destination=${destination}`,
      { headers: { Authorization: `KakaoAK ${REST_KEY}` } },
    )
    if (!res.ok) return null
    const data = await res.json()
    const route = data?.routes?.[0]
    const duration = route?.summary?.duration // 초
    const distance = route?.summary?.distance // 미터 — CP11-4: 이전엔 여기서 안 꺼내고 버렸음
    if (!Number.isFinite(duration)) return null

    // sections[].roads[].vertexes: [lng, lat, lng, lat, ...] 평탄화된 배열 — 실제 도로 좌표.
    const path = []
    for (const section of route.sections || []) {
      for (const road of section.roads || []) {
        const v = road.vertexes || []
        for (let i = 0; i + 1 < v.length; i += 2) path.push({ lat: v[i + 1], lng: v[i] })
      }
    }
    return {
      minutes: Math.round(duration / 60),
      distanceKm: Number.isFinite(distance) ? distance / 1000 : null,
      path: path.length > 0 ? path : null,
    }
  } catch {
    return null
  }
}

// 여러 지점을 한 번의 호출로 잇는 다중 경유지 길찾기(POST /v1/waypoints/directions, 최대 30곳).
// 구간마다 따로 fetchDriving()을 불러 이어붙이는 것보다 API가 전체 동선을 한 번에 계산해서
// 이어지는 게 더 자연스럽고 호출도 1번뿐이다 — 다만 이 코스에 있는 지점 중 하나라도
// 도로망을 못 찾으면(예: 호수 근처) 전체 요청이 통째로 실패한다(카카오 쪽 제약, 실제로 겪음).
// 그래서 호출부는 이게 null이면 구간별 fetchDriving()으로 폴백해야 한다.
// points: [{lat,lng}, ...] 최소 2개(출발+도착). name 필드는 한글을 넣으면 400이 나서(원인 불명,
// 재현 확인함) 아예 안 보낸다 — 우리는 안내문구를 안 쓰므로 없어도 된다.
// → { minutes, distanceKm, legPaths, legDistancesKm, legMinutes, legEstimated } | null
//   (legPaths/legDistancesKm/legMinutes/legEstimated.length === points.length - 1, 인덱스 1:1 대응)
export async function fetchDrivingMultiWaypoint(points) {
  if (!REST_KEY || points.length < 2) return null
  const [origin, ...rest] = points
  const destination = rest[rest.length - 1]
  const waypoints = rest.slice(0, -1)

  try {
    const res = await fetch('https://apis-navi.kakaomobility.com/v1/waypoints/directions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `KakaoAK ${REST_KEY}` },
      body: JSON.stringify({
        origin: { x: origin.lng, y: origin.lat },
        destination: { x: destination.lng, y: destination.lat },
        waypoints: waypoints.map((p) => ({ x: p.lng, y: p.lat })),
        priority: 'RECOMMEND',
        // CP12: summary:true는 넣지 않는다 — fare.taxi/fare.toll은 이 플래그 없이도 기본 응답
        // route.summary.fare에 그대로 들어온다(실측 재확인). summary:true를 넣으면 오히려
        // sections[]에서 roads가 빠져(distance/duration만 남음) legPaths가 빈 배열이 되어
        // 지도에 경로선이 안 그려진다(리뷰 발견 — fare를 받으려던 목적에 불필요했고 부작용만 있었음).
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const route = data?.routes?.[0]
    if (route?.result_code !== 0) return null // 예: 103 = 경유지 중 하나 근처 도로망 탐색 불가
    const duration = route?.summary?.duration
    const distance = route?.summary?.distance
    const taxiFare = route?.summary?.fare?.taxi
    if (!Number.isFinite(duration)) return null

    // sections[i] = origin/waypoint[i-1] → waypoint[i]/destination 구간. points와 1:1 대응.
    const sections = route.sections || []
    const legPaths = sections.map((section) => {
      const path = []
      for (const road of section.roads || []) {
        const v = road.vertexes || []
        for (let i = 0; i + 1 < v.length; i += 2) path.push({ lat: v[i + 1], lng: v[i] })
      }
      return path
    })
    if (legPaths.length !== points.length - 1) return null // 구간 수가 안 맞으면 신뢰 안 함

    // CP11-4: section 자체가 구간별 distance/duration을 주면 그대로 쓴다 — 실측 확인함(카카오
    // waypoints/directions 응답의 sections[]는 매번 distance/duration 필드를 포함했다). 다만
    // API가 이 필드를 안 줄 이론적 가능성까지 배제할 순 없어 방어적으로 폴백은 남겨둔다: 그럴 땐
    // 꼭짓점 개수가 아니라 각 구간 폴리라인의 실제 좌표 길이(haversine 합) 비례로 총계를 분배한다
    // — 꼭짓점 개수는 거리와 무관해서(직선 고속도로 구간은 꼭짓점이 적고, 짧고 구불구불한 구간은
    // 많다) 그걸로 가중치를 삼으면 구간별 숫자가 크게 틀어질 수 있었다(리뷰 발견).
    const hasSectionMetrics = sections.every(
      (s) => Number.isFinite(s.distance) && Number.isFinite(s.duration),
    )
    let legDistancesKm, legMinutes
    if (hasSectionMetrics) {
      legDistancesKm = sections.map((s) => s.distance / 1000)
      legMinutes = roundToSum(
        sections.map((s) => s.duration / 60),
        Math.round(duration / 60),
      )
    } else {
      const weights = legPaths.map((p) => Math.max(pathLengthKm(p), 0.01)) // 0 방지용 최소 가중치
      const totalWeight = weights.reduce((a, b) => a + b, 0)
      legDistancesKm = weights.map((w) =>
        Number.isFinite(distance) ? (distance / 1000) * (w / totalWeight) : null,
      )
      legMinutes = roundToSum(
        weights.map((w) => (duration / 60) * (w / totalWeight)),
        Math.round(duration / 60),
      )
    }

    return {
      minutes: Math.round(duration / 60),
      distanceKm: Number.isFinite(distance) ? distance / 1000 : null,
      legPaths,
      legDistancesKm,
      legMinutes,
      // hasSectionMetrics가 false면 legDistancesKm/legMinutes가 실측이 아니라 총계를 비례
      // 분배한 근사값이다 — 호출부(travelTime.js)가 legEstimated로 그대로 넘겨써서 지도에
      // 정확히 실선/점선을 구분하게 한다(리뷰 발견: 전엔 이 구분 없이 항상 실측 취급했음).
      legEstimated: legPaths.map(() => !hasSectionMetrics),
      taxiFare: Number.isFinite(taxiFare) ? taxiFare : null,
    }
  } catch {
    return null
  }
}

// CP12 — 1:N 실주행시간/거리 매트릭스(POST /v1/destinations/directions). 코스 순서 결정에 쓴다 —
// buildGreedyOrder(routePlan.js)의 직선거리 그리디는 "직선으로 가까워 보이지만 실제로는 하천
// 건너편이라 크게 도는" 경우를 못 잡는다(대전 갑천·대전천에서 실제로 겪음). 이 함수 자체는
// 호출 1회로 origin→destinations 전체 실주행시간을 받는다(실측 확인: 목적지 3곳 → 정상 응답,
// 하나가 radius 밖이면 그 destination만 result_code 304로 빠지고 나머지는 정상 응답).
// 다만 호출부(PilgrimagePage.jsx)는 진짜 최근접 이웃 순서를 만들려고 이 함수를 스텝마다
// (매번 "마지막 방문지"를 새 origin으로) 반복 호출한다 — 코스당 총 N-1회(스톱 N개) 순차
// 라운드트립이 나간다는 뜻이다. "호출 1회"는 이 함수 자체에 대한 설명이지 전체 재정렬
// 흐름에 대한 설명이 아니다(리뷰 발견 — 이전 주석이 혼동을 줌).
// destinations: [{ id, lat, lng }, ...] (id를 API의 key로 그대로 씀, 응답 매칭용)
// → [{ id, distanceKm, minutes }] | null (radius 밖이거나 실패한 목적지는 배열에서 빠진다 —
//   호출부가 못 찾은 stop을 별도 처리해야 함)
export async function fetchDestinationsMatrix(origin, destinations) {
  if (!REST_KEY || destinations.length === 0) return null
  try {
    const res = await fetch('https://apis-navi.kakaomobility.com/v1/destinations/directions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `KakaoAK ${REST_KEY}` },
      body: JSON.stringify({
        origin: { x: origin.lng, y: origin.lat },
        destinations: destinations.map((d) => ({ x: d.lng, y: d.lat, key: d.id })),
        radius: 10000, // API 상한(10km, 이보다 크면 요청 자체가 400) — 대전 시내 코스는 보통 이 안
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const routes = data?.routes || []
    return routes
      .filter((r) => r.result_code === 0 && r.summary)
      .map((r) => ({
        id: r.key,
        distanceKm: r.summary.distance / 1000,
        minutes: Math.round(r.summary.duration / 60),
      }))
  } catch {
    return null
  }
}
