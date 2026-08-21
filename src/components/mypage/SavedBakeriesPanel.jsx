import { useSavedBakeries } from '../../hooks/useSavedBakeries'

// 마이페이지 찜한 빵 목록 패널. targetUserId 가 있으면(친구 상세 조회) 그 유저 데이터를 읽어오고,
// readOnly 면 찜 해제 버튼만 숨긴다(RLS 로도 어차피 타인 delete 는 막혀 있음).
export default function SavedBakeriesPanel({ onBack, targetUserId, readOnly = false }) {
  const { saved, toggleSave } = useSavedBakeries(targetUserId)

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
                <button type="button" className="save-btn saved" onClick={() => toggleSave(b)}>
                  ❤️ 찜 해제
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
