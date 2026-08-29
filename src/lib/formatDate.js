export function formatDiaryDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`
}

// 댓글 타임스탬프용 — 날짜 + 시:분.
export function formatDiaryDateTime(iso) {
  const d = new Date(iso)
  return `${formatDiaryDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
