const MODE_LABEL = { car: '자동차', transit: '대중교통', walk: '도보' }

// saved_courses row → 마이페이지 목록/상세 헤더에 쓰는 한 줄 라벨.
// saved_courses 는 title 이 항상 "대전한바퀴" 로 고정 저장되므로(코스별 커스텀 이름 없음),
// 날짜/스탑 수/이동수단으로 각 저장 건을 구분한다.
export function formatCourseLabel(row) {
  const date = new Date(row.created_at)
  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`
  const stopCount = row.stops?.length ?? 0
  const modeLabel = MODE_LABEL[row.travel_mode] || row.travel_mode
  return `${row.title} · ${dateLabel} 저장 · ${stopCount}곳 · ${modeLabel}`
}
