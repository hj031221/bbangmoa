import { useAppStore } from '../../store/useAppStore'
import { useBakeries } from '../../hooks/useBakeries'
import { pickBreadType, matchBakeries } from '../../lib/breadMatch'

// 설문 완료 직후 리빌 화면: 오늘의 빵 타입 + 적합도 + 해시태그 + 대표 빵집 소개.
// "지도에서 보기" 를 누르면 같은 지역/응답으로 지도(MapResult) 로 넘어간다.
export default function BreadReveal({ onRetake, onShowMap }) {
  const regionId = useAppStore((s) => s.regionId)
  const origin = useAppStore((s) => s.origin)
  const answers = useAppStore((s) => s.answers)
  const { bakeries, loading } = useBakeries({ regionId, answers, origin })

  const { type, percent } = pickBreadType(answers)
  const spotlight = matchBakeries(bakeries, type)

  return (
    <div className="bread-reveal">
      <p className="bread-reveal-eyebrow">오늘의 빵은...</p>
      <div className="bread-reveal-icon">{type.emoji}</div>
      <h2 className="bread-reveal-title">&lt; {type.name} &gt;</h2>
      <p className="bread-reveal-desc">{type.description}</p>
      <p className="bread-reveal-score">취향 적합도 {percent}%</p>

      <div className="bread-reveal-tags">
        {type.hashtags.map((tag) => (
          <span key={tag} className="bread-reveal-tag">
            #{tag}
          </span>
        ))}
      </div>

      {loading && <div className="banner">불러오는 중…</div>}

      <div className="bread-reveal-list">
        {!loading && spotlight.length === 0 && (
          <div className="rec-card empty">이 지역엔 아직 추천할 {type.name} 맛집 정보가 없어요.</div>
        )}
        {spotlight.map((b) => (
          <div key={b.id} className="bakery-mini-card">
            <div className="bakery-mini-name">{b.name}</div>
            {b.address && <div className="bakery-mini-addr">📍 {b.address}</div>}
            {b.phone && <div className="bakery-mini-tel">📞 {b.phone}</div>}
          </div>
        ))}
      </div>

      <div className="bread-reveal-actions">
        <button className="ghost-btn" onClick={onRetake}>
          다시 하기
        </button>
        <button className="primary-btn" onClick={onShowMap}>
          지도에서 보기
        </button>
      </div>
    </div>
  )
}
