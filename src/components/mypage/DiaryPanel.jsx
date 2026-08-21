import { useState } from 'react'
import { useDiaryEntries } from '../../hooks/useDiaryEntries'

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`
}

// 마이페이지 기록장 패널. 작성은 RecommendCard(빵집 상세)의 "기록 남기기"에서만 가능
// — 여기선 목록 보기 / 수정 / 삭제만 한다.
export default function DiaryPanel({ onBack }) {
  const { entries, loading, updateEntry, removeEntry } = useDiaryEntries()
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const selected = entries.find((e) => e.id === selectedId)

  const openEntry = (entry) => {
    setSelectedId(entry.id)
    setEditing(false)
    setDraft(entry.text)
  }

  const submitEdit = (e) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    updateEntry(selectedId, trimmed)
    setEditing(false)
  }

  if (selected) {
    return (
      <div className="mypage-panel">
        <div className="mypage-panel-header">
          <button type="button" className="mypage-back" onClick={() => setSelectedId(null)}>
            ‹
          </button>
          <h3>기록장</h3>
        </div>
        <div className="diary-detail">
          <div className="diary-detail-meta">
            <span className="diary-detail-bakery">{selected.bakery?.name}</span>
            <span>{formatDate(selected.created_at)}</span>
          </div>
          {editing ? (
            <form onSubmit={submitEdit} className="diary-modal-form">
              <textarea
                className="diary-modal-textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                autoFocus
              />
              <div className="mypage-nickname-actions">
                <button type="submit" className="primary-btn">
                  저장
                </button>
                <button type="button" className="ghost-btn" onClick={() => setEditing(false)}>
                  취소
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="diary-detail-text">{selected.text}</p>
              <div className="mypage-nickname-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setDraft(selected.text)
                    setEditing(true)
                  }}
                >
                  수정하기
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    removeEntry(selectedId)
                    setSelectedId(null)
                  }}
                >
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mypage-panel">
      <div className="mypage-panel-header">
        <button type="button" className="mypage-back" onClick={onBack}>
          ‹
        </button>
        <h3>기록장</h3>
      </div>
      {loading ? (
        <p className="saved-empty">불러오는 중…</p>
      ) : entries.length === 0 ? (
        <p className="saved-empty">아직 기록이 없어요. 빵집 상세에서 "기록 남기기"로 남겨보세요.</p>
      ) : (
        <div className="diary-grid">
          {entries.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className="diary-card"
              onClick={() => openEntry(entry)}
            >
              <span className="diary-card-date">{formatDate(entry.created_at)}</span>
              <span className="diary-card-bakery">{entry.bakery?.name}</span>
              <p className="diary-card-text">{entry.text}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
