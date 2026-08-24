import { useEffect, useMemo, useState } from 'react'
import heroIllustration from '../../assets/landing-hero-illustration.svg'
import { useAttractions } from '../../hooks/useAttractions'

const TOUR_CAPTIONS = {
  nature: '산책과 휴식을 함께 즐기기 좋은 자연 명소',
  history: '대전의 이야기를 가까이에서 만나는 역사 명소',
  culture: '전시와 예술을 여유롭게 즐기는 문화 공간',
  education: '새로운 지식과 체험을 만나는 배움 공간',
  etc: '대전에서 색다른 시간을 보내기 좋은 장소',
}

function getRandomTourIndex(total, current = -1) {
  const next = Math.floor(Math.random() * (total - (current >= 0 ? 1 : 0)))
  return current >= 0 && next >= current ? next + 1 : next
}

// 메인 화면 히어로 — 팀 시안(1p) 구성: 좌측 정렬 헤드라인+검색창+CTA 2개, 그 아래 시안
// 일러스트를 화면 전체 폭으로 깔아 시안처럼 이미지가 화면 전체에 걸치도록 한다.
export default function MainHero({ onStart, onOpenMap, onOpenTour, onSearch }) {
  const { tagged } = useAttractions()
  const TOUR_SPOTS = useMemo(
    () =>
      tagged
        .filter((place) => place.image?.startsWith('https://'))
        .map((place) => ({
          ...place,
          caption: TOUR_CAPTIONS[place.themes[0]] ?? TOUR_CAPTIONS.etc,
        })),
    [tagged],
  )
  const [query, setQuery] = useState('')
  const [tourIndex, setTourIndex] = useState(() => getRandomTourIndex(TOUR_SPOTS.length))
  const [tourStep, setTourStep] = useState(0)
  const [tourPaused, setTourPaused] = useState(false)

  useEffect(() => {
    if (tourPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const timer = window.setInterval(() => {
      setTourIndex((current) => getRandomTourIndex(TOUR_SPOTS.length, current))
      setTourStep((current) => (current + 1) % 4)
    }, 4500)

    return () => window.clearInterval(timer)
  }, [tourPaused, TOUR_SPOTS.length])

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
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 6 6" />
            </svg>
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

      <div
        className="bm-tour-showcase"
        role="region"
        aria-label="대전 추천 관광지"
        aria-roledescription="캐러셀"
        onMouseEnter={() => setTourPaused(true)}
        onMouseLeave={() => setTourPaused(false)}
        onFocusCapture={() => setTourPaused(true)}
        onBlurCapture={() => setTourPaused(false)}
      >
        <button
          type="button"
          className="bm-tour-showcase-card"
          onClick={() => onOpenTour?.(TOUR_SPOTS[tourIndex].id)}
          aria-label={`${TOUR_SPOTS[tourIndex].name} 자세히 보기`}
        >
          <img
            key={TOUR_SPOTS[tourIndex].id}
            src={TOUR_SPOTS[tourIndex].image}
            alt=""
          />
          <span className="bm-tour-showcase-copy">
            <small>대전에서 여기도 어때요?</small>
            <strong>{TOUR_SPOTS[tourIndex].name}</strong>
            <span>{TOUR_SPOTS[tourIndex].caption}</span>
          </span>
          <span className="bm-tour-showcase-more" aria-hidden="true">둘러보기 →</span>
        </button>

        <div className="bm-tour-showcase-dots" aria-hidden="true">
          {[0, 1, 2, 3].map((step) => (
            <span key={step} className={step === tourStep ? 'active' : ''} />
          ))}
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
