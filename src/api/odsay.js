// CP6-4b — ODsay 대중교통 길찾기 실API. 무료 Basic 요금제 키(VITE_ODSAY_API_KEY) 사용.
// 실패하면 null을 반환 — 호출부가 근사치(travelMin)로 폴백한다.
const API_KEY = import.meta.env.VITE_ODSAY_API_KEY

// 두 좌표({lat,lng}) 사이 실제 대중교통 이동시간(분) + 실거리(km) + 경유하는 지점들의 좌표.
// ODsay는 버스·지하철 "노선"이 실제로 그리는 좌표(선형)는 안 준다(그건 노선별 별도 조회가
// 필요해서 범위 밖) — 대신 각 구간(subPath)의 시종점 정류장 좌표는 주므로, 그 점들을 순서대로
// 이어서 "직선 하나"보다는 실제 경유 정류장을 지나는 꺾은선을 그린다.
// → { minutes, distanceKm, path: [{lat,lng}, ...] } | null
export async function fetchTransit(a, b) {
  if (!API_KEY) return null
  const params = new URLSearchParams({
    SX: a.lng, SY: a.lat, EX: b.lng, EY: b.lat, apiKey: API_KEY,
  })
  try {
    const res = await fetch(`https://api.odsay.com/v1/api/searchPubTransPathT?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    const best = data?.result?.path?.[0]
    const minutes = best?.info?.totalTime // 분
    const totalDistance = best?.info?.totalDistance // 미터 — CP11-4: 전엔 여기서 안 꺼내고
    // 버려서 대중교통 거리가 항상 추정치로만 표시됐음(리뷰 발견)
    if (!Number.isFinite(minutes)) return null

    const path = [a]
    for (const sub of best.subPath || []) {
      if (Number.isFinite(sub.startX) && Number.isFinite(sub.startY)) {
        path.push({ lat: sub.startY, lng: sub.startX })
      }
      if (Number.isFinite(sub.endX) && Number.isFinite(sub.endY)) {
        path.push({ lat: sub.endY, lng: sub.endX })
      }
    }
    path.push(b)
    return {
      minutes,
      distanceKm: Number.isFinite(totalDistance) ? totalDistance / 1000 : null,
      path,
    }
  } catch {
    return null
  }
}
