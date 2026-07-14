// 추천 로직 (데모용 단순 가중합).
//   설문 응답 → 취향 태그별 점수 → 각 빵집의 태그와 매칭해 점수화 → 내림차순 정렬
//
// 입력:
//   bakeries: 정규화된 Bakery[]  (각자 tags[] 보유)
//   answers:  { [questionId]: optionId }
//   survey:   설문 config (옵션별 tags 가중치 보유)
import { SURVEY } from '../data/surveyConfig'

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

// 빵집 1곳의 점수 = (보유 태그들의 가중치 합)
function scoreBakery(bakery, weights) {
  return (bakery.tags || []).reduce((sum, tag) => sum + (weights[tag] || 0), 0)
}

// 빵집 배열에 score 를 붙이고 정렬해서 반환.
// 설문 응답이 없으면 원본 순서 유지(score 0).
export function recommend(bakeries, answers, survey = SURVEY) {
  const weights = answersToWeights(answers, survey)
  const hasAnswers = Object.keys(weights).length > 0
  const scored = bakeries.map((b) => ({ ...b, score: scoreBakery(b, weights) }))
  if (!hasAnswers) return scored
  return scored.sort((a, b) => b.score - a.score)
}
