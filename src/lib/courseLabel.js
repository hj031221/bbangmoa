const MODE_LABEL = { car: '자동차', transit: '대중교통', walk: '도보' }

function dateAndStopCount(row) {
  const date = new Date(row.created_at)
  return {
    dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
    stopCount: row.stops?.length ?? 0,
  }
}

// saved_courses row → 마이페이지 목록/상세 헤더에 쓰는 한 줄 라벨.
export function formatCourseLabel(row) {
  const { dateLabel, stopCount } = dateAndStopCount(row)
  const modeLabel = MODE_LABEL[row.travel_mode] || row.travel_mode
  return `${row.title} · ${dateLabel} 저장 · ${stopCount}곳 · ${modeLabel}`
}

// 목록 줄에서 이름을 강조하고 나머지는 작게 붙이기 위한 짧은 메타 텍스트 — 날짜·스탑 수만.
// 이동수단/"저장" 단어는 뺀다(요청: 자동차 같은 건 빼고 이름이 강조되게).
export function formatCourseMeta(row) {
  const { dateLabel, stopCount } = dateAndStopCount(row)
  return `${dateLabel} · ${stopCount}곳`
}

// 저장 모달 기본값용 — base 이름이 existingNames와 겹치면 "base (2)", "(3)"... 처럼
// 겹치지 않는 첫 이름을 찾아 반환한다. 매번 이름을 직접 입력하지 않아도 클릭 한 번으로
// 저장되던 기존 흐름을 유지하면서, 동일 이름 저장을 막는 중복검사와 충돌하지 않게 한다.
export function uniqueDefaultTitle(base, existingNames = []) {
  if (!existingNames.includes(base)) return base
  let n = 2
  while (existingNames.includes(`${base} (${n})`)) n++
  return `${base} (${n})`
}
