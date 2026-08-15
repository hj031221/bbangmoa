// CP6-4b — ODsay 대중교통 길찾기 실API. 무료 Basic 요금제 키(VITE_ODSAY_API_KEY) 사용.
// 실패하면 null을 반환 — 호출부가 근사치(travelMin)로 폴백한다.
const API_KEY = import.meta.env.VITE_ODSAY_API_KEY

// 두 좌표({lat,lng}) 사이 실제 대중교통 이동시간(분).
export async function fetchTransitMinutes(a, b) {
  if (!API_KEY) return null
  const params = new URLSearchParams({
    SX: a.lng, SY: a.lat, EX: b.lng, EY: b.lat, apiKey: API_KEY,
  })
  try {
    const res = await fetch(`https://api.odsay.com/v1/api/searchPubTransPathT?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    const minutes = data?.result?.path?.[0]?.info?.totalTime // 분
    return Number.isFinite(minutes) ? minutes : null
  } catch {
    return null
  }
}
