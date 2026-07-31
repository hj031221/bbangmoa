import { useEffect, useState } from 'react'
import daejeonTour from '../../data/daejeonTour.json'
import { getDetail, tourEnabled } from '../../api'
import { hoursBadgeText } from '../../lib/hours'

const ATTRACTIONS = daejeonTour.filter((t) => t.image)
const DESC_MAX = 160

// 관광공사 개요 텍스트 끝에 흔히 붙는 "(출처 : OO)" 를 본문과 분리해 별도 표기한다.
function splitOverview(raw) {
  const text = raw?.replace(/<[^>]+>/g, '').trim() || ''
  const match = text.match(/\(출처\s*[:：]\s*([^)]+)\)\s*$/)
  if (!match) return { text, source: '' }
  return { text: text.slice(0, match.index).trim(), source: match[1].trim() }
}

// "관광모아" 메뉴 전용 화면. 명소를 원형 사진 그리드로 둘러보다가(허브),
// 하나를 고르면 같은 화면 안에서 상세 뷰로 전환된다(빵 지도의 selectedId 패턴과 동일).
export default function TourPage({ onShowBakeryMap }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = ATTRACTIONS.find((a) => a.id === selectedId) || null

  if (selected) {
    return (
      <AttractionDetail
        attraction={selected}
        onBack={() => setSelectedId(null)}
        onShowBakeryMap={onShowBakeryMap}
      />
    )
  }

  return (
    <div className="tour-hub">
      <header className="tour-hub-header">
        <h2>관광명소도 모아모아</h2>
        <p>대전의 다양한 관광명소와 그 근처 빵집도 둘러보세요!</p>
      </header>
      <div className="tour-grid">
        {ATTRACTIONS.map((a) => (
          <button type="button" key={a.id} className="tour-tile" onClick={() => setSelectedId(a.id)}>
            <img src={a.image} alt={a.name} loading="lazy" />
            <span className="tour-tile-name">{a.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// 관광지 상세 뷰. contentId(=attraction.id)가 있으면 detailCommon2 로 설명(overview)·전화(tel)를 보강한다.
function AttractionDetail({ attraction, onBack, onShowBakeryMap }) {
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const { id, name, image, addr, hours, rest } = attraction

  useEffect(() => {
    setDetail(null)
    if (!id || !tourEnabled()) return
    let alive = true
    setDetailLoading(true)
    getDetail(id)
      .then((d) => alive && setDetail(d))
      .catch(() => {})
      .finally(() => alive && setDetailLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  const badge = hoursBadgeText(hours)
  const { text: overviewText, source: overviewSource } = splitOverview(detail?.overview)
  const overview =
    overviewText.length > DESC_MAX ? `${overviewText.slice(0, DESC_MAX)}…` : overviewText

  return (
    <div className="tour-detail">
      <button type="button" className="tour-back" onClick={onBack} aria-label="돌아가기">
        ‹
      </button>
      <div className="tour-detail-body">
        {image && <img className="tour-detail-img" src={image} alt={name} />}
        <div className="tour-detail-info">
          <div className="tour-detail-name-row">
            <h2>{name}</h2>
            {badge && (
              <span className={'badge' + (badge.startsWith('영업 중') ? ' open' : ' closed')}>
                {badge}
              </span>
            )}
          </div>
          {addr && <p className="tour-detail-addr">📍 {addr}</p>}
          {hours?.open && hours?.close && (
            <p className="tour-detail-hours">🕒 {hours.open} ~ {hours.close}</p>
          )}
          {detail?.tel && <p className="tour-detail-tel">📞 {detail.tel}</p>}
          {rest && <p className="tour-detail-rest">휴무: {rest}</p>}
          {overview ? (
            <>
              <p className="tour-detail-desc">{overview}</p>
              {overviewSource && <p className="tour-detail-source">출처: {overviewSource}</p>}
            </>
          ) : (
            detailLoading && <p className="tour-detail-desc tour-detail-desc-loading">설명을 불러오는 중…</p>
          )}
          <button type="button" className="primary-btn tour-nearby-btn" onClick={onShowBakeryMap}>
            근처 빵집 보기 →
          </button>
        </div>
      </div>
    </div>
  )
}
