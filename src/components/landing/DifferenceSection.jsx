// 5) 무엇이 다른가 — 기존 지도 앱과의 차이를 못박고, 데이터 근거로 신뢰를 준다.
export default function DifferenceSection() {
  return (
    <section className="bm-diff" id="bm-diff">
      <div className="bm-section-head">
        <div className="bm-eyebrow">WHY DIFFERENT</div>
        <h2>무엇이 다른가</h2>
      </div>

      <div className="bm-diff-compare">
        <div className="bm-diff-col">
          <div className="bm-diff-head">기존 지도 앱</div>
          <div>· 직접 검색하고 비교</div>
          <div>· 목록 + 별점 중심</div>
          <div>· 정보 탐색의 피로감</div>
        </div>
        <div className="bm-diff-col highlight">
          <div className="bm-diff-head accent">빵모아</div>
          <div>· 질문으로 자동 추천</div>
          <div>· 취향 기반 필터링</div>
          <div>· 콘텐츠형 즐거운 경험</div>
        </div>
      </div>

      <p className="bm-diff-trust">
        빵모아는 대전 5개 구의 빵집 데이터와 한국관광공사 관광 정보(TourAPI)를 결합해 만들어졌어요
      </p>
    </section>
  )
}
