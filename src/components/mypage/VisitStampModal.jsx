import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from './daejeonStampPaths'
import { shareStampCard } from '../../lib/stampShare'

// 방문 스탬프 상세 모달. CourseNameModal 패턴(auth-modal 공용 클래스, Escape/배경 닫기,
// body 스크롤 잠금). stamp = computeVisitStamps() 결과.
// editable=true(본인)면 목표 프리셋 컨트롤, false(친구)면 '목표: 구마다 N곳' 읽기 전용.
function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100 // pct 0 이어도 형태가 보이도록 최소 0.15
}

const PRESETS = [1, 3, 5]

export default function VisitStampModal({ stamp, target, targetPerDistrict, onTargetChange, editable, nickname, onClose }) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState(String(target))
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState('')

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
    const raw = customValue.trim()
    const n = Number(raw)
    if (raw !== '' && Number.isFinite(n)) {
      const clamped = Math.min(20, Math.max(1, Math.round(n)))
      setCustomValue(String(clamped))
      onTargetChange(clamped)
    }
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCustom()
                  else if (e.key === 'Escape') setCustomOpen(false)
                }}
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
          {DISTRICT_PATHS.map(({ name, cx, cy }) => {
            // 목표 달성 구는 채움이 진해져 갈색 글씨가 묻힌다.
            // 진한 구는 흰 글씨, 옅은 구는 갈색 글씨 + 반대색 외곽선(paint-order)으로 항상 읽히게.
            const dark = (pctByName[name] ?? 0) >= 55
            return (
              <text
                key={name + '-label'}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="700"
                fill={dark ? '#fff' : 'var(--brown)'}
                stroke={dark ? 'rgba(76,49,13,0.45)' : '#fff'}
                strokeWidth="2.5"
                strokeLinejoin="round"
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
              >
                {name}
              </text>
            )
          })}
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

        {editable && (
          <div className="visit-stamp-share">
            <button
              type="button"
              className="visit-stamp-share-btn"
              disabled={sharing}
              onClick={async () => {
                setSharing(true)
                setShareMsg('')
                const r = await shareStampCard({
                  nickname: nickname ?? null,
                  stamp,
                  targetPerDistrict: targetPerDistrict ?? target,
                })
                setSharing(false)
                if (r.mode === 'download') setShareMsg('이미지를 저장했어요. 링크도 복사했어요.')
                else if (!r.ok && r.mode !== 'cancel') setShareMsg('공유에 실패했어요. 잠시 후 다시 시도해 주세요.')
                else setShareMsg('')
              }}
            >
              {sharing ? '만드는 중…' : '스탬프 공유하기'}
            </button>
            {shareMsg && <p className="visit-stamp-share-msg">{shareMsg}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
