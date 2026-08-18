import { useState } from 'react'

// 메인 화면 히어로 — 팀 시안(1p) 구성: 헤드라인 + 검색창 + CTA 2개(좌) / 지도·빵집 일러스트(우).
// InfoPage 의 Hero 가 쓰는 2단 그리드(.bm-hero-grid/.bm-hero-copy)를 그대로 재사용한다.
export default function MainHero({ onStart, onSearch }) {
  const [query, setQuery] = useState('')

  const submitSearch = (e) => {
    e.preventDefault()
    const q = query.trim()
    if (q) onSearch?.(q)
  }

  return (
    <section className="bm-mhero" id="bm-hero">
      <div className="bm-hero-grid">
        <div className="bm-hero-copy">
          <h1>대전의 맛있는 빵을 한 곳에 모았어요!</h1>
          <p>간단한 설문으로 나에게 맞는 대전의 빵집을 찾아보세요</p>

          <form className="bm-mhero-search" onSubmit={submitSearch}>
            <input
              type="text"
              placeholder="빵집을 검색해보세요"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="빵집 검색"
            />
            <button type="submit" aria-label="검색">
              🔍
            </button>
          </form>

          <div className="bm-mhero-actions">
            <button className="bm-btn-primary" onClick={onStart}>
              내 취향 빵 찾기
            </button>
            <button className="bm-btn-ghost" onClick={onStart}>
              빵 지도 보기
            </button>
          </div>
        </div>

        <div className="bm-mhero-visual" aria-hidden="true">
          <BreadMapIllustration />
        </div>
      </div>
    </section>
  )
}

// 지도 카드 위에 핀 + 빵집 태그 + 빵 아이콘을 얹은 단순화된 일러스트.
function BreadMapIllustration() {
  return (
    <svg viewBox="0 0 400 320" className="bm-mhero-illustration" role="img" aria-labelledby="bmMapIllusTitle">
      <title id="bmMapIllusTitle">대전 빵집 지도 일러스트</title>

      {/* 지도 카드 */}
      <g transform="translate(30 30) rotate(-4 170 130)">
        <rect x="0" y="0" width="340" height="260" rx="22" fill="var(--bm-card)" stroke="var(--bm-line)" strokeWidth="2" />
        {/* 강줄기 */}
        <path
          d="M20 40 C 80 60, 60 110, 120 130 S 200 170, 180 220"
          fill="none"
          stroke="#BFE0E8"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* 점선 도로 */}
        <path d="M40 220 C 100 190, 160 90, 300 60" fill="none" stroke="var(--bm-line)" strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
        <path d="M260 20 L 300 230" fill="none" stroke="var(--bm-line)" strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
        {/* 초록 블록(공원) */}
        <circle cx="70" cy="180" r="20" fill="#CFE8CE" />
        <circle cx="260" cy="150" r="16" fill="#CFE8CE" />

        {/* 빵집 태그 */}
        <g transform="translate(210 40)">
          <rect x="-46" y="-20" width="92" height="34" rx="17" fill="var(--bm-card)" stroke="var(--bm-accent)" strokeWidth="2" />
          <text x="0" y="2" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--bm-ink)">
            Bakery
          </text>
        </g>

        {/* 핀 */}
        <g transform="translate(150 110)">
          <path d="M0 0 C -22 0 -38 16 -38 36 C -38 62 0 96 0 96 S 38 62 38 36 C 38 16 22 0 0 0 Z" fill="var(--bm-accent)" />
          <circle cx="0" cy="34" r="16" fill="#fff" />
          {/* 식빵 실루엣 */}
          <g transform="translate(-11 26)">
            <path
              d="M0 20 L0 8 C0 3 4 -3 11 -3 C18 -3 22 3 22 8 L22 20 C22 22 20 24 18 24 L4 24 C2 24 0 22 0 20 Z"
              fill="#E8B166"
            />
          </g>
        </g>
      </g>

      {/* 크루아상 */}
      <text x="330" y="270" fontSize="46" transform="rotate(8 330 270)">
        🥐
      </text>
      {/* 구름 */}
      <text x="10" y="30" fontSize="30" opacity="0.7">
        ☁️
      </text>
      <text x="340" y="20" fontSize="24" opacity="0.6">
        ☁️
      </text>
    </svg>
  )
}
