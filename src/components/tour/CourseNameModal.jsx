import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// 이슈 #60 — "대전한바퀴" 코스 저장/이름 수정 공용 입력 모달. DiaryEntryModal과 같은 구조
// (auth-modal 공용 클래스, Escape로 닫기, body 스크롤 잠금)를 그대로 따른다.
// existingNames — 같은 사용자의 다른 저장 코스 제목 목록. 겹치면 제출을 막고 안내만 띄운다
// (렌더 쪽에서 수정 대상 본인 제목은 미리 빼고 넘겨야 함).
export default function CourseNameModal({ heading, initialValue, existingNames = [], onClose, onSubmit }) {
  const [name, setName] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // onClose는 부모가 매 렌더 새로 만드는 인라인 함수라, deps에 넣으면 이름 입력 한 글자마다
  // 리스너를 뗐다 다시 붙인다. ref로 최신 함수만 갱신해 받고, 이 effect는 마운트/언마운트에만 반응.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (existingNames.includes(trimmed)) {
      setError('이미 같은 이름의 코스가 있어요. 다른 이름을 써주세요.')
      return
    }
    setSaving(true)
    setError('')
    const result = await onSubmit(trimmed)
    setSaving(false)
    if (result?.error) {
      setError('저장에 실패했어요. 다시 시도해주세요.')
      return
    }
    onClose()
  }

  return createPortal(
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" aria-label="닫기" onClick={onClose}>
          ✕
        </button>
        <div className="auth-modal-copy">
          <h3 className="auth-modal-title">{heading}</h3>
        </div>
        <form className="diary-modal-form" onSubmit={submit}>
          <input
            type="text"
            className="mypage-nickname-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            maxLength={30}
            autoFocus
          />
          {error && <p className="diary-modal-error">{error}</p>}
          <button type="submit" className="primary-btn" disabled={saving || !name.trim()}>
            {saving ? '저장 중…' : '확인'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}
