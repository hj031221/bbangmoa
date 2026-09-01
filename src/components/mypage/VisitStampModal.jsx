import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from './daejeonStampPaths'

// 방문 스탬프 상세 모달. CourseNameModal 패턴(auth-modal 공용 클래스, Escape/배경 닫기,
// body 스크롤 잠금). stamp = computeVisitStamps() 결과.
// editable=true(본인)면 목표 프리셋 컨트롤, false(친구)면 '목표: 구마다 N곳' 읽기 전용.
function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100 // pct 0 이어도 형태가 보이도록 최소 0.15
}

const PRESETS = [1, 3, 5]

export default function VisitStampModal({ stamp, target, onTargetChange, editable, nickname, onClose }) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState(String(target))

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.goalPct]))
  const heading = nickname ? `${nickname}님의 스탬프` : '내 스탬프'

  const commitCustom = () => {
    const n = Number(customValue)
    if (Number.isFinite(n)) onTargetChange(n)
    setCustomOpen(false)
  }

  return createPortal(
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal visit-stamp-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" aria-label="닫기" onClick={onClose}>
          ✕
        </button>
        <div className="auth-modal-copy">
          <h3 className="auth-modal-title">{heading}</h3>
        </div>

        {editable ? (
          <div className="visit-stamp-goal">
            <span className="visit-stamp-goal-label">구마다</span>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`visit-stamp-goal-btn${target === p && !customOpen ? ' is-active' : ''}`}
                onClick={() => {
                  setCustomOpen(false)
                  onTargetChange(p)
                }}
              >
                {p}곳
              </button>
            ))}
            <button
              type="button"
              className={`visit-stamp-goal-btn${customOpen || !PRESETS.includes(target) ? ' is-active' : ''}`}
              onClick={() => {
                setCustomValue(String(target))
                setCustomOpen(true)
              }}
            >
              직접
            </button>
            {customOpen && (
              <input
                type="number"
                min={1}
                max={20}
                className="visit-stamp-goal-input"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onBlur={commitCustom}
                onKeyDown={(e) => e.key === 'Enter' && commitCustom()}
                autoFocus
              />
            )}
          </div>
        ) : (
          <p className="visit-stamp-goal-readonly">목표: 구마다 {target}곳</p>
        )}

        <svg
          className="visit-stamp-modal-map"
          viewBox={STAMP_VIEWBOX}
          role="img"
          aria-label="대전 5개 구 스탬프 달성도"
        >
          {DISTRICT_PATHS.map(({ name, d }) => (
            <path
              key={name}
              d={d}
              fill="var(--accent)"
              fillOpacity={fillOpacity(pctByName[name] ?? 0)}
              stroke="var(--brown)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {DISTRICT_PATHS.map(({ name, cx, cy }) => (
            <text
              key={name + '-label'}
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fill="var(--brown)"
              style={{ pointerEvents: 'none' }}
            >
              {name}
            </text>
          ))}
        </svg>

        <div className="visit-stamp-modal-stats">
          <p className="visit-stamp-modal-headline">
            스탬프 {stamp.completedSlots}/{stamp.totalSlots}
            <span className="visit-stamp-modal-goalpct"> · 목표 달성률 {stamp.goalPct}%</span>
          </p>
          <p>{stamp.completedDistrictCount}/5개 구 목표 완료</p>
          <p>방문한 빵집 {stamp.visitedBakeryCount}곳</p>
        </div>

        <ul className="visit-stamp-modal-list">
          {stamp.perDistrict.map((d) => (
            <li key={d.name} className="visit-stamp-modal-row">
              <span className="visit-stamp-modal-name">{d.name}</span>
              <span className="visit-stamp-bar">
                <span className="visit-stamp-bar-fill" style={{ width: `${d.goalPct}%` }} />
              </span>
              <span className="visit-stamp-modal-pct">
                {d.completedSlots}/{d.target}
              </span>
              <span className="visit-stamp-modal-check" aria-hidden="true">
                {d.completed ? '✓' : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
