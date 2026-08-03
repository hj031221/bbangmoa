import { useEffect, useRef, useState } from 'react'

const INTERVAL_MS = 3000
const SLOT_WIDTH = 130 // 슬롯 1개의 가로 폭(px). 원 크기는 이 폭과 무관하게 scale 로 커진다.

function distanceStyle(dist) {
  if (dist === 0) return { scale: 1, opacity: 1 }
  if (dist === 1) return { scale: 0.68, opacity: 0.75 }
  if (dist === 2) return { scale: 0.5, opacity: 0.45 }
  return { scale: 0.38, opacity: 0.2 }
}

// 장소 여러 곳을 한 줄에 늘어놓고, 가운데(현재 소개 중인 곳)만 크게 보여주는 캐러셀.
// 자동으로 한 칸씩 넘어가며 슬라이드하고(hover 시 정지), 마지막→처음으로 돌아갈 때만
// 애니메이션 없이 순간 이동해 화면이 거꾸로 훑고 지나가는 걸 막는다.
// items: { id, name, addr, image }[] — 문화시설/관광지 등 daejeonTour.json 계열 데이터.
export default function CultureCarousel({ items }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [instant, setInstant] = useState(false)
  const timerRef = useRef(null)

  const step = (delta) => {
    setIndex((i) => {
      const next = i + delta
      if (next < 0) {
        setInstant(true)
        return items.length - 1
      }
      if (next >= items.length) {
        setInstant(true)
        return 0
      }
      return next
    })
  }

  useEffect(() => {
    if (paused || items.length <= 1) return
    timerRef.current = setInterval(() => step(1), INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [paused, items])

  useEffect(() => {
    if (!instant) return
    const id = requestAnimationFrame(() => setInstant(false))
    return () => cancelAnimationFrame(id)
  }, [instant])

  if (items.length === 0) return null

  const current = items[index]

  return (
    <div
      className="bm-culture"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="bm-culture-viewport-wrap">
        <button type="button" className="bm-culture-arrow bm-culture-arrow-prev" aria-label="이전 장소" onClick={() => step(-1)}>
          ‹
        </button>

        <div className="bm-culture-viewport">
          <div
            className={'bm-culture-strip' + (instant ? ' bm-culture-strip-instant' : '')}
            style={{ transform: `translateX(calc(50% - ${SLOT_WIDTH / 2}px - ${index * SLOT_WIDTH}px))` }}
          >
            {items.map((s, i) => {
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

        <button type="button" className="bm-culture-arrow bm-culture-arrow-next" aria-label="다음 장소" onClick={() => step(1)}>
          ›
        </button>
      </div>

      <div className="bm-culture-caption">
        <div className="bm-culture-name">{current.name}</div>
        {current.addr && <div className="bm-culture-addr">{current.addr}</div>}
      </div>

      <div className="bm-culture-dots">
        {items.map((s, i) => (
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
