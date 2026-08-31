import { useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useBakeries } from '../../hooks/useBakeries'
import { pickBreadResult, buildReason, matchBakeries } from '../../lib/breadRecommend'
import { pickBreadStory } from '../../data/breadCandidates'
import { getBakeryDistanceInfo } from '../../lib/bakeryDistance'
import { formatDistance } from '../../lib/distance'
import { hoursBadgeText } from '../../lib/hours'

// 설문 완료 직후 리빌 화면: 오늘의 빵 + 취향 적합도 + 추천 이유 + 취향 키워드 + 대표 빵집 최대 5곳.
// "지도에서 보기" 를 누르면 같은 지역/응답으로 지도(MapResult) 로 넘어간다.
export default function BreadReveal({ onRetake, onShowMap, tourDone, onGoToTour, onGoToPilgrimage }) {
  const regionId = useAppStore((s) => s.regionId)
  const origin = useAppStore((s) => s.origin)
  const answers = useAppStore((s) => s.answers)
  const selectBakery = useAppStore((s) => s.selectBakery)
  // answers 는 일부러 넘기지 않는다 — 이 화면의 빵집 목록은 아래 matchBakeries(빵 keywords 기반)로만
  // 정하고, 옛 태그-가중치 정렬(recommend.js)은 관여하지 않는다(빵 취향 점수와 빵집 정보 분리 원칙).
  // limit: Infinity — useBakeries 의 기본 limit(10)은 "출발지 근처 10곳"까지만 남기고 잘라버려서,
  // 대전 전역에 흩어진 빵집 중 이 빵을 파는 곳을 못 찾는 경우가 많았다. 매칭은 전체 풀에서 하고
  // matchBakeries 가 그중 상위 5곳만 추리게 한다(그마저도 origin 기준 가까운 순으로 이미 정렬돼 있다).
  const { bakeries, loading } = useBakeries({ regionId, answers: {}, origin, limit: Infinity })
  // "💡 빵 이야기"로 보여줄 후보(빵당 3개) 중 하나를 이 화면이 살아있는 동안 하나로 고정한다 —
  // 리렌더마다 문구가 바뀌지 않게. 홈으로 나갔다 새 결과를 받으면 다시 마운트되며 새로 뽑힌다.
  const storySeed = useRef(Math.random()).current

  // 빵집 목록이 로딩 중일 땐 아직 안 고른다 — 로딩 전에 픽하면(빵집 0곳인 상태로 필터링) 나중에
  // 데이터가 도착했을 때 "오늘의 빵"이 바뀌어버리는 깜빡임이 생긴다(피드백3 대응, §CP10-2).
  if (loading) {
    return (
      <div className="bread-reveal">
        <div className="banner">불러오는 중…</div>
      </div>
    )
  }

  const result = pickBreadResult(answers, bakeries)

  if (!result) {
    return (
      <div className="bread-reveal">
        <p className="bread-reveal-eyebrow">아직 답변이 부족해요</p>
        <p className="bread-reveal-desc">설문에 답해주시면 오늘의 빵을 추천해드릴게요.</p>
        <div className="bread-reveal-actions">
          <button className="primary-btn" onClick={onRetake}>
            설문 다시 하기
          </button>
        </div>
      </div>
    )
  }

  const { bread, branch, score } = result
  const reason = buildReason(bread.id, branch, answers)
  const spotlight = matchBakeries(bakeries, bread, 5)
  const story = pickBreadStory(bread, () => storySeed)

  return (
    <div className="bread-reveal">
      <p className="bread-reveal-eyebrow">오늘의 빵은...</p>
      <div className="bread-reveal-icon">
        <img src={bread.illustration} alt={`${bread.name} 일러스트`} />
      </div>
      <h2 className="bread-reveal-title">&lt; {bread.name} &gt;</h2>
      <p className="bread-reveal-desc">{bread.description}</p>
      <p className="bread-reveal-score">취향 적합도 {score}%</p>

      {reason && <p className="bread-reveal-reason">{reason}</p>}

      <div className="bread-reveal-tags">
        {bread.hashtags.map((tag) => (
          <span key={tag} className="bread-reveal-tag">
            #{tag}
          </span>
        ))}
      </div>

      {story && (
        <div className="bread-reveal-story">
          <span className="bread-reveal-story-label">💡 빵 이야기</span>
          <p>{story}</p>
        </div>
      )}

      <div className="bread-reveal-list">
        {spotlight.length === 0 && (
          <div className="rec-card empty">이 지역엔 아직 추천할 {bread.name} 맛집 정보가 없어요.</div>
        )}
        {spotlight.map((b) => {
          const distInfo = getBakeryDistanceInfo(b, { origin })
          const hoursText = hoursBadgeText(b.hours)
          const openOnMap = () => {
            selectBakery(b.id)
            onShowMap()
          }
          return (
            <div
              key={b.id}
              className="bakery-mini-card"
              role="button"
              tabIndex={0}
              onClick={openOnMap}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openOnMap()
                }
              }}
            >
              <div className="bakery-mini-name">{b.name}</div>
              {b.address && <div className="bakery-mini-addr">📍 {b.address}</div>}
              {distInfo && (
                <div className="bakery-mini-dist">📏 {distInfo.from}에서 {formatDistance(distInfo.km)}</div>
              )}
              {hoursText && <div className="bakery-mini-hours">🕒 {hoursText}</div>}
              {b.phone && <div className="bakery-mini-tel">📞 {b.phone}</div>}
            </div>
          )
        })}
      </div>

      <div className="bread-reveal-actions">
        <button className="ghost-btn" onClick={onRetake}>
          다시 추천받기
        </button>
        <button className="primary-btn" onClick={onShowMap}>
          지도에서 보기
        </button>
      </div>

      {tourDone && onGoToPilgrimage ? (
        <div className="reveal-crosslink">
          <button type="button" className="ghost-btn" onClick={onGoToPilgrimage}>
            대전한바퀴로 코스 보기 →
          </button>
        </div>
      ) : (
        !tourDone && onGoToTour && (
          <div className="reveal-crosslink">
            <button type="button" className="ghost-btn" onClick={onGoToTour}>
              관광모아 설문하러 가기 →
            </button>
          </div>
        )
      )}
    </div>
  )
}
