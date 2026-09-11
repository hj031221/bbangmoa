// 공통 fetch 헬퍼. 쿼리스트링 빌드 + JSON 파싱 + 에러 표면화.
// 응답이 안 오면 이만큼 기다렸다 포기한다.
//
// 왜 필요한가 — fetch 는 기본적으로 안 끝난다.
//   관광공사 API 는 실측상 연결 성공률이 40% 수준이고, 실패할 때 거부가 아니라
//   무응답이다. 그러면 fetch 프라미스가 resolve 도 reject 도 안 되고 매달린다.
//   useBakeries 는 Promise.all([관광공사, 카카오]) 라 한쪽이 매달리면 전체가 멈춘다.
//   .catch(() => []) 를 붙여놔도 소용없다 — 거부가 아니라 "미완료"라서 안 걸린다.
//   그 결과 카카오에서 261곳을 받아놓고도 화면이 0곳으로 남는다.
//
// 10초인 이유: 정상 응답은 대부분 1초 안이고, 느린 경우도 3초대였다.
// 10초를 넘겼다면 살아날 요청이 아니다. 그렇다고 더 짧게 잡으면
// 회선이 느린 사용자의 정상 요청을 끊게 된다.
const DEFAULT_TIMEOUT_MS = 10000

// getJson 을 안 거치고 fetch 를 직접 부르는 곳(POST 바디가 필요한 카카오 모빌리티·TMAP)이
// 같은 타임아웃을 쓸 수 있게 따로 뺀다. 이게 없으면 그쪽은 타임아웃이 아예 없는 채로 남는데,
// 정작 매달릴 위험이 제일 큰 게 그쪽이다 — 경로 계산은 코스 하나에 여러 번 순차로 나가서
// 한 번만 매달려도 그 뒤가 전부 멈춘다.
//
// AbortSignal.timeout 이 없는 구형 브라우저에서는 undefined 를 준다(= 예전 동작).
// 기능이 없다고 요청 자체를 막을 이유는 없다.
export function timeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined
}

export async function getJson(url, { params, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const qs = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : ''
  const res = await fetch(url + qs, { headers, signal: timeoutSignal(timeoutMs) })
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
