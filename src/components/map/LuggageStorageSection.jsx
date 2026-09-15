import { useMemo } from 'react'
import { nearestLockers } from '../../lib/luggageStorage'
import { formatDistance } from '../../lib/distance'
import { hoursBadgeText } from '../../lib/hours'

const TYPE_LABEL = { subway: '지하철', station: '기차역', tourist: '관광안내' }

// 기준점(refPoint: {lat,lng,label}) 근처 짐 보관함 최대 3곳. 관광객이 빵집으로 출발하기 전
// 캐리어를 맡길 곳을 찾는 용도 — 지도 아래 독립 섹션(MapResult). 반경 밖이면 아무것도 안 그린다.
export default function LuggageStorageSection({ refPoint }) {
  const lockers = useMemo(
    () => (refPoint ? nearestLockers(refPoint, { limit: 3 }) : []),
    [refPoint],
  )
  if (lockers.length === 0) return null

  return (
    <section className="luggage-section" aria-labelledby="luggage-heading">
      <h3 id="luggage-heading" className="luggage-title">
        가까운 짐 보관소
        {refPoint.label && <span className="luggage-ref"> · {refPoint.label} 기준</span>}
      </h3>
      <ul className="luggage-list">
        {lockers.map((l) => {
          const badge = hoursBadgeText(l.hours)
          return (
            <li key={l.id} className="luggage-item">
              <div className="luggage-item-head">
                <span className="luggage-name">{l.name}</span>
                <span className="luggage-dist">직선 {formatDistance(l.km)}</span>
              </div>
              <div className="luggage-meta">
                <span className="luggage-type">{TYPE_LABEL[l.type] || l.type}</span>
                {l.detail && <span>{l.detail}</span>}
                {l.coordAccuracy === 'approx' && <span className="luggage-approx">대략 위치</span>}
                {badge && <span className="luggage-hours">{badge}</span>}
              </div>
              <div className="luggage-fee">{l.fee}</div>
              {l.note && <div className="luggage-note">{l.note}</div>}
            </li>
          )
        })}
      </ul>
      <p className="luggage-src">반경 5km 내 최대 3곳 · 등록된 요금과 운영 정보는 현장에서 확인해 주세요.<br />출처: 공공데이터포털(대전교통공사) · 대전관광공사</p>
    </section>
  )
}
