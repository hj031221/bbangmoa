import { useEffect, useMemo, useRef, useState } from 'react'
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
  // 사용자가 스와이프/버튼으로 직접 넘길 때마다 증가 — 자동 회전 타이머를 다시 시작시켜
  // (아래 setInterval effect의 deps) 방금 넘긴 직후 곧바로 자동으로 또 넘어가지 않게 한다.
  const [manualNudge, setManualNudge] = useState(0)
  const spotsReadyRef = useRef(TOUR_SPOTS.length > 0)
  const swipeRef = useRef({ x: 0, y: 0, active: false, swiped: false })
  // 터치 기기는 마우스가 없어도 탭이 합성 mouseenter를 발생시켜 hover-pause에 영구히 갇힌다
  // (대응하는 mouseleave가 오지 않음). hover를 실제로 지원하는 기기에서만 pause를 건다.
  const supportsHover = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches,
    [],
  )

  // 관광지 데이터가 실시간 API에서 로딩되는 동안(TOUR_SPOTS가 빈 배열)엔 위 초기 인덱스가
  // 0으로 고정된다 — 데이터가 처음 도착하는 순간 한 번 더 랜덤화해서, 로딩 완료 직후 첫 회전
  // 전까지 항상 같은(응답 순서상 첫 번째) 관광지만 보이던 문제를 없앤다.
  useEffect(() => {
    if (!spotsReadyRef.current && TOUR_SPOTS.length > 0) {
      spotsReadyRef.current = true
      setTourIndex(getRandomTourIndex(TOUR_SPOTS.length))
    }
  }, [TOUR_SPOTS.length])

  useEffect(() => {
    if (tourPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const timer = window.setInterval(() => {
      setTourIndex((current) => getRandomTourIndex(TOUR_SPOTS.length, current))
      setTourStep((current) => (current + 1) % 4)
    }, 4500)

    return () => window.clearInterval(timer)
    // manualNudge 가 바뀌면 타이머를 새로 건다 = 방금 손으로 넘긴 시점부터 다시 4.5초 카운트.
  }, [tourPaused, TOUR_SPOTS.length, manualNudge])

  // 사용자가 직접 넘기기 — 자동 회전(위 setInterval)과 페이드 애니메이션은 그대로 두고,
  // 스와이프/버튼으로 이전·다음 관광지로 이동한다. dir: -1(이전) | 1(다음).
  const goTo = (dir) => {
    if (TOUR_SPOTS.length < 2) return
    setTourIndex((current) => (current + dir + TOUR_SPOTS.length) % TOUR_SPOTS.length)
    setTourStep((current) => (current + (dir > 0 ? 1 : 3)) % 4)
    setManualNudge((n) => n + 1)
  }

  const onTouchStart = (e) => {
    const t = e.touches[0]
    swipeRef.current = { x: t.clientX, y: t.clientY, active: true, swiped: false }
  }
  const onTouchMove = (e) => {
    const s = swipeRef.current
    if (!s.active) return
    const t = e.touches[0]
    if (Math.abs(t.clientX - s.x) > 12 && Math.abs(t.clientX - s.x) > Math.abs(t.clientY - s.y)) {
      s.swiped = true // 가로 스와이프로 판정되면 뒤이어 오는 click(상세 이동)을 무시한다
    }
  }
  const onTouchEnd = (e) => {
    const s = swipeRef.current
    s.active = false
    const dx = (e.changedTouches[0]?.clientX ?? s.x) - s.x
    const dy = (e.changedTouches[0]?.clientY ?? s.y) - s.y
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      s.swiped = true
      goTo(dx < 0 ? 1 : -1)
    }
  }
  const onCardClick = () => {
    if (swipeRef.current.swiped) {
      swipeRef.current.swiped = false
      return
    }
    onOpenTour?.(TOUR_SPOTS[tourIndex]?.id)
  }

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
        onMouseEnter={() => supportsHover && setTourPaused(true)}
        onMouseLeave={() => supportsHover && setTourPaused(false)}
        onFocusCapture={() => setTourPaused(true)}
        onBlurCapture={() => setTourPaused(false)}
      >
        {TOUR_SPOTS[tourIndex] && (
          <div className="bm-tour-showcase-frame">
            <button
              type="button"
              className="bm-tour-showcase-card"
              onClick={onCardClick}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
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
            {TOUR_SPOTS.length > 1 && (
              <>
                <button
                  type="button"
                  className="bm-tour-showcase-nav prev"
                  aria-label="이전 관광지"
                  onClick={() => goTo(-1)}
                >
                  <svg viewBox="0 0 16 28" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="13 4 3 14 13 24" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="bm-tour-showcase-nav next"
                  aria-label="다음 관광지"
                  onClick={() => goTo(1)}
                >
                  <svg viewBox="0 0 16 28" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 4 13 14 3 24" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

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
