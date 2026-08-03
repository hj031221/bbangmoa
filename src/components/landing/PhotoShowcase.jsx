import daejeonTour from '../../data/daejeonTour.json'
import CultureCarousel from './CultureCarousel'

const CULTURE = daejeonTour.filter((t) => t.type === '문화시설' && t.image).slice(0, 20)
const ATTRACTIONS = daejeonTour.filter((t) => t.type === '관광지' && t.image).slice(0, 20)

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
        <h3 className="bm-photorow-title">대전 문화시설 둘러보기</h3>
        <CultureCarousel items={CULTURE} />
      </div>

      <div className="bm-photorow">
        <h3 className="bm-photorow-title">대전 관광지 둘러보기</h3>
        <CultureCarousel items={ATTRACTIONS} />
      </div>
    </section>
  )
}
