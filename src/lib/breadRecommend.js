// Branch 기반 가중치 스코어링 엔진 (이슈 #10). src/lib/breadMatch.js 를 대체한다.
//   Q1 응답 → branch(A~E) 결정 → 해당 branch 후보 빵마다 Q2~Q5 fitness 를 가중합해 점수 산출
//   → 최고점 빵을 "오늘의 빵"으로, 매칭 키워드로 빵집 최대 N곳을 붙인다.
import { Q1_ID, Q1, BRANCHES, WEIGHTS, MAX_FITNESS } from '../data/surveyConfig'
import { getBreadById } from '../data/breadCandidates'
import { curatedBreadIdsFor } from '../data/bakeryBreadMenu'

// Q1 응답 → branch id('A'~'E') | null(미응답)
export function resolveBranch(answers) {
  const chosenId = answers?.[Q1_ID]
  const opt = Q1.options.find((o) => o.id === chosenId)
  return opt?.branch ?? null
}

// origin + Q1 + 해당 branch 의 Q2~Q5 를 모두 답했는지.
export function isSurveyComplete(answers) {
  const branchId = resolveBranch(answers)
  if (!branchId) return false
  const branch = BRANCHES[branchId]
  return branch.questions.every((q) => !!answers?.[q.id])
}

// branch 후보 빵마다 { breadId, score(0~100), raw: {q2,q3,q4,q5} } 를 계산.
export function scoreCandidates(branchId, answers) {
  const branch = BRANCHES[branchId]
  if (!branch) return []
  return branch.candidateIds.map((breadId) => {
    let score = 0
    const raw = {}
    for (const q of branch.questions) {
      const chosenId = answers?.[q.id]
      const opt = q.options.find((o) => o.id === chosenId)
      const fitness = opt?.fitness?.[breadId] ?? 0
      raw[q.weightKey] = fitness
      score += (fitness / MAX_FITNESS) * WEIGHTS[q.weightKey]
    }
    return { breadId, score, raw }
  })
}

// 완전 동점 처리 순서(PDF 7번): Q4 → Q3 → Q2 → Q5 개별 적합도 비교
// → 최고 적합도(5) 횟수 → 차상위 적합도(4 이상) 횟수 → candidateIds 선언 순서.
function breakTie(tiedCandidates, branch) {
  let tied = tiedCandidates
  for (const qKey of ['q4', 'q3', 'q2', 'q5']) {
    if (tied.length === 1) break
    const maxRaw = Math.max(...tied.map((s) => s.raw[qKey] || 0))
    tied = tied.filter((s) => (s.raw[qKey] || 0) === maxRaw)
  }
  if (tied.length > 1) {
    const fiveCount = (s) => Object.values(s.raw).filter((v) => v === 5).length
    const maxFives = Math.max(...tied.map(fiveCount))
    tied = tied.filter((s) => fiveCount(s) === maxFives)
  }
  if (tied.length > 1) {
    const highCount = (s) => Object.values(s.raw).filter((v) => v >= 4).length
    const maxHigh = Math.max(...tied.map(highCount))
    tied = tied.filter((s) => highCount(s) === maxHigh)
  }
  if (tied.length > 1) {
    tied = [...tied].sort(
      (a, b) => branch.candidateIds.indexOf(a.breadId) - branch.candidateIds.indexOf(b.breadId),
    )
  }
  return tied[0]
}

