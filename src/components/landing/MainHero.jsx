// 메인 화면 히어로 — 팀 시안(1p) 구성: 중앙 정렬 핀 아이콘 + 헤드라인 + CTA 2개.
export default function MainHero({ onStart }) {
  return (
    <section className="bm-mhero" id="bm-hero">
      <div className="bm-mhero-pin" aria-hidden="true">
        📍
      </div>
      <h1>대전의 맛있는 빵을 한 곳에 모았어요!</h1>
      <p>간단한 설문으로 나에게 맞는 대전의 빵집을 찾아보세요</p>
      <div className="bm-mhero-actions">
        <button className="bm-btn-primary" onClick={onStart}>
          내 취향 빵 찾기
        </button>
        <button className="bm-btn-ghost" onClick={onStart}>
          빵 지도 보기
        </button>
      </div>
    </section>
  )
}
