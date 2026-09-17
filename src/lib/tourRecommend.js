// 관광모아 추천 엔진 — PDF(대전 관광지 추천 트리형+가중치 로직 찐최종본) 4·7·9·10·15절 구현.
//   Q0(구) + Q1(동행자→Branch) + Q2~Q5(테마 가중치+성향 태그) → 테마 결정 → 코사인 유사도
//   → 동행 적합도 → 80:20 최종 점수 → TOP3.
import { Q0, Q1, BRANCHES, THEMES, TRAIT_TAGS } from '../data/tourSurveyConfig.js'
import { josa } from './josa.js'

export const COMPANION_KEY_BY_BRANCH = {
  A: 'solo', B: 'couple', C: 'friends', D: 'childrenFamily', E: 'parentsFamily',
}

const THEME_LABELS = { nature: '자연', history: '역사', culture: '문화', education: '교육', etc: '기타' }
const TAG_LABELS = {
  walk: '산책', rest: '휴식', scenery: '경관', exploration: '탐방', immersion: '몰입',
  appreciation: '감상', sightseeing: '볼거리', experience: '체험', knowledge: '지식',
  uniqueness: '이색성', activity: '활동성',
}

export function resolveDistrict(answers) {
  const chosenId = answers?.[Q0.id]
  return Q0.options.find((o) => o.id === chosenId)?.district ?? null
}

export function resolveBranch(answers) {
  const chosenId = answers?.[Q1.id]
  return Q1.options.find((o) => o.id === chosenId)?.branch ?? null
}

// origin(위치 설문)과 별개로, 관광모아 Q0~Q5를 전부 답했는지.
// breadRecommend.js 의 isSurveyComplete() 와 대응하는 함수.
export function isTourSurveyComplete(answers) {
  const district = resolveDistrict(answers)
  const branchId = resolveBranch(answers)
  if (!district || !branchId) return false
  const branch = BRANCHES[branchId]
  return branch.questions.every((q) => !!answers?.[q.id])
}

export function computeThemeScores(branchId, answers) {
  const scores = { nature: 0, history: 0, culture: 0, education: 0, etc: 0 }
  const branch = BRANCHES[branchId]
  if (!branch) return scores
  for (const q of branch.questions) {
    const opt = q.options.find((o) => o.id === answers?.[q.id])
    if (!opt) continue
    for (const theme of THEMES) scores[theme] += opt.themeWeight[theme] ?? 0
  }
  return scores
}

// PDF 7절 동점 처리: Q5 주테마 → Q4 주테마 → Q3 주테마 → 해당 구 관광지 수가 더 많은 테마.
// branch.questions 순서는 [Q2, Q3, Q4, Q5] 이므로 뒤에서부터(인덱스 3,2,1) 확인한다.
export function pickTheme(branchId, answers, themeScores, districtCounts) {
  const maxScore = Math.max(...THEMES.map((t) => themeScores[t]))
  let tied = THEMES.filter((t) => themeScores[t] === maxScore)
  if (tied.length === 1) return tied[0]

  const branch = BRANCHES[branchId]
  for (const qIndex of [3, 2, 1]) {
    if (tied.length === 1) break
    const q = branch?.questions[qIndex]
    const opt = q?.options.find((o) => o.id === answers?.[q.id])
    if (!opt) continue
    const optMax = Math.max(...tied.map((t) => opt.themeWeight[t] ?? 0))
    const narrowed = tied.filter((t) => (opt.themeWeight[t] ?? 0) === optMax)
    if (narrowed.length > 0) tied = narrowed
  }
  if (tied.length === 1 || !districtCounts) return tied[0]

  const maxCount = Math.max(...tied.map((t) => districtCounts[t] ?? 0))
  tied = tied.filter((t) => (districtCounts[t] ?? 0) === maxCount)
  return tied[0]
}

export function buildUserTraitVector(branchId, answers) {
  const vector = Object.fromEntries(TRAIT_TAGS.map((tag) => [tag, 0]))
  const branch = BRANCHES[branchId]
  if (!branch) return vector
  for (const q of branch.questions) {
    const opt = q.options.find((o) => o.id === answers?.[q.id])
    if (!opt) continue
    for (const [tag, val] of Object.entries(opt.traits)) vector[tag] += val
  }
  return vector
}

export function cosineSimilarity(userVec, siteVec) {
  let dot = 0, uMag = 0, sMag = 0
  for (const tag of TRAIT_TAGS) {
    const u = userVec[tag] ?? 0
    const s = siteVec[tag] ?? 0
    dot += u * s
    uMag += u * u
    sMag += s * s
  }
  if (uMag === 0 || sMag === 0) return 0
  return dot / (Math.sqrt(uMag) * Math.sqrt(sMag))
}

export function topTags(vector, n) {
  return [...TRAIT_TAGS].sort((a, b) => vector[b] - vector[a]).slice(0, n)
}

