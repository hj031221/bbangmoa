import { getTourRecommendation } from '../../lib/tourRecommend'
import { useAttractions } from '../../hooks/useAttractions'

const THEME_LABELS = { nature: '자연', history: '역사', culture: '문화', education: '교육', etc: '기타' }

// 관광모아 설문 완료 직후 결과 화면: 테마 + 추천 이유 + TOP3 관광지 카드.
// BreadReveal.jsx와 동일한 구성(리빌 문구 → 점수 → 카드 리스트 → 액션 버튼)을 관광지용으로 재구성.
export default function TourReveal({ answers, onRetake, onOpenHub, breadDone, onGoToBread }) {
  const { tagged, loading } = useAttractions()
  const result = answers ? getTourRecommendation(answers, tagged) : null

  // getTourRecommendation은 tagged가 아직 로딩 중(빈 배열)이어도 results:[] 인 truthy 객체를
  // 반환하므로, 아래 "결과 부족" 분기와 구분해서 먼저 걸러야 한다 — 안 그러면 설문을 제대로
  // 마쳤는데도 로딩 중 잠깐(또는 네트워크가 느리면 꽤 길게) "추천할 곳이 부족해요"가 오탐으로 뜬다.
  if (loading) {
    return (
      <div className="tour-reveal">
        <div className="banner">불러오는 중…</div>
      </div>
    )
  }

  if (!result || result.results.length === 0) {
    return (
      <div className="tour-reveal">
        <p className="tour-reveal-eyebrow">아직 추천할 곳이 부족해요</p>
        <p className="tour-reveal-desc">설문에 답해주시면 관광지를 추천해드릴게요.</p>
        <div className="tour-reveal-actions">
          <button className="primary-btn" onClick={onRetake}>
            설문 다시 하기
          </button>
        </div>
      </div>
    )
  }

  const { district, theme, themeReason, results } = result

  return (
    <div className="tour-reveal">
      <p className="tour-reveal-eyebrow">추천 테마는...</p>
      <h2 className="tour-reveal-title">
        &lt; {district} · {THEME_LABELS[theme]} &gt;
      </h2>
      {themeReason && <p className="tour-reveal-reason">{themeReason}</p>}

      <div className="tour-reveal-list">
        {results.map(({ attraction, score, reason }, idx) => (
          <button
            type="button"
            key={attraction.id}
            className="tour-reveal-card"
            onClick={() => onOpenHub(attraction.id)}
          >
            <span className="tour-reveal-rank">{idx + 1}</span>
            {attraction.image && <img src={attraction.image} alt={attraction.name} loading="lazy" />}
            <div className="tour-reveal-card-info">
              <div className="tour-reveal-card-name">{attraction.name}</div>
              <div className="tour-reveal-card-score">적합도 {score}%</div>
              {reason && <div className="tour-reveal-card-reason">{reason}</div>}
            </div>
          </button>
        ))}
      </div>

      <div className="tour-reveal-actions">
        <button className="ghost-btn" onClick={onRetake}>
          다시 추천받기
        </button>
        <button className="primary-btn" onClick={() => onOpenHub(null)}>
          관광지 더 둘러보기 →
        </button>
      </div>

      {!breadDone && onGoToBread && (
        <div className="reveal-crosslink">
          <button type="button" className="ghost-btn" onClick={onGoToBread}>
            빵집 찾기 설문하러 가기 →
          </button>
        </div>
      )}
    </div>
  )
}
