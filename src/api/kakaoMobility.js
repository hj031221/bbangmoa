// CP6-4a — 카카오모빌리티 자동차 길찾기 실API.
// 무료 쿼터(일 10,000건) 내에서는 별도 제휴 없이 기존 REST 키 그대로 쓴다(확인됨).
// 실패하면 null을 반환 — 호출부가 근사치(travelMin)로 폴백한다.
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
// → { minutes, distanceKm, legPaths, legDistancesKm, legMinutes } | null
//   (legPaths/legDistancesKm/legMinutes.length === points.length - 1, 인덱스 1:1 대응)
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
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const route = data?.routes?.[0]
    if (route?.result_code !== 0) return null // 예: 103 = 경유지 중 하나 근처 도로망 탐색 불가
    const duration = route?.summary?.duration
    const distance = route?.summary?.distance
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

    // CP11-4: section 자체가 구간별 distance/duration을 주면 그대로 쓰고, 응답에 없으면(카카오
    // 필드 유무 미확인 — section.roads[].vertexes 개수 비례로 근사 분배(총계는 실측 유지, 구간
    // 배분만 근사).
    const hasSectionMetrics = sections.every(
      (s) => Number.isFinite(s.distance) && Number.isFinite(s.duration),
    )
    let legDistancesKm, legMinutes
    if (hasSectionMetrics) {
      legDistancesKm = sections.map((s) => s.distance / 1000)
      legMinutes = sections.map((s) => Math.round(s.duration / 60))
    } else {
      const weights = legPaths.map((p) => Math.max(p.length, 1))
      const totalWeight = weights.reduce((a, b) => a + b, 0)
      legDistancesKm = weights.map((w) =>
        Number.isFinite(distance) ? (distance / 1000) * (w / totalWeight) : null,
      )
      legMinutes = weights.map((w) => Math.round((duration / 60) * (w / totalWeight)))
    }

    return {
      minutes: Math.round(duration / 60),
      distanceKm: Number.isFinite(distance) ? distance / 1000 : null,
      legPaths,
      legDistancesKm,
      legMinutes,
    }
  } catch {
    return null
  }
}