export function countAttractionsByTheme(district, attractions) {
  const counts = { nature: 0, history: 0, culture: 0, education: 0, etc: 0 }
  for (const a of attractions) {
    if (a.district !== district) continue
    for (const t of a.themes) counts[t] = (counts[t] ?? 0) + 1
  }
  return counts
}

function scoreThemePool(pool, userVec, userTopTags, companionKey) {
  const scored = pool.map((attraction) => {
    const traitMatch = cosineSimilarity(userVec, attraction.traits) * 100
    const companionScore = attraction.companion[companionKey] ?? 0
    const finalScore = traitMatch * 0.8 + companionScore * 0.2
    return { attraction, traitMatch, companionScore, finalScore }
  })
  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore
    if (b.traitMatch !== a.traitMatch) return b.traitMatch - a.traitMatch
    if (b.companionScore !== a.companionScore) return b.companionScore - a.companionScore
    const tagSum = (s) => userTopTags.reduce((sum, tag) => sum + (s.attraction.traits[tag] ?? 0), 0)
    const diff = tagSum(b) - tagSum(a)
    if (diff !== 0) return diff
    return a.attraction.id.localeCompare(b.attraction.id)
  })
  return scored
}

// PDF 10절: 성향일치도×0.8 + 동행적합도×0.2, 후보 0~2개 예외처리(같은 구 유지, 테마 2위로 보충/전환).
export function scoreAttractions({ district, theme, branchId, answers, attractions }) {
  const companionKey = COMPANION_KEY_BY_BRANCH[branchId]
  const userVec = buildUserTraitVector(branchId, answers)
  const userTopTags = topTags(userVec, 2)
  const pool = (t) => attractions.filter((a) => a.district === district && a.themes.includes(t))

  const primary = scoreThemePool(pool(theme), userVec, userTopTags, companionKey)
  if (primary.length >= 3) return { effectiveTheme: theme, results: primary.slice(0, 3) }

  const themeScores = computeThemeScores(branchId, answers)
  const secondTheme = THEMES.filter((t) => t !== theme).sort((a, b) => themeScores[b] - themeScores[a])[0]
  const fallback = scoreThemePool(pool(secondTheme), userVec, userTopTags, companionKey)

  if (primary.length === 0) return { effectiveTheme: secondTheme, results: fallback.slice(0, 3) }

  const merged = [...primary, ...fallback.filter((f) => !primary.some((p) => p.attraction.id === f.attraction.id))]
  return { effectiveTheme: theme, results: merged.slice(0, 3) }
}

export function buildThemeReason(branchId, answers, theme) {
  const branch = BRANCHES[branchId]
  if (!branch) return ''
  const picks = []
  for (const q of branch.questions) {
    const opt = q.options.find((o) => o.id === answers?.[q.id])
    if (!opt) continue
    const optTop = Object.entries(opt.themeWeight).sort((a, b) => b[1] - a[1])[0][0]
    if (optTop === theme) picks.push(opt.label)
  }
  if (picks.length === 0) return `${THEME_LABELS[theme]} 테마가 추천되었습니다.`
  return `${picks.join(', ')} 같은 성향이 반영되어 ${THEME_LABELS[theme]} 테마가 추천되었습니다.`
}

// 태그 라벨 목록을 "A와 B를" 꼴로 잇는다 — 과/와, 을/를은 앞말 받침에 따라 고른다
// (PR #82 리뷰: "볼거리과", "볼거리을" 비문 노출).
function joinLabelsWithObjectJosa(labels) {
  const joined = labels.reduce((acc, label, i) => (i === 0 ? label : `${acc}${josa(acc, '과', '와')} ${label}`), '')
  return `${joined}${josa(joined, '을', '를')}`
}

