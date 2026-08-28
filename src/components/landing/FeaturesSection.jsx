const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="21" cy="21" r="13.5" fill="#FFF4C5" />
        <path d="M42.76,0 C39.07,0 35.88,2.24 34.39,5.46 C32.91,2.24 29.73,0 26.04,0 C22.32,0 19.11,2.27 17.64,5.54 C16.18,2.27 12.97,0 9.25,0 C4.15,0 0,4.27 0,9.55 V26.17 C0,29.39 2.53,32 5.65,32 H46.35 C49.47,32 52,29.39 52,26.17 V9.55 C52,4.27 47.86,0 42.76,0 Z" fill="#FFB94A" transform="translate(12 15.4) scale(.35)" />
        <circle cx="21" cy="21" r="13.5" fill="none" stroke="#F97658" strokeWidth="3.2" />
        <path d="M30.8,30.8 L39.5,39.5" stroke="#F97658" strokeWidth="5" strokeLinecap="round" />
      </svg>
    ),
    title: '취향 맞춤 추천',
    desc: '달콤함, 식감, 선호하는 빵 종류 같은 몇 가지 질문에 답하면 취향 점수를 계산해, 지금 있는 지역에서 그 취향에 가장 잘 맞는 빵과 빵집을 3~5곳으로 추려드려요.\n운영시간·위치·주차 정보까지 함께 보여줘서 바로 찾아갈 수 있어요.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M6,13.5 L17.5,9.5 L30.5,13.5 L42,9.5 V34 L30.5,38 L17.5,34 L6,38 Z" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M17.5,9.5 V34 M30.5,13.5 V38" stroke="#FFB94A" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M24,10 C20,10 16.8,13.2 16.8,17.2 C16.8,22.2 22.7,27 23.4,27.6 C23.75,27.9 24.25,27.9 24.6,27.6 C25.3,27 31.2,22.2 31.2,17.2 C31.2,13.2 28,10 24,10 Z" fill="#F97658" />
        <circle cx="24" cy="17.2" r="2.8" fill="#FFF4C5" />
      </svg>
    ),
    title: '빵 지도로 한눈에 보기',
    desc: '대전 5개 구(동구·중구·서구·유성구·대덕구)의 빵집을 지도 위에서 구별로 색칠·필터링해 둘러볼 수 있어요.\n관광지 상세 화면에서는 "근처 빵집 보기"로 지금 있는 위치 기준 가까운 순 추천도 받아볼 수 있어요.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24,4.5 V10" stroke="#705945" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="20.8" y="9.5" width="6.4" height="6.5" rx="1.6" fill="#FFB94A" />
        <path d="M19.5,38.5 L21.4,16 H26.6 L28.5,38.5 Z" fill="#E2C1A3" />
        <path d="M13.5,19.5 H34.5 L31.3,25 H16.7 Z" fill="#F97658" />
        <rect x="11" y="38" width="26" height="4.2" rx="2.1" fill="#705945" />
        <path d="M8.5,10 L9.6,12.9 L12.5,14 L9.6,15.1 L8.5,18 L7.4,15.1 L4.5,14 L7.4,12.9 Z M39.5,25 L40.4,27.4 L42.8,28.3 L40.4,29.2 L39.5,31.6 L38.6,29.2 L36.2,28.3 L38.6,27.4 Z" fill="#FFB94A" />
      </svg>
    ),
    title: '관광모아',
    desc: '대전 관광지를 사진으로 둘러보고 구별로 필터링해 탐색해요. 관광지 상세 화면에서 "근처 빵집 보기"를 누르면 그 위치 기준으로 가까운 빵집을 바로 이어서 찾아볼 수 있어요.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M13,13 V36" stroke="#E2C1A3" strokeWidth="2.6" strokeLinecap="round" strokeDasharray=".1 6" />
        <circle cx="13" cy="10.5" r="4.6" fill="#F97658" /><circle cx="13" cy="10.5" r="1.8" fill="#FFF4C5" />
        <circle cx="13" cy="24" r="4.6" fill="#FFB94A" /><circle cx="13" cy="24" r="1.8" fill="#FFF4C5" />
        <circle cx="13" cy="37.5" r="4.6" fill="#705945" /><circle cx="13" cy="37.5" r="1.8" fill="#FFF4C5" />
        <rect x="21" y="7.5" width="19" height="6" rx="3" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="1.8" />
        <rect x="21" y="21" width="19" height="6" rx="3" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="1.8" />
        <rect x="21" y="34.5" width="10" height="6" rx="3" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="1.8" />
        <circle cx="38.5" cy="37.5" r="6.5" fill="#F97658" />
        <path d="M38.5,34 V41 M35,37.5 H42" stroke="#FFF4C5" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    title: '대전한바퀴',
    desc: '빵 취향 추천과 관광지 추천 결과를 합쳐 하루 코스를 자동으로 짜드려요. 자동차·대중교통·도보 중 이동수단을 고르면 예상 소요시간까지 계산해서, 마음에 안 드는 곳은 빼고 다른 곳을 더하며 내 코스로 완성할 수 있어요.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="9.5" y="6.5" width="28" height="34" rx="6" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="2.6" />
        <path d="M16.5,16.5 H30.5 M16.5,23.5 H30.5 M16.5,30.5 H25" stroke="#FFB94A" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M33,41.2 C27.5,36.8 24.4,34.2 24.4,31 C24.4,28.4 26.5,26.4 29,26.4 C30.6,26.4 32.1,27.2 33,28.5 C33.9,27.2 35.4,26.4 37,26.4 C39.5,26.4 41.6,28.4 41.6,31 C41.6,34.2 38.5,36.8 33,41.2 Z" fill="#F97658" />
      </svg>
    ),
    title: '나만의 리스트',
    desc: '마음에 든 빵집을 찜해서 나만의 빵지순례 리스트로 저장하고 관리해요. 다음 방문 때 다시 취향 설문을 반복하지 않아도, 저장해둔 목록만 열어보면 바로 계획을 세울 수 있어요.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="31" cy="17" r="6" fill="#FFB94A" />
        <path d="M20,38 A11,11 0 0 1 42,38 Z" fill="#FFB94A" />
        <circle cx="18" cy="20" r="7" fill="#F97658" />
        <path d="M5,41 A13,13 0 0 1 31,41 Z" fill="#F97658" />
      </svg>
    ),
    title: '친구와 함께',
    desc: '친구코드나 초대 링크로 친구를 추가하면, 친구가 찜한 빵·코스와 기록장을 구경할 수 있어요. 서로의 빵지순례를 참고하며 다음 코스를 계획해보세요.',
  },
]

// 3) 빵모아가 하는 일 — 서비스 전체를 조망하는 섹션. 카드 3개를 대등하게 배치한다.
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
