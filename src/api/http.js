// 공통 fetch 헬퍼. 쿼리스트링 빌드 + JSON 파싱 + 에러 표면화.
export async function getJson(url, { params, headers } = {}) {
  const qs = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : ''
  const res = await fetch(url + qs, { headers })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url}`)
  }
  return res.json()
}

export const hasKey = (v) => typeof v === 'string' && v.trim().length > 0

// CP11-6 — 관광공사 API가 내려주는 이미지 URL이 http인 경우가 있어(Mixed Content 경고,
// 자동 전환 안 해주는 환경에선 이미지가 깨짐) https 페이지에서 그대로 못 쓴다. 이미지 URL을
// 쓰는 모든 지점(normalize.js, tourApi.js, RecommendCard.jsx의 detail.firstimage)에서
// 공통으로 재사용한다.
export function toHttps(url) {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}
