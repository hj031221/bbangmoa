// 추천 로직 (데모용 단순 가중합).
//   설문 응답 → 취향 태그별 점수 → 각 빵집의 태그와 매칭해 점수화 → 내림차순 정렬
//   + "오늘의 빵"(BreadReveal) 에서 뽑힌 타입을 대표메뉴로 다루는 곳은 최상단으로 끌어올려
//     리빌 화면에서 본 빵집이 지도 1순위와 어긋나지 않게 한다.
//
// 입력:
//   bakeries: 정규화된 Bakery[]  (각자 tags[] 보유)
//   answers:  { [questionId]: optionId }
//   survey:   설문 config (옵션별 tags 가중치 보유)
import { SURVEY } from '../data/surveyConfig'
import { BREAD_TYPES } from '../data/breadTypes'

// 설문 응답 → { tagKey: 가중치합 }
export function answersToWeights(answers, survey = SURVEY) {
  const weights = {}
  for (const q of survey) {
    const chosenId = answers?.[q.id]
    if (!chosenId) continue
    const opt = q.options.find((o) => o.id === chosenId)
    if (!opt) continue
    for (const [tag, w] of Object.entries(opt.tags || {})) {
      weights[tag] = (weights[tag] || 0) + w
    }
  }
  return weights
}

// 응답 가중치 → 가장 잘 맞는 빵 타입. BreadReveal 과 지도 랭킹이 같은 기준을 쓰도록 공용으로 둔다.
export function pickTypeForWeights(weights) {
  let best = BREAD_TYPES[0]
  let bestScore = -1
  for (const type of BREAD_TYPES) {
    const score = type.matchTags.reduce((sum, tag) => sum + (weights[tag] || 0), 0)
    if (score > bestScore) {
      best = type
      bestScore = score
    }
  }
  return best
}

function bakeryMatchesType(bakery, type) {
  const hay = `${bakery.name || ''} ${bakery.category || ''}`
  return type.keywords.some((kw) => hay.includes(kw))
}

// 빵집 1곳의 점수 = (보유 태그들의 가중치 합). 화면에 노출되는 "추천점수"는 이 값 그대로.
function scoreBakery(bakery, weights) {
  return (bakery.tags || []).reduce((sum, tag) => sum + (weights[tag] || 0), 0)
}

// 빵집 배열에 score 를 붙이고 정렬해서 반환.
// 설문 응답이 없으면 원본 순서 유지(score 0).
// 응답이 있으면: 오늘의 빵 타입을 대표메뉴로 다루는 곳들을 먼저, 그 안에서는 태그 점수순.
export function recommend(bakeries, answers, survey = SURVEY) {
  const weights = answersToWeights(answers, survey)
  const hasAnswers = Object.keys(weights).length > 0
  const scored = bakeries.map((b) => ({ ...b, score: scoreBakery(b, weights) }))
  if (!hasAnswers) return scored

  const type = pickTypeForWeights(weights)
  return scored.sort((a, b) => {
    const aMatch = bakeryMatchesType(a, type) ? 1 : 0
    const bMatch = bakeryMatchesType(b, type) ? 1 : 0
    if (aMatch !== bMatch) return bMatch - aMatch
    return b.score - a.score
  })
}
