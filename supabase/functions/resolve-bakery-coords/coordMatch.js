// 이슈 #69 — resolve-bakery-coords Edge Function 의 순수 매칭 로직.
// Deno API 를 쓰지 않는다: src 의 node:test 가 이 파일을 그대로 import 한다.

// 출처: src/config/regions.js 의 대전 region.bbox. 값 변경 시 양쪽을 반드시 함께 고친다.
export const DAEJEON_BBOX = { minLat: 36.18, maxLat: 36.5, minLng: 127.25, maxLng: 127.56 }

// 'kakao:123' → { source: 'kakao', nativeId: '123' } / 형식 불일치는 null
export function parseBakeryId(bakeryId) {
  const m = /^(tour|kakao):(.+)$/.exec(String(bakeryId ?? '').trim())
  return m ? { source: m[1], nativeId: m[2] } : null
}

export function inDaejeon(lat, lng, bbox = DAEJEON_BBOX) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  )
}

// Kakao 키워드검색 documents[] 에서 nativeId 와 정확히 일치하는 항목의 좌표.
// Kakao 규약: doc.x = 경도(lng), doc.y = 위도(lat).
export function pickKakaoMatch(documents, nativeId) {
  for (const d of documents ?? []) {
    if (String(d?.id) !== String(nativeId)) continue
    const lat = parseFloat(d.y)
    const lng = parseFloat(d.x)
    return inDaejeon(lat, lng) ? { lat, lng } : null
  }
  return null
}

// KorService2 detailCommon2 item → 좌표. 규약: item.mapx = 경도, item.mapy = 위도.
export function pickTourCoord(item) {
  const lat = parseFloat(item?.mapy)
  const lng = parseFloat(item?.mapx)
  return inDaejeon(lat, lng) ? { lat, lng } : null
}
