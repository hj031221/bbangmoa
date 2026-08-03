// 범용 태그-가중치 빵집 정렬기 (데모용 단순 가중합).
//   설문 응답 → 취향 태그별 점수 → 각 빵집의 태그와 매칭해 점수화 → 내림차순 정렬
//
// "빵집 찾기" 설문(surveyConfig.js)이 Branch 기반 fitness 스코어링(src/lib/breadRecommend.js)으로
// 교체되면서 이 파일의 태그-가중치 매칭은 더 이상 그 설문에서 쓰이지 않는다. 다만 "빵 지도"/
// "관광모아 근처 빵집"처럼 answers 없이(={}) 부르는 다른 화면들이 여전히 이 정렬기를 쓰고 있어
// 파일 자체는 유지한다. survey 기본값을 빈 배열로 둬 자연스럽게 no-op(점수 0) 이 되게 한다.
//
// 입력:
//   bakeries: 정규화된 Bakery[]  (각자 tags[] 보유)
//   answers:  { [questionId]: optionId }
//   survey:   옵션별 tags 가중치를 가진 설문 config (기본값 없음 — 태그 기반 설문이 있을 때만 전달)

// 설문 응답 → { tagKey: 가중치합 }
export function answersToWeights(answers, survey = []) {
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

// 빵집 1곳의 점수 = (보유 태그들의 가중치 합). 화면에 노출되는 "추천점수"는 이 값 그대로.
function scoreBakery(bakery, weights) {
  return (bakery.tags || []).reduce((sum, tag) => sum + (weights[tag] || 0), 0)
}

// 빵집 배열에 score 를 붙여 반환. 응답/survey 가 없으면 원본 순서 유지(score 0).
export function recommend(bakeries, answers, survey = []) {
  const weights = answersToWeights(answers, survey)
  return bakeries.map((b) => ({ ...b, score: scoreBakery(b, weights) }))
}
