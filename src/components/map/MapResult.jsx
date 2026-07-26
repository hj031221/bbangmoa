import { useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useBakeries } from '../../hooks/useBakeries'
import { useCurrentLocation } from '../../hooks/useCurrentLocation'
import { getRegion } from '../../config/regions'
import { isWithinBbox, formatDistance, haversineKm } from '../../lib/distance'
import { getBakeryDistanceInfo } from '../../lib/bakeryDistance'
import daejeonTour from '../../data/daejeonTour.json'
import MapView from './MapView'
import RecommendCard from './RecommendCard'

// 관광지 좌표만 미리 추림(이름·좌표). 빵집별 최근접 1곳 계산에 재사용.
const TOUR_SPOTS = daejeonTour.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng))

// 빵집 한 곳에서 가장 가까운 관광지 1곳 → { name, km, lat, lng }
function nearestAttraction(bakery) {
  if (!Number.isFinite(bakery.lat) || !Number.isFinite(bakery.lng)) return null
  let best = null
  for (const t of TOUR_SPOTS) {
    const km = haversineKm({ lat: bakery.lat, lng: bakery.lng }, { lat: t.lat, lng: t.lng })
    if (!best || km < best.km) best = { name: t.name, km, lat: t.lat, lng: t.lng }
  }
  return best
}

// 취향 일치율 기반 지도 + 추천 리스트. onRetake: 취향 설문 다시 하기.
export default function MapResult({ onRetake }) {
  const regionId = useAppStore((s) => s.regionId)
  const origin = useAppStore((s) => s.origin)
  const answers = useAppStore((s) => s.answers)
  const selectedBakeryId = useAppStore((s) => s.selectedBakeryId)
  const selectBakery = useAppStore((s) => s.selectBakery)
  const region = getRegion(regionId)

  const { bakeries, loading, error, source } = useBakeries({ regionId, answers, origin })
  const { status: locStatus, coords, label: locLabel } = useCurrentLocation()
  const inRegion = isWithinBbox(coords, region.bbox)

  // 빵집별 거리: 설문서 고른 origin 우선, 없으면 현재 위치/역 폴백
  const bakeriesWithDist = useMemo(
    () =>
      bakeries.map((b) => ({
        ...b,
        distInfo: getBakeryDistanceInfo(b, { origin, coords, bbox: region.bbox }),
        nearSpot: nearestAttraction(b),
      })),
    [bakeries, origin, coords, region],
  )
  const selected =
    bakeriesWithDist.find((b) => b.id === selectedBakeryId) || bakeriesWithDist[0]

  // 유저가 실제로 클릭한 빵집만 (초기 자동선택 제외) → 그 빵집의 최근접 관광지 1개만 지도에 표시
  const clickedBakery = selectedBakeryId
    ? bakeriesWithDist.find((b) => b.id === selectedBakeryId)
    : null
  const nearbyAttractions = useMemo(
    () => (clickedBakery?.nearSpot ? [clickedBakery.nearSpot] : []),
    [clickedBakery],
  )

  return (
    <div className="result">
      <header className="result-header">
        <button className="ghost-btn" onClick={onRetake}>
          ← 취향 다시 설정
        </button>
        <h2>대전 빵집 추천 ({bakeries.length}곳)</h2>
        {source === 'sample' && (
          <span className="badge warn">샘플 데이터 (API 키 미설정)</span>
        )}
        {origin ? (
          <span className="badge location">📍 출발: {origin.label} · 가까운 순</span>
        ) : (
          <>
            {locStatus === 'ready' && (
              <span className="badge location">
                📍 현재 위치: {locLabel || `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`}
                {!inRegion && ' · 대전 밖 → 역 기준 거리 표시'}
              </span>
            )}
            {locStatus === 'denied' && (
              <span className="badge warn">위치 접근 거부됨 · 역 기준 거리로 표시</span>
            )}
          </>
        )}
      </header>

      {error && <div className="banner error">데이터 오류: {String(error.message)}</div>}
      {loading && <div className="banner">불러오는 중…</div>}

      <div className="result-body">
        <section className="result-map">
          <MapView
            bakeries={bakeriesWithDist}
            selectedId={selectedBakeryId}
            onSelect={selectBakery}
            attractions={nearbyAttractions}
          />
        </section>

        <aside className="result-side">
          <RecommendCard bakery={selected} />
          <ol className="rec-list">
            {bakeriesWithDist.map((b, i) => (
              <li
                key={b.id}
                className={'rec-list-item' + (b.id === selected?.id ? ' active' : '')}
                onClick={() => selectBakery(b.id)}
              >
                <span className="rank">{i + 1}</span>
                <span className="rl-name">{b.name}</span>
                {b.distInfo && (
                  <span className="rl-dist">{formatDistance(b.distInfo.km)}</span>
                )}
                {typeof b.score === 'number' && b.score > 0 && (
                  <span className="rl-score">{b.score}</span>
                )}
                {b.nearSpot && (
                  <span className="rl-near">📸 근처 관광지 · {b.nearSpot.name} · {formatDistance(b.nearSpot.km)}</span>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}
