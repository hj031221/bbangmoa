import { useSavedBakeries } from '../hooks/useSavedBakeries'

// 찜한 빵집 모아보기. localStorage(useSavedBakeries) 기반.
export default function SavedListPage() {
  const { saved, toggleSave } = useSavedBakeries()

  return (
    <div className="saved-page">
      <h2>나만의 리스트 {saved.length > 0 && `(${saved.length}곳)`}</h2>

      {saved.length === 0 ? (
        <p className="saved-empty">아직 찜한 빵집이 없어요.</p>
      ) : (
        <ul className="saved-list">
          {saved.map((b) => (
            <li key={b.id} className="saved-item">
              <div>
                <div className="saved-item-name">{b.name}</div>
                {b.address && <div className="saved-item-addr">{b.address}</div>}
              </div>
              <button className="save-btn saved" onClick={() => toggleSave(b)}>
                ❤️ 찜함
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
