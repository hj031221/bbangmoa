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
