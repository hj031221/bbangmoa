const FEATURES = [
  {
    icon: '🔍',
    title: '취향 맞춤 추천',
    desc: '달콤함, 식감 같은 간단한 질문에 답하면, 취향에 맞는 빵과 그 빵으로 유명한 빵집을 골라드려요',
  },
  {
    icon: '❤️',
    title: '나만의 리스트',
    desc: '마음에 든 빵집을 찜해서, 나만의 빵지순례 리스트로 저장하고 관리해요',
  },
]

// 3) 빵모아가 하는 일 — 서비스 전체를 조망하는 섹션. 카드 2개를 대등하게 배치한다.
export default function FeaturesSection() {
  return (
    <section className="bm-features" id="bm-features">
      <div className="bm-section-head">
        <div className="bm-eyebrow">WHAT WE DO</div>
        <h2>빵모아가 하는 일</h2>
      </div>

      <div className="bm-features-grid">
        {FEATURES.map((f) => (
          <div className="bm-feature-card2" key={f.title}>
            <div className="bm-feature-card2-icon">{f.icon}</div>
            <div className="bm-feature-card2-title">{f.title}</div>
            <p className="bm-feature-card2-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
