// 설문 응답 → "오늘의 빵" 타입 매칭.
// 타입 선택 자체는 recommend.js(pickTypeForWeights) 와 같은 로직을 공유해야
// 리빌 화면에서 뽑힌 빵집이 지도 1순위와도 일치한다.
import { answersToWeights, pickTypeForWeights } from './recommend'

// 응답 → 가장 잘 맞는 빵 타입 + 적합도(%)
export function pickBreadType(answers) {
  const weights = answersToWeights(answers)
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0)
  const type = pickTypeForWeights(weights)
  const bestScore = type.matchTags.reduce((sum, tag) => sum + (weights[tag] || 0), 0)

  const percent = totalWeight > 0 ? Math.round((bestScore / totalWeight) * 100) : 70
  return { type, percent: Math.min(97, Math.max(45, percent)) }
}

// 이 빵 타입을 대표메뉴로 다루는 것으로 보이는 빵집 상위 N곳.
// 키워드 매칭 결과가 없으면(데모 데이터 한계) 추천순 상위로 대체.
export function matchBakeries(bakeries, type, limit = 3) {
  const hay = (b) => `${b.name || ''} ${b.category || ''}`
  const matched = bakeries.filter((b) => type.keywords.some((kw) => hay(b).includes(kw)))
  return (matched.length > 0 ? matched : bakeries).slice(0, limit)
}
