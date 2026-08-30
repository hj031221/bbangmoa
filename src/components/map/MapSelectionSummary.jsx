import { formatDistance } from '../../lib/distance'

// 이슈 #60 — RecommendCard(상세 패널)도 같은 "선택하세요" 안내문을 띄운다. 데스크톱은 이
// 오버레이 자체가 CSS로 숨겨지는 구조라 상세 패널 문구만 남기면 중복이 없다 — bakery가 없으면
// 아예 아무것도 그리지 않는다(모바일에서 빈 오버레이가 자리만 차지하던 것도 같이 없어짐).
export default function MapSelectionSummary({ bakery }) {
  if (!bakery) return null

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
