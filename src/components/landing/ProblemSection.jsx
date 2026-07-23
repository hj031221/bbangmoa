// 2) 문제 제기 — "나도 그거 불편했지" 공감 포인트 + 근거 숫자.
export default function ProblemSection() {
  return (
    <section className="bm-problem" id="bm-problem">
      <h2>그 많은 빵집, 다 어떻게 고르죠?</h2>

      <div className="bm-problem-stats">
        <div className="bm-stat-block">
          <div className="bm-stat-block-num">5.6개</div>
          <div className="bm-stat-block-label">인구 1만 명당 빵집 수</div>
        </div>
        <div className="bm-stat-block">
          <div className="bm-stat-block-num">849개</div>
          <div className="bm-stat-block-label">대전 전체 빵집 수</div>
        </div>
      </div>

      <p className="bm-problem-body">
        대전은 인구 1만 명당 빵집 5.6개, 전국 최고 수준의 '빵지순례 성지'예요. 하지만 849개의
        선택지 앞에서 관광객은 오히려 결정을 미루게 되죠. 목록과 별점만 훑다 지치는 '선택 피로'가
        시작됩니다.
      </p>
    </section>
  )
}
