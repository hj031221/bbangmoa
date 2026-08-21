import { useSavedBakeries } from '../../hooks/useSavedBakeries'
import PreviewChevron from './PreviewChevron'
import { HeartIcon } from './PreviewIcons'

// 마이페이지 홈 미리보기 카드. 개수 제한 없이 찜한 만큼 세로로 늘어난다.
// 상세 조작(찜 해제 등)은 헤더 클릭 시 SavedBakeriesPanel 로 이동해서 한다.
export default function SavedBakeriesPreview({ onExpand }) {
  const { saved } = useSavedBakeries()

  return (
    <div className="mypage-preview-panel">
      <button type="button" className="mypage-preview-header" onClick={onExpand}>
        <span className="mypage-preview-icon-badge" aria-hidden="true">
          <HeartIcon />
        </span>
        <span className="mypage-preview-title">찜한 빵 목록</span>
        <PreviewChevron />
      </button>
      <div className="mypage-preview-body">
        {saved.length === 0 ? (
          <p className="mypage-preview-empty">아직 찜한 빵집이 없어요.</p>
        ) : (
          <div className="mypage-preview-bakery-grid">
            {saved.map((b) => (
              <div key={b.id} className="mypage-preview-bakery-card">
                <span className="mypage-preview-bakery-icon" aria-hidden="true">{b.breadTypeEmoji || '🍞'}</span>
                {b.breadType ? (
                  <>
                    <span className="mypage-preview-bakery-name">{b.breadType}</span>
                    <span className="mypage-preview-bakery-sub">{b.name}</span>
                  </>
                ) : (
                  <span className="mypage-preview-bakery-name">{b.name}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
