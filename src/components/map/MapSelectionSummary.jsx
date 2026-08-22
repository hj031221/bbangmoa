import { formatDistance } from '../../lib/distance'

export default function MapSelectionSummary({ bakery }) {
  if (!bakery) {
    return (
      <div className="mobile-map-summary empty" aria-live="polite">
        마커 또는 목록에서 빵집을 선택하세요.
      </div>
    )
  }

  const distance = bakery.distInfo
    ? `${bakery.distInfo.from}에서 ${formatDistance(bakery.distInfo.km)}`
    : Number.isFinite(bakery.distKm)
      ? formatDistance(bakery.distKm)
      : null

  return (
    <div className="mobile-map-summary" aria-live="polite">
      <strong>{bakery.name}</strong>
      <span>{bakery.address || distance || '선택한 빵집의 위치를 지도에서 확인하세요.'}</span>
      {bakery.address && distance && <small>{distance}</small>}
    </div>
  )
}
