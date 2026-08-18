// 관광모아 추천 엔진 — PDF(대전 관광지 추천 트리형+가중치 로직 찐최종본) 4·7·9·10·15절 구현.
//   Q0(구) + Q1(동행자→Branch) + Q2~Q5(테마 가중치+성향 태그) → 테마 결정 → 코사인 유사도
//   → 동행 적합도 → 80:20 최종 점수 → TOP3.
import { Q0, Q1, BRANCHES, THEMES, TRAIT_TAGS } from '../data/tourSurveyConfig.js'

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

export function buildAttractionReason(userVec, attraction) {
  const userTop = topTags(userVec, 2)
  const common = userTop.filter((tag) => (attraction.traits[tag] ?? 0) >= 4)
  if (common.length === 0) return ''
  const labels = common.map((tag) => TAG_LABELS[tag])
  return `${labels.join('과 ')}을 중요하게 생각하는 여행 성향과 잘 맞는 장소입니다.`
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
      reason: buildAttractionReason(userVec, r.attraction),
    })),
  }
}
