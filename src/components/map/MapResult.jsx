import { useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useBakeries } from '../../hooks/useBakeries'
import { useCurrentLocation } from '../../hooks/useCurrentLocation'
import { getRegion } from '../../config/regions'
import { isWithinBbox, formatDistance } from '../../lib/distance'
import { getBakeryDistanceInfo } from '../../lib/bakeryDistance'
import MapView from './MapView'
import RecommendCard from './RecommendCard'

// 취향 일치율 기반 지도 + 추천 리스트. onRetake: 취향 설문 다시 하기.
export default function MapResult({ onRetake }) {
  const regionId = useAppStore((s) => s.regionId)
  const district = useAppStore((s) => s.district)
  const answers = useAppStore((s) => s.answers)
  const selectedBakeryId = useAppStore((s) => s.selectedBakeryId)
  const selectBakery = useAppStore((s) => s.selectBakery)
  const region = getRegion(regionId)

  const { bakeries, loading, error, source } = useBakeries({ regionId, answers, district })
  const { status: locStatus, coords, label: locLabel } = useCurrentLocation()
  const inRegion = isWithinBbox(coords, region.bbox)

  // 위치 확정 시에만 빵집별 거리를 계산 (대전 밖이면 역 기준으로 자동 대체됨)
  const bakeriesWithDist = useMemo(
    () =>
      bakeries.map((b) => ({
        ...b,
        distInfo: getBakeryDistanceInfo(b, { coords, bbox: region.bbox }),
      })),
    [bakeries, coords, region],
  )
  const selected =
    bakeriesWithDist.find((b) => b.id === selectedBakeryId) || bakeriesWithDist[0]

  return (
    <div className="result">
      <header className="result-header">
        <button className="ghost-btn" onClick={onRetake}>
          ← 취향 다시 설정
        </button>
        <h2>
          대전 {district ? `${district} ` : ''}빵집 추천 ({bakeries.length}곳)
        </h2>
        {source === 'sample' && (
          <span className="badge warn">샘플 데이터 (API 키 미설정)</span>
        )}
        {locStatus === 'ready' && (
          <span className="badge location">
            📍 현재 위치: {locLabel || `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`}
            {!inRegion && ' · 대전 밖 → 역 기준 거리 표시'}
          </span>
        )}
        {locStatus === 'denied' && (
          <span className="badge warn">위치 접근 거부됨 · 역 기준 거리로 표시</span>
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
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {/* 팀 내부용 기획안 바로가기 (지도 화면 우하단) */}
      <a className="plan-link" href="/계획.html" target="_blank" rel="noreferrer">📋 기획안</a>
    </div>
  )
}
