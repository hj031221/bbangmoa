// 1) Hero — 3초 안에 "취향으로 대전 빵집을 골라주는 서비스"임을 각인시키는 첫 화면.
export default function Hero({ onStart }) {
  return (
    <section className="bm-hero" id="bm-hero">
      <div className="bm-hero-grid">
        <div className="bm-hero-copy">
          <div className="bm-badge">대전 빵지순례, 이제 취향대로</div>
          <h1>
            대전 849개 빵집,
            <br />
            고민은 그만
          </h1>
          <p>질문 몇 개에 답하면, 내 취향에 맞는 빵집을 골라드려요</p>
          <div className="bm-hero-actions">
            <button className="bm-btn-primary" onClick={onStart}>
              내 취향 빵집 찾기
            </button>
          </div>
        </div>

        <div className="bm-hero-visual">
          <div className="bm-hero-halo" />
          <div className="bm-hero-card">
            <div className="bm-hero-card-q">Q. 어떤 빵을 더 좋아하세요?</div>
            <div className="bm-hero-card-opts">
              <div className="bm-hero-card-opt active">
                <span className="bm-swatch" /> 달달한 빵
              </div>
              <div className="bm-hero-card-opt">
                <span className="bm-swatch gold" /> 고소한 빵
              </div>
            </div>
            <div className="bm-hero-card-dots">
              <span className="on" />
              <span />
              <span />
            </div>
          </div>
          <div className="bm-float bm-float-1" />
          <div className="bm-float bm-float-2" />
        </div>
      </div>
    </section>
  )
}
