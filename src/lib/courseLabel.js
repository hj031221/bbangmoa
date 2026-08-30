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

// 목록 줄에서 이름을 강조하고 나머지는 작게 붙이기 위한 짧은 메타 텍스트 — 날짜·스탑 수만.
// 이동수단/"저장" 단어는 뺀다(요청: 자동차 같은 건 빼고 이름이 강조되게).
export function formatCourseMeta(row) {
  const date = new Date(row.created_at)
  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`
  const stopCount = row.stops?.length ?? 0
  return `${dateLabel} · ${stopCount}곳`
}
