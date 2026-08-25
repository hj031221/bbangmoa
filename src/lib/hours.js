// 영업시간(hours.open/close, "HH:MM") 기준 영업중 여부 판단 유틸.
// 자정을 넘기는 영업시간(예: 22:00~02:00)도 처리한다.
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function isOpenNow(hours, now = new Date()) {
  if (!hours?.open || !hours?.close) return null
  const openMin = toMinutes(hours.open)
  const closeMin = toMinutes(hours.close)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (openMin === closeMin) return true
  if (openMin < closeMin) return nowMin >= openMin && nowMin < closeMin
  return nowMin >= openMin || nowMin < closeMin
}

// "영업 중 · 18:00에 영업 종료" | "영업 종료" | null(시간 정보 없음)
export function hoursBadgeText(hours) {
  if (!hours?.open || !hours?.close) return null
  return isOpenNow(hours) ? `영업 중 · ${hours.close}에 영업 종료` : '영업 종료'
}

// 관광공사 운영시간 자연어(usetime/usetimeculture) → 구조화 {open, close, confidence, raw}.
//   confidence: high(단일 HH:MM~HH:MM/상시) · medium(요일·계절 섞임, 첫 구간만) · low(파싱실패→기본창)
// 옛 빌드타임 스크립트(scripts/prefetchTour.mjs, 삭제됨 — git log d1b51cf 참고)의 로직을 그대로
// 런타임 유틸로 옮긴 것. 관광지 상세를 열 때(AttractionDetail) getAttractionIntro() 응답에 적용한다.
export function parseHours(raw) {
  const s = (raw || '').replace(/\s/g, '')
  if (!s) return { open: '09:00', close: '18:00', confidence: 'low', raw: '' }
  // 상시개방·연중무휴·24시간 (구체 시각 없을 때)
  if (/(상시|연중무휴|24시간|무휴|항상)/.test(s) && !/\d{1,2}:\d{2}/.test(s))
    return { open: '00:00', close: '24:00', confidence: 'high', raw }
  const m = s.match(/(\d{1,2}):(\d{2})[~\-–]+(\d{1,2}):(\d{2})/)
  if (m) {
    const pad = (n) => String(n).padStart(2, '0')
    const complex = /(월|화|수|목|금|토|일)[~\-]|평일|주말|하절기|동절기|\d+월[~\-]|계절|시즌/.test(raw)
    return { open: `${pad(m[1])}:${m[2]}`, close: `${pad(m[3])}:${m[4]}`, confidence: complex ? 'medium' : 'high', raw }
  }
  // 파싱 불가 → 기본 주간창 + 플래그(코스에서 제외하진 않음)
  return { open: '09:00', close: '18:00', confidence: 'low', raw }
}
