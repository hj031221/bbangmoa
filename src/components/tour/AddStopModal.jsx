import { useState } from 'react'

const TABS = [
  { id: 'bakery', label: '빵집 검색' },
  { id: 'attraction', label: '관광지 검색' },
]

// 전체 지도(설문 후보 풀 밖 포함)에서 빵집/관광지를 검색해 코스에 추가하는 모달.
// §07 확정사항: 개수 상한 없음, 후보 풀 밖도 허용.
export default function AddStopModal({ bakeries, attractions, excludeIds, onAdd, onClose }) {
  const [tab, setTab] = useState('bakery')
  const [query, setQuery] = useState('')

  const pool = tab === 'bakery' ? bakeries : attractions
  const filtered = pool
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !excludeIds.has(p.id))
    .filter((p) => !query.trim() || p.name.includes(query.trim()))
    .slice(0, 30)

  return (
    <div className="pil-modal-backdrop" onClick={onClose}>
      <div className="pil-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pil-modal-head">
          <div className="pil-modal-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" className="pil-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <input
          className="pil-modal-search"
          type="text"
          placeholder={tab === 'bakery' ? '빵집 이름 검색…' : '관광지 이름 검색…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="pil-modal-list">
          {filtered.length === 0 && <div className="pil-modal-empty">검색 결과가 없어요.</div>}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="pil-modal-row"
              onClick={() => onAdd({ type: tab, id: p.id, name: p.name, lat: p.lat, lng: p.lng })}
            >
              <span>{p.name}</span>
              <span className="pil-modal-plus">+</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
