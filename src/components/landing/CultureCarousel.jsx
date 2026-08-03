import { useEffect, useRef, useState } from 'react'
import daejeonTour from '../../data/daejeonTour.json'

const SLIDES = daejeonTour.filter((t) => t.type === '문화시설' && t.image).slice(0, 8)
const INTERVAL_MS = 4500

// 원형 사진 + 하단 소개가 자동으로 전환되는 문화시설 캐러셀.
// hover 중에는 자동전환을 멈추고, 점 인디케이터로 수동 이동도 가능하게 한다.
export default function CultureCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (paused || SLIDES.length <= 1) return
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length)
    }, INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [paused])

  if (SLIDES.length === 0) return null

  const current = SLIDES[index]

  return (
    <div
      className="bm-culture"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="bm-culture-photo-wrap">
        <img key={current.id} src={current.image} alt={current.name} className="bm-culture-photo" />
      </div>

      <div className="bm-culture-caption">
        <div className="bm-culture-name">{current.name}</div>
        {current.addr && <div className="bm-culture-addr">{current.addr}</div>}
      </div>

      <div className="bm-culture-dots">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={'bm-culture-dot' + (i === index ? ' active' : '')}
            aria-label={`${s.name} 보기`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  )
}
