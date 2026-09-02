import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

// auth-modal 계열 모달(DiaryEntryModal, CourseNameModal, VisitStampModal)의 공용 껍데기.
// createPortal + 배경/Escape 닫기 + body 스크롤 잠금에 더해, 그동안 세 곳 다 빠져 있던
// 접근성(role="dialog"/aria-modal/aria-labelledby, 초기 포커스, 포커스 트랩, 닫을 때
// 여는 요소로 포커스 복귀)을 한곳에서 처리한다.
// lock=true 면 저장 중이므로 배경/Escape/✕ 로 닫히지 않는다(언마운트 중 await 유실 방지).
export default function Modal({ title, icon, className = '', lock = false, onClose, children }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const lockRef = useRef(lock)
  lockRef.current = lock
  // onClose는 부모가 매 렌더 새로 만드는 인라인 함수라 ref로 최신 값만 받는다.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const requestClose = () => {
    if (!lockRef.current) onCloseRef.current()
  }

  useEffect(() => {
    const opener = document.activeElement
    const node = dialogRef.current
    const focusablesIn = () =>
      node
        ? [
            ...node.querySelectorAll(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ].filter((el) => el.getClientRects().length > 0)
        : []

    const focusables = focusablesIn()
    // ✕ 닫기 버튼보다 실제 입력 요소로 먼저 포커스가 가게 한다.
    const initial = focusables.find((el) => !el.classList.contains('auth-modal-close'))
    ;(initial || focusables[0] || node)?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (!lockRef.current) onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusablesIn()
      if (items.length === 0) {
        e.preventDefault()
        node?.focus()
        return
      }
      const idx = items.indexOf(document.activeElement)
      if (e.shiftKey && idx <= 0) {
        e.preventDefault()
        items[items.length - 1].focus()
      } else if (!e.shiftKey && idx === items.length - 1) {
        e.preventDefault()
        items[0].focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  return createPortal(
    <div className="auth-modal-overlay" onClick={requestClose}>
      <div
        className={`auth-modal${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <button
          type="button"
          className="auth-modal-close"
          aria-label="닫기"
          onClick={requestClose}
          disabled={lock}
        >
          ✕
        </button>
        <div className="auth-modal-copy">
          {icon && (
            <span className="auth-modal-emoji" aria-hidden="true">
              {icon}
            </span>
          )}
          <h3 className="auth-modal-title" id={titleId}>
            {title}
          </h3>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
