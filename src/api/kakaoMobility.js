// CP6-4a — 카카오모빌리티 자동차 길찾기 실API.
// 무료 쿼터(일 10,000건) 내에서는 별도 제휴 없이 기존 REST 키 그대로 쓴다(확인됨).
// 실패하면 null을 반환 — 호출부가 근사치(travelMin)로 폴백한다.
const REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY

// 두 좌표({lat,lng}) 사이 실제 자동차 이동시간(분) + 실제 도로를 따라가는 경로 좌표.
// → { minutes, path: [{lat,lng}, ...] } | null
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
    if (!Number.isFinite(duration)) return null

    // sections[].roads[].vertexes: [lng, lat, lng, lat, ...] 평탄화된 배열 — 실제 도로 좌표.
    const path = []
    for (const section of route.sections || []) {
      for (const road of section.roads || []) {
        const v = road.vertexes || []
        for (let i = 0; i + 1 < v.length; i += 2) path.push({ lat: v[i + 1], lng: v[i] })
      }
    }
    return { minutes: Math.round(duration / 60), path: path.length > 0 ? path : null }
  } catch {
    return null
  }
}
