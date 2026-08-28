import { useSavedBakeries } from '../../hooks/useSavedBakeries'
import { SaveHeartIcon } from './PreviewIcons'
import { getBreadById, getBreadByName } from '../../data/breadCandidates'

// 마이페이지 찜한 빵 목록 패널. targetUserId 가 있으면(친구 상세 조회) 그 유저 데이터를 읽어오고,
// readOnly 면 찜 해제 버튼만 숨긴다(RLS 로도 어차피 타인 delete 는 막혀 있음).
// onViewOnMap 이 주어지면 카드를 누를 때 그 빵집을 지도에서 연다.
export default function SavedBakeriesPanel({ onBack, targetUserId, readOnly = false, onViewOnMap }) {
  const { saved, toggleSave } = useSavedBakeries(targetUserId)
  const fallbackIllustration = getBreadById('breadLoaf')?.illustration

  return (
    <div className="mypage-panel">
      <div className="mypage-panel-header">
        <button type="button" className="mypage-back" onClick={onBack}>
          ‹
        </button>
        <h3>찜한 빵 목록{saved.length > 0 && ` (${saved.length}곳)`}</h3>
      </div>
      {saved.length === 0 ? (
        <p className="saved-empty">아직 찜한 빵집이 없어요.</p>
      ) : (
        <div className="mypage-card-grid">
          {saved.map((b) => {
            const illustration =
              b.breadTypeIllustration || getBreadByName(b.breadType)?.illustration || fallbackIllustration

            const clickable = typeof onViewOnMap === 'function'
            return (
              <div
                key={b.id}
                className={'mypage-item-card' + (clickable ? ' is-clickable' : '')}
                {...(clickable && {
                  role: 'button',
                  tabIndex: 0,
                  onClick: () => onViewOnMap(b),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onViewOnMap(b)
                    }
                  },
                })}
              >
                <img className="mypage-item-bread-illustration" src={illustration} alt="" aria-hidden="true" />
                {b.breadType ? (
                  <>
                    <span className="mypage-item-name">{b.breadType}</span>
                    <span className="mypage-item-sub">{b.name}</span>
                  </>
                ) : (
                  <span className="mypage-item-name">{b.name}</span>
                )}
                {b.address && <span className="mypage-item-sub">{b.address}</span>}
                {!readOnly && (
                  <button
                    type="button"
                    className="save-btn saved"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSave(b)
                    }}
                  >
                    <SaveHeartIcon filled />
                    찜 해제
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
