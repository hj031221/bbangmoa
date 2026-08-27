const PERSONAS = [
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <g transform="rotate(-35 24 24)">
          <path d="M2,24.5 C2.3,20.8 5.6,17.7 10.5,16 C18.1,13.4 31.2,13.2 39.5,15.5 C44,16.7 46.4,19.1 46,22.2 C45.6,25.5 41.7,28.3 36.3,29.8 C28.5,32 16,32.6 8.6,30.5 C4.3,29.3 1.8,27.2 2,24.5 Z" fill="#FFB94A" />
          <path d="M12.3,19.3 C14.2,21.3 14.5,23.7 13.3,26.1 M20.8,18.6 C22.7,20.6 23,23 21.8,25.4 M29.3,18.6 C31.2,20.6 31.5,23 30.3,25.4 M37.8,19.3 C39.7,21.3 40,23.7 38.8,26.1" fill="none" stroke="#B96920" strokeWidth="3" strokeLinecap="round" transform="rotate(-3 25.5 22.4)" />
        </g>
      </svg>
    ),
    title: '빵집 투어만 하고 싶다면',
    desc: '취향 설문으로 3~5곳을 추천받고, 빵 지도에서 구별로 훑어보며 바로 찾아가요.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <ellipse cx="24" cy="40" rx="8.5" ry="2.6" fill="#E2C1A3" />
        <path d="M24,7 C17.9,7 13,11.9 13,18 C13,25.7 22,34.4 23.1,35.4 C23.6,35.85 24.4,35.85 24.9,35.4 C26,34.4 35,25.7 35,18 C35,11.9 30.1,7 24,7 Z" fill="#F97658" />
        <circle cx="24" cy="18" r="4.6" fill="#FFF4C5" />
        <path d="M9.5,6.5 L10.8,9.9 L14.2,11.2 L10.8,12.5 L9.5,15.9 L8.2,12.5 L4.8,11.2 L8.2,9.9 Z M39.5,22 L40.5,24.6 L43.1,25.6 L40.5,26.6 L39.5,29.2 L38.5,26.6 L35.9,25.6 L38.5,24.6 Z" fill="#FFB94A" />
      </svg>
    ),
    title: '대전 여행이 처음이라면',
    desc: '관광모아로 명소부터 둘러보고, 상세 화면에서 바로 "근처 빵집 보기"로 이어가요.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="4.5" y="7" width="38" height="34" rx="7" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="2.4" />
        <path d="M4.5,22 H42.5 M17,7 V41" stroke="#FFB94A" strokeWidth="2" strokeOpacity=".45" strokeLinecap="round" />
        <path d="M12,33.5 C12,26.5 22,28 24,21 C26,15 30.5,15.5 34.5,13" fill="none" stroke="#F97658" strokeWidth="3" strokeLinecap="round" />
        <circle cx="12" cy="34.5" r="3.2" fill="#705945" />
        <path d="M35,6 C32,6 29.6,8.4 29.6,11.4 C29.6,15.2 34,18.9 34.6,19.4 C34.85,19.6 35.15,19.6 35.4,19.4 C36,18.9 40.4,15.2 40.4,11.4 C40.4,8.4 38,6 35,6 Z" fill="#F97658" />
        <circle cx="35" cy="11.4" r="2.1" fill="#FFF4C5" />
        <circle cx="38" cy="37" r="7.2" fill="#F97658" stroke="#FFF4C5" strokeWidth="2.2" />
        <path d="M38,33.2 V37.2 L40.6,38.8" fill="none" stroke="#FFF4C5" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    title: '하루 코스를 통째로 짜고 싶다면',
    desc: '대전한바퀴가 빵과 관광 추천을 합쳐, 이동수단별 하루 코스를 자동으로 완성해줘요.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="13.5" r="5.5" fill="#E2C1A3" />
        <path d="M15,32 A9,9 0 0 1 33,32 Z" fill="#E2C1A3" />
        <circle cx="13" cy="21" r="6" fill="#FFB94A" />
        <path d="M4,40 A9,9 0 0 1 22,40 Z" fill="#FFB94A" />
        <circle cx="35" cy="21" r="6" fill="#F97658" />
        <path d="M26,40 A9,9 0 0 1 44,40 Z" fill="#F97658" />
      </svg>
    ),
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
