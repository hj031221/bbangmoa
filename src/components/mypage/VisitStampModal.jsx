import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from './daejeonStampPaths'

// 방문 스탬프 상세 모달. CourseNameModal 과 같은 구조(auth-modal 공용 클래스,
// Escape/배경 클릭 닫기, body 스크롤 잠금)를 따른다. stamp = computeVisitStamps() 결과.
// nickname 이 있으면 친구 것(제목만 달라짐), 없으면 본인 것. 공유 버튼은 3단계.
function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100 // pct 0 이어도 형태가 보이도록 최소 0.15
}

export default function VisitStampModal({ stamp, nickname, onClose }) {
  // onClose 는 부모가 매 렌더 새로 만드는 인라인 함수라 deps 에 넣으면 리스너를 뗐다 붙인다.
  // ref 로 최신 함수만 받고, effect 는 마운트/언마운트에만 반응한다.
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

  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.pct]))
  const title = nickname ? `${nickname}님의 대전 빵 지도` : '내 대전 빵 지도'

  return createPortal(
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" aria-label="닫기" onClick={onClose}>
          ✕
        </button>
        <div className="auth-modal-copy">
          <h3 className="auth-modal-title">{title}</h3>
        </div>

        <svg
          className="visit-stamp-modal-map"
          viewBox={STAMP_VIEWBOX}
          role="img"
          aria-label="대전 5개 구 방문도"
        >
          {DISTRICT_PATHS.map(({ name, d }) => (
            <path
              key={name}
              d={d}
              fill="var(--accent)"
              fillOpacity={fillOpacity(pctByName[name] ?? 0)}
              stroke="var(--brown)"
              strokeWidth="1"
            />
          ))}
        </svg>

        <ul className="visit-stamp-modal-list">
          {stamp.perDistrict.map((d) => (
            <li key={d.name} className="visit-stamp-modal-row">
              <span className="visit-stamp-modal-name">{d.name}</span>
              <span className="visit-stamp-bar">
                <span className="visit-stamp-bar-fill" style={{ width: `${d.pct}%` }} />
              </span>
              <span className="visit-stamp-modal-pct">{d.pct}%</span>
            </li>
          ))}
        </ul>

        <p className="visit-stamp-modal-summary">
          대전 {stamp.overallPct}% · {stamp.conqueredCount}/5 구 정복
        </p>
      </div>
    </div>,
    document.body,
  )
}
