import { useSavedBakeries } from '../../hooks/useSavedBakeries'

// 마이페이지 찜한 빵 목록 패널. useSavedBakeries 는 그대로 재사용하고
// 카드 그리드 UI만 시안(대전 웹사이트 4.pdf page 11/12)에 맞게 새로 구성한다.
export default function SavedBakeriesPanel({ onBack }) {
  const { saved, toggleSave } = useSavedBakeries()

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
          {saved.map((b) => (
            <div key={b.id} className="mypage-item-card">
              <span className="mypage-item-name">{b.name}</span>
              {b.address && <span className="mypage-item-sub">{b.address}</span>}
              <button type="button" className="save-btn saved" onClick={() => toggleSave(b)}>
                ❤️ 찜 해제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
