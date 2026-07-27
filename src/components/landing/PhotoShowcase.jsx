import { useBakeries } from '../../hooks/useBakeries'
import daejeonTour from '../../data/daejeonTour.json'

const ATTRACTIONS = daejeonTour.filter((t) => t.image).slice(0, 14)

// 메뉴바 아래 사진 브라우징 섹션 — 다른 관광 사이트처럼 빵집/관광지 사진을 가로 스크롤로 둘러본다.
// 빵집 사진은 관광공사 KorService2 + 카카오로컬(useBakeries), 관광지 사진은 정적 스냅샷(daejeonTour.json)을 쓴다.
export default function PhotoShowcase() {
  const { bakeries, loading } = useBakeries({ regionId: undefined, answers: {}, origin: null })
  const bakeriesWithPhoto = bakeries.filter((b) => b.thumbnail).slice(0, 14)

  return (
    <section className="bm-showcase" id="bm-showcase">
      <div className="bm-section-head">
        <div className="bm-eyebrow">TASTE &amp; PLACES</div>
        <h2>사진으로 미리 만나보는 대전</h2>
      </div>

      <PhotoRow
        title="요즘 뜨는 빵집"
        items={bakeriesWithPhoto}
        loading={loading}
        getKey={(b) => b.id}
        getImage={(b) => b.thumbnail}
        getTitle={(b) => b.name}
        getSub={(b) => b.address}
      />

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
