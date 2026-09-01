import { useDiaryEntries } from '../../hooks/useDiaryEntries'
import { formatDiaryDate } from '../../lib/formatDate'
import PreviewChevron from './PreviewChevron'
import { PaperIcon } from './PreviewIcons'
import DiaryVerificationBadge from './DiaryVerificationBadge'

// 마이페이지 홈 미리보기 카드. 개수 제한 없이 기록한 만큼 세로로 늘어난다.
// 수정/삭제는 헤더 클릭 시 DiaryPanel 로 이동해서 한다.
export default function DiaryPreview({ onExpand }) {
  const { entries, loading } = useDiaryEntries()

  return (
    <div className="mypage-preview-panel">
      <button type="button" className="mypage-preview-header" onClick={onExpand}>
        <span className="mypage-preview-icon-badge" aria-hidden="true">
          <PaperIcon />
        </span>
        <span className="mypage-preview-title">기록장</span>
        <PreviewChevron />
      </button>
      <div className="mypage-preview-body mypage-preview-diary-body">
        {loading ? (
          <p className="mypage-preview-empty">불러오는 중…</p>
        ) : entries.length === 0 ? (
          <p className="mypage-preview-empty">아직 기록이 없어요.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="mypage-preview-diary-card">
              <span className="mypage-preview-diary-meta">
                <span className="mypage-preview-diary-date">{formatDiaryDate(entry.created_at)}</span>
                <DiaryVerificationBadge verified={entry.verified} />
              </span>
              <p className="mypage-preview-diary-text">{entry.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