// 응답 → { branch, bread, score, raw } | null(Q1 미응답)
// 취향 적합도는 인위적 최소/최대 보정 없이 실제 점수(0~100)를 그대로 반올림해 사용한다.
//
// bakeries(선택): 주어지면(그리고 로딩이 끝나 1곳 이상 있으면) 연결된 빵집이 하나도 없는 빵은
// 후보에서 미리 제외하고 점수를 매긴다(피드백3 — "빵집 정보 없어요"가 뜨는 빵 자체를 안 고름).
// 모든 후보가 빵집이 0곳이면(그 branch 데이터 자체가 아직 빈약한 경우) 필터 없이 원래대로 고른다.
// bakeries 를 안 주거나 아직 로딩 전(빈 배열)이면 필터를 건너뛴다 — 호출부는 로딩이 끝난 뒤에
// 불러야 이 필터가 실제로 적용된다(그 전엔 빵집 데이터 자체가 없어 전부 걸러질 수 있어서).
export function pickBreadResult(answers, bakeries) {
  // 이슈 #37/CP11-9 — Q1만 답하고 Q2~Q5를 건너뛰면(미답변 문항은 fitness 0으로 계산돼) 전부
  // 0점 동점인 채로 여기까지 왔었다. getTourRecommendation()(tourRecommend.js)은 이미 이 체크를
  // 하고 있어 두 파일 로직이 어긋나 있었다 — 여기도 똑같이 완료 여부부터 확인한다. 이 결과를
  // 직접 쓰는 PilgrimagePage의 breadDone 게이트도 이걸로 함께 바로잡힌다(미완료 설문으로 코스가
  // 만들어지는 것 방지).
  if (!isSurveyComplete(answers)) return null
  const branchId = resolveBranch(answers)
  if (!branchId) return null
  const branch = BRANCHES[branchId]
  const scored = scoreCandidates(branchId, answers)

  let candidates = scored
  if (bakeries && bakeries.length > 0) {
    const withBakery = scored.filter(
      (s) => matchBakeries(bakeries, getBreadById(s.breadId), 1).length > 0,
    )
    if (withBakery.length > 0) candidates = withBakery
  }

  const maxScore = Math.max(...candidates.map((s) => s.score))
  const tied = candidates.filter((s) => s.score === maxScore)
  const winner = tied.length > 1 ? breakTie(tied, branch) : tied[0]

  return {
    branch: branchId,
    bread: getBreadById(winner.breadId),
    score: Math.round(winner.score),
    raw: winner.raw,
  }
}

// 최종 빵의 고득점 답변(최대 3개)을 문장으로 합성한 "추천 이유".
export function buildReason(breadId, branchId, answers) {
  const branch = BRANCHES[branchId]
  if (!branch) return ''

  const answered = []
  for (const q of branch.questions) {
    const chosenId = answers?.[q.id]
    const opt = q.options.find((o) => o.id === chosenId)
    if (!opt) continue
    answered.push({ label: opt.label, fitness: opt.fitness?.[breadId] ?? 0, weight: WEIGHTS[q.weightKey] })
  }
  answered.sort((a, b) => b.fitness - a.fitness || b.weight - a.weight)
  const top = answered.slice(0, 3).map((o) => o.label)
  if (top.length === 0) return ''
  return `${top.join(' · ')} — 이런 취향에 잘 맞는 빵이에요`
}

// 이 빵을 대표메뉴로 다루는 것으로 보이는 빵집 최대 limit 곳.
// PDF 8번: 실제 판매 여부를 우선하며, 5곳 미만이면 관련 없는 인기 매장으로 채우지 않는다(폴백 없음).
//
// 두 신호를 우선순위대로 합친다:
//   1) bakeryBreadMenu.js 큐레이션(실제 대표메뉴로 확인된 빵집) — 이름 매칭, 최우선
//   2) 빵 keywords 가 빵집 이름/카테고리에 그대로 들어있는지(기존 방식) — 1)에서 못 찾은 곳만 보충
// Kakao/관광공사 API 가 메뉴 정보를 안 줘서 2)만으로는 매칭이 잘 안 되는 빵이 많아 1)을 추가했다.
export function matchBakeries(bakeries, bread, limit = 5) {
  if (!bread) return []
  const hay = (b) => `${b.name || ''} ${b.category || ''}`

  const confirmed = bakeries.filter((b) => curatedBreadIdsFor(b.name)?.includes(bread.id))
  const confirmedIds = new Set(confirmed.map((b) => b.id))
  const keywordOnly = bakeries.filter(
    (b) => !confirmedIds.has(b.id) && bread.keywords.some((kw) => hay(b).includes(kw)),
  )

  return [...confirmed, ...keywordOnly].slice(0, limit)
}
