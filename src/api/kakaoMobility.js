// CP6-4a — 카카오모빌리티 자동차 길찾기 실API.
// 무료 쿼터(일 10,000건) 내에서는 별도 제휴 없이 기존 REST 키 그대로 쓴다(확인됨).
// 실패하면 null을 반환 — 호출부가 근사치(travelMin)로 폴백한다.
const REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY

// 두 좌표({lat,lng}) 사이 실제 자동차 이동시간(분).
export async function fetchDrivingMinutes(a, b) {
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
    const duration = data?.routes?.[0]?.summary?.duration // 초
    return Number.isFinite(duration) ? Math.round(duration / 60) : null
  } catch {
    return null
  }
}
