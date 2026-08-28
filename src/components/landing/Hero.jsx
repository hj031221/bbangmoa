// 시안(대전1.svg)의 코랄 장소 핑 아이콘 벡터 — 핑 몸통 + 식빵 컷아웃.
function PinIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 52.115 71.665" aria-hidden="true">
      <path
        d="M51.99,23.51c-1.41-13.22-12.61-23.51-26.22-23.51-.27,0-.53,0-.8.01-19.79.59-31.41,22.58-21.18,39.51,5.06,8.37,13.29,21.99,18.12,29.97,1.75,2.9,5.96,2.9,7.72,0,5.12-8.48,14.1-23.33,19.03-31.48,2.63-4.35,3.87-9.44,3.33-14.5Z"
        fill="#f97658"
      />
      <path
        d="M34.46,17.61c-1.85,0-3.45,1.08-4.19,2.65-.74-1.57-2.34-2.65-4.19-2.65s-3.47,1.1-4.21,2.69c-.74-1.59-2.34-2.69-4.21-2.69-2.56,0-4.64,2.07-4.64,4.63v8.05c0,1.56,1.27,2.83,2.83,2.83h20.42c1.56,0,2.83-1.27,2.83-2.83v-8.05c0-2.56-2.08-4.63-4.64-4.63Z"
        fill="#fff"
      />
    </svg>
  )
}

// 1) Hero — 3초 안에 "취향으로 대전 빵집을 골라주는 서비스"임을 각인시키는 첫 화면.
export default function Hero({ onStart }) {
  return (
    <section className="bm-hero" id="bm-hero">
      <div className="bm-hero-grid">
        <div className="bm-hero-copy">
          <div className="bm-badge">대전 빵지순례, 이제 취향대로</div>
          <h1>
            대전 빵집,
            <br />
            취향대로 골라드려요
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
          <PinIcon className="bm-float bm-float-1" />
          <PinIcon className="bm-float bm-float-2" />
        </div>
      </div>
    </section>
  )
}
