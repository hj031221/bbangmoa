import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from '../components/mypage/daejeonStampPaths'

function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100
}

// 공유 링크(/s/:code)로 들어온 비로그인 방문자에게 그 사람의 스탬프 결과를 전부 보여주고
// 로그인으로 유도한다. get_public_stamp 는 anon 실행이 허용된다.
export default function StampSharePage({ code }) {
  const { user } = useAuth()
  const [view, setView] = useState({ status: 'loading', data: null })

  useEffect(() => {
    const alive = { current: true }
    if (!code || !supabase) {
      setView({ status: 'notfound', data: null })
      return
    }
    supabase.rpc('get_public_stamp', { p_code: code }).then(({ data, error }) => {
      if (!alive.current) return
      if (error || !data) setView({ status: 'notfound', data: null })
      else setView({ status: 'ok', data })
    })
    return () => {
      alive.current = false
    }
  }, [code])

  useEffect(() => {
    if (view.status !== 'ok') return
    const prev = document.title
    document.title = `${view.data.nickname}님의 대전 빵 스탬프 · 빵모아`
    return () => {
      document.title = prev
    }
  }, [view])

  if (view.status === 'loading') {
    return (
      <div className="stamp-share-page">
        <p className="stamp-share-loading">불러오는 중…</p>
      </div>
    )
  }

  if (view.status === 'notfound') {
    return (
      <div className="stamp-share-page">
        <div className="stamp-share-card">
          <p className="stamp-share-empty">이 링크는 만료됐거나 존재하지 않아요.</p>
          <a className="stamp-share-cta" href="/">빵모아 홈으로</a>
        </div>
      </div>
    )
  }

  const { nickname, targetPerDistrict, stamp } = view.data
  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.goalPct]))

  return (
    <div className="stamp-share-page">
      <div className="stamp-share-card">
        <h1 className="stamp-share-title">{nickname}님의 대전 빵 스탬프</h1>

        <svg
          className="stamp-share-map"
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

        <p className="stamp-share-headline">
          스탬프 {stamp.completedSlots}/{stamp.totalSlots}
          <span> · 목표 달성률 {stamp.goalPct}%</span>
        </p>
        <p className="stamp-share-sub">
          {stamp.completedDistrictCount}/5개 구 목표 완료 · 방문한 빵집 {stamp.visitedBakeryCount}곳 ·
          목표 구마다 {targetPerDistrict}곳
        </p>

        <ul className="stamp-share-list">
          {stamp.perDistrict.map((d) => (
            <li key={d.name}>
              <span className="stamp-share-list-name">{d.name}</span>
              <span className="visit-stamp-bar">
                <span className="visit-stamp-bar-fill" style={{ width: `${d.goalPct}%` }} />
              </span>
              <span className="stamp-share-list-pct">
                {d.completedSlots}/{d.target}
              </span>
              <span className="stamp-share-list-check" aria-hidden="true">
                {d.completed ? '✓' : ''}
              </span>
            </li>
          ))}
        </ul>

        <a className="stamp-share-cta" href="/">
          {user ? '내 스탬프 보러가기' : '로그인하고 나도 대전 빵 스탬프 시작하기'}
        </a>
        <p className="stamp-share-pitch">대전 5개 구 빵집을 돌면서 스탬프를 채워보세요.</p>
      </div>
    </div>
  )
}
