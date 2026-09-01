import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useDiaryEntries } from '../../hooks/useDiaryEntries'
import { useDiaryLikes } from '../../hooks/useDiaryLikes'
import { useDiaryComments } from '../../hooks/useDiaryComments'
import { formatDiaryDate as formatDate, formatDiaryDateTime } from '../../lib/formatDate'
import DiaryVerificationBadge from './DiaryVerificationBadge'

// 마이페이지 기록장 패널. 작성은 RecommendCard(빵집 상세)의 "기록 남기기"에서만 가능
// — 여기선 목록 보기 / 수정 / 삭제만 한다. targetUserId+readOnly 면 친구 기록장을 읽기 전용으로 본다.
// readOnly 는 "이 기록을 수정/삭제할 수 없다"는 뜻일 뿐 — 좋아요/댓글은 본인/친구 기록장 모두 허용한다
// (RLS 의 can_see_entry 가 실제 가시성을 판정하므로 여기선 항상 렌더링해도 안전하다).
export default function DiaryPanel({ onBack, targetUserId, readOnly = false, friendNickname }) {
  const { user } = useAuth()
  const { entries, loading, updateEntry, removeEntry } = useDiaryEntries(targetUserId)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)

  const { count: likeCount, likedByMe, toggle: toggleLike } = useDiaryLikes(selectedId)
  const { comments, add: addComment, remove: removeComment } = useDiaryComments(selectedId)

  const selected = entries.find((e) => e.id === selectedId)

  const openEntry = (entry) => {
    setSelectedId(entry.id)
    setEditing(false)
    setDraft(entry.text)
    setCommentDraft('')
  }

  const submitEdit = (e) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    updateEntry(selectedId, trimmed)
    setEditing(false)
  }

  const submitComment = async (e) => {
    e.preventDefault()
    if (!commentDraft.trim()) return
    setCommentSaving(true)
    const { error } = await addComment(commentDraft)
    setCommentSaving(false)
    if (!error) setCommentDraft('')
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
            <span className="diary-detail-bakery-row">
              <span className="diary-detail-bakery">{selected.bakery?.name}</span>
              <DiaryVerificationBadge verified={selected.verified} />
            </span>
            <span>{formatDate(selected.created_at)}</span>
          </div>
          {editing && !readOnly ? (
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
              {!readOnly && (
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
              )}
            </>
          )}

          <div className="diary-social">
            <button
              type="button"
              className={likedByMe ? 'diary-like-btn diary-like-btn-active' : 'diary-like-btn'}
              onClick={toggleLike}
              aria-pressed={likedByMe}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M12 20.5s-7.5-4.6-10-9.3C.4 8 1.9 4.5 5.3 4c2.1-.3 4 .7 5.2 2.6l1.5 2.3 1.5-2.3C14.7 4.7 16.6 3.7 18.7 4c3.4.5 4.9 4 3.3 7.2C19.5 15.9 12 20.5 12 20.5z"
                  fill={likedByMe ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              {likeCount > 0 ? likeCount : '좋아요'}
            </button>

            <div className="diary-comments">
              {comments.map((c) => (
                <div key={c.id} className="diary-comment">
                  <span className="friend-avatar friend-avatar-sm diary-comment-avatar" aria-hidden="true">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : (c.nickname?.[0] || '?')}
                  </span>
                  <div className="diary-comment-body">
                    <div className="diary-comment-meta">
                      <span className="diary-comment-nickname">{c.nickname}</span>
                      <span className="diary-comment-time">{formatDiaryDateTime(c.created_at)}</span>
                    </div>
                    <p className="diary-comment-text">{c.text}</p>
                    {user?.id === c.user_id && (
                      <button type="button" className="diary-comment-delete" onClick={() => removeComment(c.id)}>
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form className="diary-comment-form" onSubmit={submitComment}>
              <input
                type="text"
                className="diary-comment-input"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="댓글을 남겨보세요"
                maxLength={300}
              />
              <button type="submit" className="ghost-btn" disabled={commentSaving || !commentDraft.trim()}>
                {commentSaving ? '등록 중…' : '등록'}
              </button>
            </form>
          </div>
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
        <p className="saved-empty">
          {readOnly
            ? `${friendNickname || '친구'}님이 아직 남긴 기록이 없어요.`
            : '아직 기록이 없어요. 빵집 상세에서 "기록 남기기"로 남겨보세요.'}
        </p>
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
              <span className="diary-card-bakery-row">
                <span className="diary-card-bakery">{entry.bakery?.name}</span>
                <DiaryVerificationBadge verified={entry.verified} />
              </span>
              <p className="diary-card-text">{entry.text}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
