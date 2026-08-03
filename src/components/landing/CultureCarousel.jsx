import { useEffect, useRef, useState } from 'react'
import daejeonTour from '../../data/daejeonTour.json'

const SLIDES = daejeonTour.filter((t) => t.type === '문화시설' && t.image).slice(0, 20)
const INTERVAL_MS = 4500
const SLOT_WIDTH = 130 // 슬롯 1개의 가로 폭(px). 원 크기는 이 폭과 무관하게 scale 로 커진다.

function distanceStyle(dist) {
  if (dist === 0) return { scale: 1, opacity: 1 }
  if (dist === 1) return { scale: 0.68, opacity: 0.75 }
  if (dist === 2) return { scale: 0.5, opacity: 0.45 }
  return { scale: 0.38, opacity: 0.2 }
}

// 문화시설 여러 곳을 한 줄에 늘어놓고, 가운데(현재 소개 중인 곳)만 크게 보여주는 캐러셀.
// 자동으로 한 칸씩 넘어가며 슬라이드하고(hover 시 정지), 마지막→처음으로 돌아갈 때만
// 애니메이션 없이 순간 이동해 화면이 거꾸로 훑고 지나가는 걸 막는다.
export default function CultureCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [instant, setInstant] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (paused || SLIDES.length <= 1) return
    timerRef.current = setInterval(() => {
      setIndex((i) => {
        if (i + 1 >= SLIDES.length) {
          setInstant(true)
          return 0
        }
        return i + 1
      })
    }, INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [paused])

  useEffect(() => {
    if (!instant) return
    const id = requestAnimationFrame(() => setInstant(false))
    return () => cancelAnimationFrame(id)
  }, [instant])

  if (SLIDES.length === 0) return null

  const current = SLIDES[index]

  return (
    <div
      className="bm-culture"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="bm-culture-viewport">
        <div
          className={'bm-culture-strip' + (instant ? ' bm-culture-strip-instant' : '')}
          style={{ transform: `translateX(calc(50% - ${SLOT_WIDTH / 2}px - ${index * SLOT_WIDTH}px))` }}
        >
          {SLIDES.map((s, i) => {
            const { scale, opacity } = distanceStyle(Math.abs(i - index))
            return (
              <div className="bm-culture-slot" key={s.id} style={{ width: SLOT_WIDTH }}>
                <img
                  src={s.image}
                  alt={s.name}
                  className="bm-culture-circle"
                  style={{ transform: `scale(${scale})`, opacity }}
                />
              </div>
            )
          })}
        </div>
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
