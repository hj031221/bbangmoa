const STEPS = [
  { icon: '📍', tag: 'STEP 1', title: '지역 선택', desc: '동구·중구·서구·유성구·대덕구 중 방문할 지역을 골라요' },
  { icon: '💭', tag: 'STEP 2', title: '취향 질문', desc: '달콤함, 식감 등 간단한 질문에 답하며 취향을 알려줘요' },
  { icon: '✅', tag: 'STEP 3', title: '맞춤 추천', desc: '운영시간·위치·주차 정보까지, 3~5곳을 바로 추천받아요' },
  { icon: '🤍', tag: 'STEP 4', title: '찜해서 저장', desc: '마음에 들면 찜해서 나만의 리스트에 담아요' },
  { icon: '🚴', tag: 'STEP 5', title: '대전한바퀴로 완성', desc: '관광지 추천과 합쳐 이동수단별 하루 코스로 이어가요' },
]

// 4) 취향 추천은 이렇게 — 대표 기능(취향 추천 + 찜 저장)을 처음부터 끝까지 한 여정으로 보여준다.
export default function HowItWorksSection() {
  return (
    <section className="bm-how" id="bm-how">
      <div className="bm-section-head">
        <div className="bm-eyebrow">HOW IT WORKS</div>
        <h2>취향 추천은 이렇게</h2>
      </div>

      <div className="bm-how-steps">
        {STEPS.map((s, i) => (
          <div className="bm-how-step" key={s.title}>
            <div className="bm-how-step-num">{i + 1}</div>
            <div className="bm-how-step-body">
              <div className="bm-how-step-tag">{s.tag}</div>
              <div className="bm-how-step-title">
                {s.icon} {s.title}
              </div>
              <p className="bm-how-step-desc">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
