const PERSONAS = [
  {
    icon: '🥐',
    title: '빵집 투어만 하고 싶다면',
    desc: '취향 설문으로 3~5곳을 추천받고, 빵 지도에서 구별로 훑어보며 바로 찾아가요.',
  },
  {
    icon: '🏰',
    title: '대전 여행이 처음이라면',
    desc: '관광모아로 명소부터 둘러보고, 상세 화면에서 바로 "근처 빵집 보기"로 이어가요.',
  },
  {
    icon: '🚴',
    title: '하루 코스를 통째로 짜고 싶다면',
    desc: '대전한바퀴가 빵과 관광 추천을 합쳐, 이동수단별 하루 코스를 자동으로 완성해줘요.',
  },
  {
    icon: '👥',
    title: '여럿이 함께 다닌다면',
    desc: '친구코드로 초대하고, 서로 찜한 빵·코스·기록장을 구경하며 일정을 같이 짜요.',
  },
]

// 5) 이런 분께 추천해요 — "무엇이 다른가"(기존 지도 앱 비교) 대신,
// 사용 시나리오별로 어떤 기능부터 써보면 좋은지 보여주는 페르소나 섹션.
export default function PersonaSection() {
  return (
    <section className="bm-persona" id="bm-persona">
      <div className="bm-section-head">
        <div className="bm-eyebrow">WHO IT'S FOR</div>
        <h2>이런 분께 추천해요</h2>
      </div>

      <div className="bm-persona-grid">
        {PERSONAS.map((p) => (
          <div className="bm-persona-card" key={p.title}>
            <div className="bm-persona-card-icon">{p.icon}</div>
            <div className="bm-persona-card-title">{p.title}</div>
            <p className="bm-persona-card-desc">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
