const STEPS = [
  {
    icon: <svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="40" rx="8" ry="2.5" fill="#E2C1A3" /><path d="M24,6 C17.4,6 12,11.4 12,18 C12,26.4 21.6,35.4 22.9,36.6 C23.5,37.1 24.5,37.1 25.1,36.6 C26.4,35.4 36,26.4 36,18 C36,11.4 30.6,6 24,6 Z" fill="#F97658" /><circle cx="24" cy="18" r="4.8" fill="#FFF4C5" /></svg>,
    tag: 'STEP 1', title: '지역 선택', desc: '동구·중구·서구·유성구·대덕구 중 방문할 지역을 골라요',
  },
  {
    icon: <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8,13 A4,4 0 0 1 12,9 H36 A4,4 0 0 1 40,13 V27 A4,4 0 0 1 36,31 H22 L15,37 L16.3,31 H12 A4,4 0 0 1 8,27 Z" fill="#F97658" stroke="#705945" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="17" cy="20" r="2" fill="#FFF4C5" /><circle cx="24" cy="20" r="2" fill="#FFF4C5" /><circle cx="31" cy="20" r="2" fill="#FFF4C5" /></svg>,
    tag: 'STEP 2', title: '취향 질문', desc: '달콤함, 식감 등 간단한 질문에 답하며 취향을 알려줘요',
  },
  {
    icon: <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="9" width="30" height="30" rx="8" fill="#FFB94A" /><path d="M15,24 L21.5,30.5 L34,17.5" fill="none" stroke="#FFF4C5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    tag: 'STEP 3', title: '맞춤 추천', desc: '운영시간·위치·주차 정보까지, 3~5곳을 바로 추천받아요',
  },
  {
    icon: <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24,39 C13,31.8 8,27.2 8,19.7 C8,14 12.2,10 17.5,10 C20.4,10 22.8,11.4 24,13.5 C25.2,11.4 27.6,10 30.5,10 C35.8,10 40,14 40,19.7 C40,27.2 35,31.8 24,39 Z" fill="#F97658" /></svg>,
    tag: 'STEP 4', title: '찜해서 저장', desc: '마음에 들면 찜해서 나만의 리스트에 담아요',
  },
  {
    icon: <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10,35 C10,27 20,29 23,21 C25.5,14.5 31,15 37,10" fill="none" stroke="#FFB94A" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="2 5" /><circle cx="10" cy="36" r="5" fill="#705945" /><path d="M37,5 C31.9,5 28,8.9 28,14 C28,20.2 35.3,26.3 36.3,27.1 C36.7,27.5 37.3,27.5 37.7,27.1 C38.7,26.3 46,20.2 46,14 C46,8.9 42.1,5 37,5 Z" fill="#F97658" /><circle cx="37" cy="14" r="3.3" fill="#FFF4C5" /></svg>,
    tag: 'STEP 5', title: '대전한바퀴로 완성', desc: '관광지 추천과 합쳐 이동수단별 하루 코스로 이어가요',
  },
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
                <span className="bm-how-step-icon">{s.icon}</span>
                <span>{s.title}</span>
              </div>
              <p className="bm-how-step-desc">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
