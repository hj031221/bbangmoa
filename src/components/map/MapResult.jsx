import { useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useBakeries } from '../../hooks/useBakeries'
import { useCurrentLocation } from '../../hooks/useCurrentLocation'
import { getRegion } from '../../config/regions'
import { isWithinBbox, formatDistance, haversineKm } from '../../lib/distance'
import { getBakeryDistanceInfo } from '../../lib/bakeryDistance'
import { pickBreadResult, matchBakeries } from '../../lib/breadRecommend'
import daejeonTour from '../../data/daejeonTour.json'
import MapView from './MapView'
import RecommendCard from './RecommendCard'
import MapSelectionSummary from './MapSelectionSummary'

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

  // answers 는 넘기지 않는다 — 옛 태그-가중치 정렬(recommend.js)은 새 Q1~Q5 응답과 안 맞아 항상
  // 무력화된다. limit: Infinity 로 전체 풀을 받아와서 아래에서 breadResult 기준으로 직접 추린다.
  const { bakeries, loading, error, source } = useBakeries({
    regionId,
    answers: {},
    origin,
    limit: Infinity,
  })
  const { status: locStatus, coords, label: locLabel } = useCurrentLocation()
  const inRegion = isWithinBbox(coords, region.bbox)

  // 설문에서 나온 "오늘의 빵" 결과가 있으면 그 빵을 파는 빵집만(BreadReveal 과 동일 기준) 보여준다.
  // 결과가 없으면(Q1 미응답 등) 대전 전역을 가까운 순으로 보여주는 기존 방식으로 폴백한다.
  const breadResult = pickBreadResult(answers)
  const filteredBakeries = breadResult ? matchBakeries(bakeries, breadResult.bread, 10) : bakeries

  // 빵집별 거리: 설문서 고른 origin 우선, 없으면 현재 위치/역 폴백
  const bakeriesWithDist = useMemo(
    () =>
      filteredBakeries.map((b) => ({
        ...b,
        distInfo: getBakeryDistanceInfo(b, { origin, coords, bbox: region.bbox }),
        nearSpot: nearestAttraction(b),
        breadType: breadResult?.bread?.name,
        breadTypeEmoji: breadResult?.bread?.emoji,
      })),
    [filteredBakeries, origin, coords, region, breadResult?.bread?.name, breadResult?.bread?.emoji],
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
    <div className="result result-quiz">
      <header className="result-header">
        <button type="button" className="result-back" onClick={onRetake} aria-label="취향 다시 설정">
          <svg viewBox="0 0 16 28" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 4 3 14 13 24" />
          </svg>
        </button>
        <h2>
          {breadResult ? `${breadResult.bread.name} 맛집 추천` : '대전 빵집 추천'} (
          {bakeriesWithDist.length}곳)
        </h2>
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
      {!loading && breadResult && bakeriesWithDist.length === 0 && (
        <div className="banner">이 지역엔 아직 추천할 {breadResult.bread.name} 맛집 정보가 없어요.</div>
      )}

      <div className="result-body">
        <section className="result-map">
          <MapView
            bakeries={bakeriesWithDist}
            selectedId={selectedBakeryId}
            onSelect={selectBakery}
            attractions={nearbyAttractions}
          />
          <MapSelectionSummary bakery={selected} />
        </section>

        <aside className="result-list-col">
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
                {b.nearSpot && (
                  <span className="rl-near">📸 근처 관광지 · {b.nearSpot.name} · {formatDistance(b.nearSpot.km)}</span>
                )}
              </li>
            ))}
          </ol>
        </aside>

        <aside className="result-detail-col">
          <RecommendCard bakery={selected} />
        </aside>
      </div>
    </div>
  )
}
