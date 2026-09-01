import { useMemo, useState } from 'react'
import { useDiaryEntries } from '../../hooks/useDiaryEntries'
import { useStampTarget } from '../../hooks/useStampTarget'
import { computeVisitStamps } from '../../lib/visitStamps'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from './daejeonStampPaths'
import VisitStampModal from './VisitStampModal'

function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100
}

// 마이페이지 홈 / 친구 상세 첫 화면의 전체폭 스탬프 밴드.
// targetUserId 가 있으면 그 친구의 기록·목표로 계산하고 모달은 읽기 전용이 된다.
// 로그인 게이트 불필요 — MyPage 의 로그인된 분기에서만 마운트된다.
export default function VisitStampBand({ targetUserId, nickname }) {
  const { entries, loading } = useDiaryEntries(targetUserId)
  const { target, setTarget } = useStampTarget(targetUserId)
  const stamp = useMemo(
    () => computeVisitStamps(entries, { targetPerDistrict: target }),
    [entries, target],
  )
  const [open, setOpen] = useState(false)

  const pending = loading && entries.length === 0
  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.goalPct]))

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
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <span className="visit-stamp-band-body">
          <span className="visit-stamp-band-top">
            <strong>
              스탬프 {stamp.completedSlots}/{stamp.totalSlots}
            </strong>
            <span className="visit-stamp-band-conquer">
              {stamp.completedDistrictCount}/5개 구 목표 완료
            </span>
          </span>
          <span className="visit-stamp-bar">
            <span className="visit-stamp-bar-fill" style={{ width: `${stamp.goalPct}%` }} />
          </span>
          <span className="visit-stamp-band-sub">목표 달성률 {stamp.goalPct}%</span>
        </span>
      </button>

      {open && (
        <VisitStampModal
          stamp={stamp}
          target={target}
          onTargetChange={setTarget}
          editable={!targetUserId}
          nickname={nickname}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
