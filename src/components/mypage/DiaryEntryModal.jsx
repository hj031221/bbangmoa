import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// 빵집 상세 카드(RecommendCard)에서 "기록 남기기" 클릭 시 뜨는 텍스트 작성 모달.
export default function DiaryEntryModal({ bakery, onClose, onSubmit }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setSaving(true)
    await onSubmit(trimmed)
    setSaving(false)
    onClose()
  }

  return createPortal(
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal diary-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" aria-label="닫기" onClick={onClose}>
          ✕
        </button>
        <div className="auth-modal-copy">
          <span className="auth-modal-emoji" aria-hidden="true">📝</span>
          <h3 className="auth-modal-title">{bakery.name} 기록 남기기</h3>
        </div>
        <form className="diary-modal-form" onSubmit={submit}>
          <textarea
            className="diary-modal-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="오늘 이 빵집에서 어떤 빵을 먹었나요?"
            rows={5}
            autoFocus
          />
          <button type="submit" className="primary-btn" disabled={saving || !text.trim()}>
            {saving ? '저장 중…' : '기록하기'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}
