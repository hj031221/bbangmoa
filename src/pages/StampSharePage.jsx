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
      <main className="stamp-share-page">
        <div className="stamp-share-loading" role="status" aria-live="polite">
          <span className="stamp-share-loading-mark" aria-hidden="true" />
          스탬프 기록을 펼치는 중…
        </div>
      </main>
    )
  }

  if (view.status === 'notfound') {
    return (
      <main className="stamp-share-page">
        <article className="stamp-share-sheet stamp-share-sheet-empty">
          <div className="stamp-share-brand"><span aria-hidden="true" />빵모아</div>
          <p className="stamp-share-empty">이 링크는 만료됐거나 존재하지 않아요.</p>
          <a className="stamp-share-cta" href="/">빵모아 홈으로</a>
        </article>
      </main>
    )
  }

  const { nickname, targetPerDistrict, stamp } = view.data
  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.goalPct]))

  return (
    <main className="stamp-share-page">
      <article className="stamp-share-sheet">
        <header className="stamp-share-header">
          <div className="stamp-share-brand"><span aria-hidden="true" />빵모아 · 대전 빵여행 기록</div>
          <p className="stamp-share-owner">{nickname}님의</p>
          <h1 className="stamp-share-title">대전 빵 스탬프</h1>
        </header>

        <div className="stamp-share-summary">
          <div className="stamp-share-score">
            <span>목표 달성률</span>
            <strong>{stamp.goalPct}<small>%</small></strong>
            <dl>
              <div><dt>채운 스탬프</dt><dd>{stamp.completedSlots} / {stamp.totalSlots}</dd></div>
              <div><dt>완료한 구</dt><dd>{stamp.completedDistrictCount} / 5</dd></div>
              <div><dt>인증 방문</dt><dd>{stamp.visitedBakeryCount}곳</dd></div>
            </dl>
          </div>

          <div className="stamp-share-map-wrap">
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
          </div>
        </div>

        <section className="stamp-share-districts" aria-labelledby="stamp-district-title">
          <div className="stamp-share-section-heading">
            <h2 id="stamp-district-title">구별 스탬프</h2>
            <span>구마다 {targetPerDistrict}곳이 목표</span>
          </div>
          <ul className="stamp-share-list">
            {stamp.perDistrict.map((d) => (
              <li key={d.name}>
                <span className="stamp-share-list-name">{d.name}</span>
                <span className="visit-stamp-bar">
                  <span className="visit-stamp-bar-fill" style={{ width: `${d.goalPct}%` }} />
                </span>
                <span className="stamp-share-list-pct">{d.completedSlots} / {d.target}</span>
                <span className={`stamp-share-list-check${d.completed ? ' is-complete' : ''}`} aria-label={d.completed ? '목표 완료' : '진행 중'}>
                  {d.completed ? '✓' : '·'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="stamp-share-footer">
          <a className="stamp-share-cta" href={user ? '/mypage' : '/'}>
            {user ? '내 스탬프 보러가기' : '로그인하고 나도 시작하기'}
          </a>
          <p className="stamp-share-pitch">빵집을 방문하고, 기록하고, 대전을 채워요.</p>
        </footer>
      </article>
    </main>
  )
}
