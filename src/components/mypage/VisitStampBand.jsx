import { useMemo, useState } from 'react'
import { useDiaryEntries } from '../../hooks/useDiaryEntries'
import { computeVisitStamps } from '../../lib/visitStamps'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from './daejeonStampPaths'
import VisitStampModal from './VisitStampModal'

// 마이페이지 홈 / 친구 기록장 상단의 전체폭 방문 스탬프 띠.
// targetUserId 가 있으면 그 친구 기록장으로 계산한다(useDiaryEntries 가 이미 지원).
// 로그인 게이트는 불필요 — 이 컴포넌트는 MyPage 의 로그인된 분기에서만 마운트된다.
function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100
}

export default function VisitStampBand({ targetUserId, nickname }) {
  const { entries, loading } = useDiaryEntries(targetUserId)
  const stamp = useMemo(() => computeVisitStamps(entries), [entries])
  const [open, setOpen] = useState(false)

  const pending = loading && entries.length === 0
  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.pct]))

  return (
    <>
      <button
        type="button"
        className="visit-stamp-band"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        <svg className="visit-stamp-band-map" viewBox={STAMP_VIEWBOX} aria-hidden="true">
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

        <span className="visit-stamp-band-body">
          <span className="visit-stamp-band-top">
            <strong>대전 {stamp.overallPct}%</strong>
            <span className="visit-stamp-band-conquer">{stamp.conqueredCount}/5 구 정복</span>
          </span>
          <span className="visit-stamp-bar">
            <span
              className="visit-stamp-bar-fill"
              style={{ width: `${stamp.overallPct}%` }}
            />
          </span>
        </span>
      </button>

      {open && (
        <VisitStampModal stamp={stamp} nickname={nickname} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
