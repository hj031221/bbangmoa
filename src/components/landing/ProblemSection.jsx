// 2) 문제 제기 — "나도 그거 불편했지" 공감 포인트 + 근거 숫자.
export default function ProblemSection() {
  return (
    <section className="bm-problem" id="bm-problem">
      <h2>그 많은 빵집, 다 어떻게 고르죠?</h2>

      <div className="bm-problem-stats">
        <div className="bm-stat-block">
          <div className="bm-stat-block-num">5.9개</div>
          <div className="bm-stat-block-label">인구 1만 명당 빵집 수, 전국 3위</div>
        </div>
        <div className="bm-stat-block">
          <div className="bm-stat-block-num">849개</div>
          <div className="bm-stat-block-label">대전 전체 빵집 수</div>
        </div>
      </div>

      <p className="bm-problem-body">
        대전세종연구원 조사 기준(2023.12), 대전은 인구 1만 명당 빵집 5.9개로 서울·대구에 이어
        전국 3위인 '빵지순례 성지'예요.
        <br />
        빵집만 849개, 그중 이름난 몇 곳을 빼면 나머지는 지도 위 점 하나일 뿐이라 여행객 입장에선
        고르기가 쉽지 않아요.
        <br />
        블로그 후기를 뒤지고, 목록과 별점을 한참 훑다가 정작 발걸음은 아는 곳으로만 향하게 되는
        '선택 피로' — 빵모아는 이 지점에서 출발했어요.
      </p>
    </section>
  )
}
