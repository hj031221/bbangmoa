import { useState } from 'react'
import heroIllustration from '../../assets/landing-hero-illustration.svg'

// 메인 화면 히어로 — 팀 시안(1p) 구성: 좌측 정렬 헤드라인+검색창+CTA 2개, 그 아래 시안
// 일러스트를 화면 전체 폭으로 깔아 시안처럼 이미지가 화면 전체에 걸치도록 한다.
export default function MainHero({ onStart, onOpenMap, onSearch }) {
  const [query, setQuery] = useState('')

  const submitSearch = (e) => {
    e.preventDefault()
    const q = query.trim()
    if (q) onSearch?.(q)
  }

  return (
    <section className="bm-mhero" id="bm-hero">
      <div className="bm-mhero-copy">
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
          <button className="bm-btn-ghost" onClick={onOpenMap}>
            빵 지도 보기
          </button>
        </div>
      </div>

      <img
        className="bm-mhero-illustration"
        src={heroIllustration}
        alt="대전 지도 위 빵집과 빵 일러스트"
      />
    </section>
  )
}
