import { useSavedBakeries } from '../../hooks/useSavedBakeries'
import PreviewChevron from './PreviewChevron'
import { HeartIcon } from './PreviewIcons'
import { getBreadById, getBreadByName } from '../../data/breadCandidates'

// 마이페이지 홈 미리보기 카드. 헤더에서 전체 개수를 바로 확인할 수 있다.
// 상세 조작(찜 해제 등)은 헤더 클릭 시 SavedBakeriesPanel 로 이동해서 한다.
export default function SavedBakeriesPreview({ onExpand }) {
  const { saved } = useSavedBakeries()
  const fallbackIllustration = getBreadById('breadLoaf')?.illustration

  return (
    <div className="mypage-preview-panel">
      <button type="button" className="mypage-preview-header" onClick={onExpand}>
        <span className="mypage-preview-icon-badge" aria-hidden="true">
          <HeartIcon />
        </span>
        <span className="mypage-preview-title">찜한 빵 목록 ({saved.length}개)</span>
        <PreviewChevron />
      </button>
      <div className="mypage-preview-body">
        {saved.length === 0 ? (
          <p className="mypage-preview-empty">아직 찜한 빵집이 없어요.</p>
        ) : (
          <div className="mypage-preview-bakery-grid">
            {saved.map((b) => {
              const illustration =
                b.breadTypeIllustration || getBreadByName(b.breadType)?.illustration || fallbackIllustration

              return (
                <div key={b.id} className="mypage-preview-bakery-card">
                  <img className="mypage-preview-bakery-icon" src={illustration} alt="" aria-hidden="true" />
                  {b.breadType ? (
                    <>
                      <span className="mypage-preview-bakery-name">{b.breadType}</span>
                      <span className="mypage-preview-bakery-sub">{b.name}</span>
                    </>
                  ) : (
                    <span className="mypage-preview-bakery-name">{b.name}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