// peers: 이번 추천 결과에 함께 노출되는 다른 관광지들(자기 자신 포함해도 됨).
// 기존 로직은 "내 상위 태그 2개"만 보고 문구를 만들어서, 함께 노출된 후보끼리
// 그 태그값이 같으면(=벡터가 다르더라도) 문구가 완전히 같아지는 문제가 있었다.
// → 후보들 사이에서 이 장소만 유독 높은 성향(태그)이 있으면 한 문장 덧붙여 구분한다.
//
// PR #82 리뷰 2건:
//  - 상위 태그 2개가 이 장소에서 모두 4 미만이면 ''를 돌려줘 카드 이유가 빈 칸으로 떴다
//    (전수조사 15,625조합 중 35%). 이 장소 자체의 가장 강한 성향으로 기본 문구를 만든다.
//  - 구분 문장이 "4 이상 + 다른 후보 전부보다 큼"인 태그만 봐서, 후보끼리 4 미만 구간에서만
//    다르면(대전시립미술관 지식2 vs 대전예술의전당 체험2) 여전히 같은 문장이 나왔다. 값이 낮아도
//    이 장소만 더 높은 태그가 있으면 그걸로 나누되, 4 미만이면 "두드러진다"고 과장하지 않는다.
export function buildAttractionReason(userVec, attraction, peers = []) {
  const trait = (a, tag) => a.traits[tag] ?? 0
  const userTop = topTags(userVec, 2)
  // [문장, 문장에 이미 쓴 태그들(구분 문장에서 같은 태그를 또 말해 겹치지 않게)]
  const baseOf = (a) => {
    const common = userTop.filter((tag) => trait(a, tag) >= 4)
    if (common.length > 0) {
      return [`${joinLabelsWithObjectJosa(common.map((tag) => TAG_LABELS[tag]))} 중요하게 생각하는 여행 성향과 잘 맞는 장소입니다.`, common]
    }
    const own = topTags(a.traits, 1)[0]
    return [`${TAG_LABELS[own]} 요소가 돋보이는 곳으로, 전체적인 여행 성향과 고르게 어울리는 장소입니다.`, [own]]
  }
  const [base, usedTags] = baseOf(attraction)

  const others = peers.filter((p) => p !== attraction)
  if (others.length === 0) return base

  // vs 후보들 전부보다 이 장소만 더 높은 태그 — 값이 큰 순, 같으면 격차가 큰 순.
  const pickDistinguishing = (vs, { allowUsed = false } = {}) =>
    TRAIT_TAGS
      .filter((tag) => (allowUsed || !usedTags.includes(tag)) && vs.every((o) => trait(attraction, tag) > trait(o, tag)))
      .sort((a, b) => {
        const diff = trait(attraction, b) - trait(attraction, a)
        if (diff !== 0) return diff
        const margin = (tag) => trait(attraction, tag) - Math.max(...vs.map((o) => trait(o, tag)))
        return margin(b) - margin(a)
      })[0]

  const tag = pickDistinguishing(others)
  if (tag) {
    const label = TAG_LABELS[tag]
    return trait(attraction, tag) >= 4
      ? `${base} 특히 ${label} 면에서 다른 추천지보다 두드러집니다.`
      : `${base} 다른 추천지와 비교하면 ${label} 요소가 조금 더 있는 곳입니다.`
  }

  // 후보 전체 대비로는 못 나눴다(예: A>B이지만 C와는 같음). 같은 기본 문장을 갖는 후보와
  // 1:1로만 비교해서, 그 후보 이름을 들어 나눈다 — "다른 추천지보다"라고 뭉뚱그리면 과장이 된다.
  // 벡터가 가장 비슷한 후보부터 본다 — 그 후보가 결국 이 장소와 같은 문장이 될 가능성이 제일 높아서,
  // 먼 후보와 먼저 비교하면 정작 닮은 둘이 똑같은 "X보다 …" 문장을 받는 일이 생겼다.
  const l1 = (o) => TRAIT_TAGS.reduce((sum, tag) => sum + Math.abs(trait(attraction, tag) - trait(o, tag)), 0)
  const twins = others
    .filter((o) => o.name && baseOf(o)[0] === base)
    .sort((a, b) => l1(a) - l1(b))
  // 1:1 비교에선 기본 문장에 쓴 태그도 허용한다 — 그 태그 값만 다른 둘(소제동 이색성5 vs
  // 대전트래블라운지 4)은 그게 유일한 차이라, 반복을 피하려다 문장을 못 나누는 것보다 낫다.
  for (const twin of twins) {
    const vsTwin = pickDistinguishing([twin]) ?? pickDistinguishing([twin], { allowUsed: true })
    if (vsTwin) return `${base} ${twin.name}보다 ${TAG_LABELS[vsTwin]} 요소가 더 있는 곳입니다.`
  }
  return base
}

export function getTourRecommendation(answers, attractions) {
  const district = resolveDistrict(answers)
  const branchId = resolveBranch(answers)
  if (!district || !branchId) return null
  const branch = BRANCHES[branchId]
  if (!branch.questions.every((q) => !!answers?.[q.id])) return null

  const themeScores = computeThemeScores(branchId, answers)
  const districtCounts = countAttractionsByTheme(district, attractions)
  const theme = pickTheme(branchId, answers, themeScores, districtCounts)
  const userVec = buildUserTraitVector(branchId, answers)
  const { effectiveTheme, results } = scoreAttractions({ district, theme, branchId, answers, attractions })

  return {
    district,
    branch: branchId,
    theme: effectiveTheme,
    themeReason: buildThemeReason(branchId, answers, effectiveTheme),
    companionKey: COMPANION_KEY_BY_BRANCH[branchId],
    results: results.map((r) => ({
      attraction: r.attraction,
      score: Math.round(r.finalScore),
      reason: buildAttractionReason(userVec, r.attraction, results.map((x) => x.attraction)),
    })),
  }
}
