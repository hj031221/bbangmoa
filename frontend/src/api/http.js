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
