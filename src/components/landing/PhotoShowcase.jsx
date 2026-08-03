import daejeonTour from '../../data/daejeonTour.json'
import CultureCarousel from './CultureCarousel'

const ATTRACTIONS = daejeonTour.filter((t) => t.type === '관광지' && t.image).slice(0, 14)

// 메뉴바 아래 사진 브라우징 섹션 — 다른 관광 사이트처럼 대전의 사진을 둘러본다.
// 빵집은 이미 서비스 핵심 기능(취향 추천/지도)에서 다루므로, 여기서는 문화시설·관광지
// 정적 스냅샷(daejeonTour.json)으로 "대전 여행" 무드를 보여준다.
export default function PhotoShowcase() {
  return (
    <section className="bm-showcase" id="bm-showcase">
      <div className="bm-section-head">
        <div className="bm-eyebrow">TASTE &amp; PLACES</div>
        <h2>사진으로 미리 만나보는 대전</h2>
      </div>

      <div className="bm-photorow">
        <h3 className="bm-photorow-title">요즘 뜨는 문화시설</h3>
        <CultureCarousel />
      </div>

      <PhotoRow
        title="함께 즐기는 관광지"
        items={ATTRACTIONS}
        getKey={(a) => a.id}
        getImage={(a) => a.image}
        getTitle={(a) => a.name}
        getSub={(a) => a.addr}
      />
    </section>
  )
}

function PhotoRow({ title, items, loading, getKey, getImage, getTitle, getSub }) {
  return (
    <div className="bm-photorow">
      <h3 className="bm-photorow-title">{title}</h3>
      {loading ? (
        <p className="bm-photorow-empty">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="bm-photorow-empty">표시할 사진이 아직 없어요.</p>
      ) : (
        <div className="bm-photorow-track">
          {items.map((item) => (
            <div className="bm-photocard" key={getKey(item)}>
              <img src={getImage(item)} alt={getTitle(item)} loading="lazy" />
              <div className="bm-photocard-name">{getTitle(item)}</div>
              {getSub(item) && <div className="bm-photocard-sub">{getSub(item)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
