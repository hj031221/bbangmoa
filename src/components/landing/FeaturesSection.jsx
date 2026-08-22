const FEATURES = [
  {
    icon: '🔍',
    title: '취향 맞춤 추천',
    desc: '달콤함, 식감, 선호하는 빵 종류 같은 몇 가지 질문에 답하면 취향 점수를 계산해, 지금 있는 지역에서 그 취향에 가장 잘 맞는 빵과 빵집을 3~5곳으로 추려드려요.\n운영시간·위치·주차 정보까지 함께 보여줘서 바로 찾아갈 수 있어요.',
  },
  {
    icon: '🗺️',
    title: '빵 지도로 한눈에 보기',
    desc: '대전 5개 구(동구·중구·서구·유성구·대덕구)의 빵집을 지도 위에서 구별로 색칠·필터링해 둘러볼 수 있어요.\n관광지 상세 화면에서는 "근처 빵집 보기"로 지금 있는 위치 기준 가까운 순 추천도 받아볼 수 있어요.',
  },
  {
    icon: '🏯',
    title: '관광모아',
    desc: '대전 관광지를 사진으로 둘러보고 구별로 필터링해 탐색해요. 관광지 상세 화면에서 "근처 빵집 보기"를 누르면 그 위치 기준으로 가까운 빵집을 바로 이어서 찾아볼 수 있어요.',
  },
  {
    icon: '🚴',
    title: '대전한바퀴',
    desc: '빵 취향 추천과 관광지 추천 결과를 합쳐 하루 코스를 자동으로 짜드려요. 자동차·대중교통·도보 중 이동수단을 고르면 예상 소요시간까지 계산해서, 마음에 안 드는 곳은 빼고 다른 곳을 더하며 내 코스로 완성할 수 있어요.',
  },
  {
    icon: '❤️',
    title: '나만의 리스트',
    desc: '마음에 든 빵집을 찜해서 나만의 빵지순례 리스트로 저장하고 관리해요. 다음 방문 때 다시 취향 설문을 반복하지 않아도, 저장해둔 목록만 열어보면 바로 계획을 세울 수 있어요.',
  },
  {
    icon: '👥',
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
