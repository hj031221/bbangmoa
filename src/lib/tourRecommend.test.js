import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Q0, Q1, BRANCHES } from '../data/tourSurveyConfig.js'
import { TAGGED_ATTRACTIONS } from '../data/tourAttractionTags.js'
import {
  resolveDistrict, resolveBranch, computeThemeScores, pickTheme,
  buildUserTraitVector, cosineSimilarity, scoreAttractions,
  buildThemeReason, buildAttractionReason, getTourRecommendation,
} from './tourRecommend.js'

function districtOptionId(district) {
  return Q0.options.find((o) => o.district === district).id
}
function branchOptionId(branchId) {
  return Q1.options.find((o) => o.branch === branchId).id
}
function sampleAnswers(branchId, optionIndexes, district) {
  const branch = BRANCHES[branchId]
  const answers = { [Q0.id]: districtOptionId(district), [Q1.id]: branchOptionId(branchId) }
  branch.questions.forEach((q, i) => { answers[q.id] = q.options[optionIndexes[i]].id })
  return answers
}

function mockAttraction(id, district, themes, traitOverrides = {}) {
  return {
    id, name: id, district, themes,
    traits: {
      walk: 2, rest: 2, scenery: 2, exploration: 2, immersion: 2,
      appreciation: 2, sightseeing: 2, experience: 2, knowledge: 2, uniqueness: 2, activity: 2,
      ...traitOverrides,
    },
    companion: { solo: 50, couple: 50, friends: 50, childrenFamily: 50, parentsFamily: 50 },
  }
}

test('resolveDistrict/resolveBranch: 미응답이면 null', () => {
  assert.equal(resolveDistrict({}), null)
  assert.equal(resolveBranch({}), null)
})

test('resolveDistrict/resolveBranch: Q0/Q1 응답을 올바르게 해석한다', () => {
  const answers = { [Q0.id]: 'q0_jung', [Q1.id]: 'q1_couple' }
  assert.equal(resolveDistrict(answers), '중구')
  assert.equal(resolveBranch(answers), 'B')
})

test('computeThemeScores + pickTheme: PDF 7절 예시(연인 Q2①Q3①Q4③Q5①) → 자연 결정', () => {
  const answers = sampleAnswers('B', [0, 0, 2, 0], '중구')
  const scores = computeThemeScores('B', answers)
  assert.deepEqual(scores, { nature: 15, history: 1, culture: 8, education: 1, etc: 5 })
  assert.equal(pickTheme('B', answers, scores, null), 'nature')
})

test('pickTheme 동점처리: Q5 선택의 주 테마가 있으면 그것으로 정해진다', () => {
  // history/culture 동점을 만드는 인위적 themeScores, 실제 Q5 응답은 A_q5_2(역사 주테마: history5·culture2)
  const answers = sampleAnswers('A', [1, 1, 2, 1], '중구')
  const tied = { nature: 0, history: 10, culture: 10, education: 0, etc: 0 }
  assert.equal(pickTheme('A', answers, tied, null), 'history')
})

test('pickTheme 동점처리: Q5→Q4→Q3 모두 역사=문화로 동률이면 구 관광지 수로 결정된다', () => {
  // E_q3_4/E_q4_4/E_q5_4 는 모두 history1=culture1이라 Q5→Q4→Q3 단계에서 동점이 풀리지 않는다.
  const answers = sampleAnswers('E', [0, 3, 3, 3], '중구')
  const tied = { nature: 0, history: 10, culture: 10, education: 0, etc: 0 }
  const counts = { nature: 1, history: 2, culture: 5, education: 0, etc: 0 }
  assert.equal(pickTheme('E', answers, tied, counts), 'culture')
})

test('buildUserTraitVector: Q2~Q5 태그가 누적된다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '중구')
  const vec = buildUserTraitVector('A', answers)
  // A_q2_1 rest5·walk4·scenery3 + A_q3_1 walk5·scenery5·rest3 + A_q4_1 rest5·scenery3 + A_q5_1 rest5·scenery3
  assert.equal(vec.rest, 5 + 3 + 5 + 5)
  assert.equal(vec.walk, 4 + 5)
  assert.equal(vec.scenery, 3 + 5 + 3 + 3)
  assert.equal(vec.knowledge, 0)
})

test('cosineSimilarity: 동일 벡터는 1, 한쪽이 0벡터면 0을 반환한다(0벡터 방지)', () => {
  const v = { walk: 3, rest: 1, scenery: 0, exploration: 0, immersion: 0, appreciation: 0, sightseeing: 0, experience: 0, knowledge: 0, uniqueness: 0, activity: 0 }
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-9)
  const zero = { walk: 0, rest: 0, scenery: 0, exploration: 0, immersion: 0, appreciation: 0, sightseeing: 0, experience: 0, knowledge: 0, uniqueness: 0, activity: 0 }
  assert.equal(cosineSimilarity(v, zero), 0)
  assert.equal(cosineSimilarity(zero, zero), 0)
})

test('scoreAttractions: 후보 3개 이상이면 그대로 상위 3개를 반환하고 테마는 바뀌지 않는다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '중구')
  const attractions = [
    mockAttraction('n1', '중구', ['nature'], { rest: 5, walk: 5, scenery: 5 }),
    mockAttraction('n2', '중구', ['nature']),
    mockAttraction('n3', '중구', ['nature']),
    mockAttraction('h1', '중구', ['history']),
  ]
  const { effectiveTheme, results } = scoreAttractions({ district: '중구', theme: 'nature', branchId: 'A', answers, attractions })
  assert.equal(effectiveTheme, 'nature')
  assert.equal(results.length, 3)
  assert.equal(results[0].attraction.id, 'n1')
})

// A_q2_1+A_q3_2+A_q4_2+A_q5_2 → nature5/history16/culture7/education6/etc2 (history가 2위 테마로 뚜렷하게 정해짐)
test('scoreAttractions: 후보 0개면 테마 2위로 완전히 전환된다(PDF 10절)', () => {
  const answers = sampleAnswers('A', [0, 1, 1, 1], '중구')
  const attractions = [
    mockAttraction('h1', '중구', ['history']),
    mockAttraction('h2', '중구', ['history']),
    mockAttraction('h3', '중구', ['history']),
  ]
  const { effectiveTheme, results } = scoreAttractions({ district: '중구', theme: 'nature', branchId: 'A', answers, attractions })
  assert.equal(effectiveTheme, 'history')
  assert.equal(results.length, 3)
})

test('scoreAttractions: 후보 1개면 2위 테마에서 상위 2개를 보충한다', () => {
  const answers = sampleAnswers('A', [0, 1, 1, 1], '중구')
  const attractions = [
    mockAttraction('n1', '중구', ['nature']),
    mockAttraction('h1', '중구', ['history']),
    mockAttraction('h2', '중구', ['history']),
  ]
  const { effectiveTheme, results } = scoreAttractions({ district: '중구', theme: 'nature', branchId: 'A', answers, attractions })
  assert.equal(effectiveTheme, 'nature')
  assert.equal(results.length, 3)
  // primary(1개)가 먼저 오고 fallback으로 보충되므로 순서상 n1이 항상 첫 번째다.
  assert.equal(results[0].attraction.id, 'n1')
})

test('scoreAttractions 동점처리: finalScore가 같으면 id 오름차순으로 정렬된다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '중구')
  const attractions = [
    mockAttraction('z1', '중구', ['nature']),
    mockAttraction('a1', '중구', ['nature']),
  ]
  const { results } = scoreAttractions({ district: '중구', theme: 'nature', branchId: 'A', answers, attractions })
  assert.equal(results[0].attraction.id, 'a1')
  assert.equal(results[1].attraction.id, 'z1')
})

test('buildAttractionReason: 사용자 상위 태그와 관광지 태그가 겹치면 문장을 만든다', () => {
  const userVec = { walk: 1, rest: 1, scenery: 1, exploration: 1, immersion: 1, appreciation: 1, sightseeing: 1, experience: 1, knowledge: 1, uniqueness: 5, activity: 5 }
  const attraction = mockAttraction('x', '중구', ['etc'], { uniqueness: 5, activity: 5 })
  const reason = buildAttractionReason(userVec, attraction)
  assert.match(reason, /이색성/)
  assert.match(reason, /활동성/)
})

test('buildAttractionReason: 후보군에서 이 장소만 특정 성향이 두드러지면 문장이 구분된다', () => {
  const userVec = { walk: 5, rest: 5, scenery: 3, exploration: 0, immersion: 0, appreciation: 0, sightseeing: 0, experience: 0, knowledge: 0, uniqueness: 0, activity: 0 }
  const same = { walk: 5, rest: 5 }
  const a = mockAttraction('a', '중구', ['nature'], same)
  const b = mockAttraction('b', '중구', ['nature'], same)
  const c = mockAttraction('c', '중구', ['nature'], { ...same, exploration: 5 })

  const reasonA = buildAttractionReason(userVec, a, [a, b, c])
  const reasonB = buildAttractionReason(userVec, b, [a, b, c])
  const reasonC = buildAttractionReason(userVec, c, [a, b, c])

  assert.equal(reasonA, reasonB) // 진짜로 벡터가 동일하면 문장도 동일 — 태깅 데이터 문제이지 코드로 더 구분할 정보가 없음
  assert.notEqual(reasonA, reasonC)
  assert.match(reasonC, /탐방/)
})

// PR #82 리뷰: 사용자 상위 태그 2개가 이 장소에서 4 미만이면 이유가 통째로 빈 문자열이었다
// (전수조사 시 조합의 35%). 카드에 빈 칸 대신 그 장소 자체의 두드러진 성향으로 채운다.
test('buildAttractionReason: 상위 태그가 안 겹쳐도 빈 문자열 대신 기본 문구를 만든다', () => {
  const userVec = { walk: 5, rest: 5, scenery: 0, exploration: 0, immersion: 0, appreciation: 0, sightseeing: 0, experience: 0, knowledge: 0, uniqueness: 0, activity: 0 }
  const attraction = mockAttraction('x', '중구', ['culture'], { walk: 1, rest: 1, appreciation: 4 })
  const reason = buildAttractionReason(userVec, attraction)
  assert.notEqual(reason, '')
  assert.match(reason, /감상/)
})

// PR #82 리뷰: "볼거리과", "볼거리을" 같은 비문 — 받침 유무에 따라 과/와, 을/를을 고른다.
test('buildAttractionReason: 조사(과/와, 을/를)를 받침에 맞게 고른다', () => {
  const base = { walk: 0, rest: 0, scenery: 0, exploration: 0, immersion: 0, appreciation: 0, sightseeing: 0, experience: 0, knowledge: 0, uniqueness: 0, activity: 0 }
  // 볼거리(받침 없음) + 감상(받침 있음) → "볼거리와 감상을"
  const a = mockAttraction('a', '중구', ['culture'], { sightseeing: 5, appreciation: 5 })
  assert.match(buildAttractionReason({ ...base, sightseeing: 5, appreciation: 4 }, a), /볼거리와 감상을 /)
  // 볼거리 하나만 → "볼거리를"
  const b = mockAttraction('b', '중구', ['culture'], { sightseeing: 5, appreciation: 1 })
  assert.match(buildAttractionReason({ ...base, sightseeing: 5, appreciation: 4 }, b), /볼거리를 /)
  // 감상(받침) + 볼거리 → "감상과 볼거리를"
  assert.match(buildAttractionReason({ ...base, appreciation: 5, sightseeing: 4 }, a), /감상과 볼거리를 /)
})

// PR #82 리뷰: 동점 후보끼리 이유까지 완전히 같아지는 경우(서구·혼자: 대전시립미술관·대전예술의전당).
// 두 장소는 지식 2 vs 1, 체험 1 vs 2 처럼 4 미만 구간에서만 다른데, 예전 구분 로직은 4 이상인
// 태그만 봐서 아무것도 못 골랐다 — 낮은 값이라도 이 장소가 유일하게 더 높은 태그가 있으면
// 그걸로 문장을 나눈다(단, 4 미만이면 "두드러진다" 대신 완곡한 표현).
test('buildAttractionReason: 4 미만 구간에서만 다른 후보끼리도 이유가 갈린다', () => {
  const userVec = { walk: 0, rest: 0, scenery: 0, exploration: 0, immersion: 0, appreciation: 5, sightseeing: 5, experience: 0, knowledge: 0, uniqueness: 0, activity: 0 }
  const low = { walk: 1, rest: 1, scenery: 1, exploration: 1, immersion: 1, experience: 1, knowledge: 1, uniqueness: 1, activity: 1, appreciation: 5, sightseeing: 5 }
  const museum = mockAttraction('museum', '서구', ['culture'], { ...low, knowledge: 2 })
  const hall = mockAttraction('hall', '서구', ['culture'], { ...low, experience: 2 })
  const rMuseum = buildAttractionReason(userVec, museum, [museum, hall])
  const rHall = buildAttractionReason(userVec, hall, [museum, hall])
  assert.notEqual(rMuseum, rHall)
  assert.match(rMuseum, /지식/)
  assert.match(rHall, /체험/)
  assert.doesNotMatch(rMuseum, /두드러집니다/) // 2점짜리 차이를 "두드러진다"고 과장하지 않는다
  // 4 이상이면 기존 표현 유지
  const strong = mockAttraction('strong', '서구', ['culture'], { ...low, knowledge: 5 })
  assert.match(buildAttractionReason(userVec, strong, [strong, hall]), /지식 면에서 다른 추천지보다 두드러집니다/)
})

// 후보 3곳 중 A가 모든 태그에서 B·C 이상이고 B는 C보다 체험이 높은 경우 — B는 "후보 전부보다
// 높은 태그"가 없어 C와 같은 문장이 됐다. 같은 문장이 될 후보(C)와 1:1로 비교해 이름을 들어 나눈다.
test('buildAttractionReason: 전체 대비로 못 나누면 같은 문장이 될 후보와 1:1로 비교해 나눈다', () => {
  const userVec = { walk: 0, rest: 0, scenery: 0, exploration: 0, immersion: 0, appreciation: 0, sightseeing: 0, experience: 0, knowledge: 0, uniqueness: 5, activity: 5 }
  const low = { walk: 1, rest: 1, scenery: 1, exploration: 1, immersion: 1, appreciation: 1, sightseeing: 1, knowledge: 1, activity: 3 }
  const a = mockAttraction('대동벽화마을', '동구', ['etc'], { ...low, uniqueness: 5, experience: 3 })
  const b = mockAttraction('찬샘마을', '동구', ['etc'], { ...low, uniqueness: 4, experience: 3 })
  const c = mockAttraction('대전트래블라운지', '동구', ['etc'], { ...low, uniqueness: 4, experience: 2 })
  const rB = buildAttractionReason(userVec, b, [a, b, c])
  const rC = buildAttractionReason(userVec, c, [a, b, c])
  assert.notEqual(rB, rC)
  assert.match(rB, /대전트래블라운지보다 체험 요소가 더 있는 곳입니다/)
  // 기본 문장에 쓴 태그(이색성)는 "다른 추천지보다" 구분 문장에선 피하지만, 1:1 비교에서 그게
  // 유일한 차이면 허용한다(못 나누는 것보다 낫다)
  const rA = buildAttractionReason(userVec, a, [a, b, c])
  assert.match(rA, /찬샘마을보다 이색성 요소가 더 있는 곳입니다/)
  const d = mockAttraction('d', '동구', ['etc'], { ...low, uniqueness: 5, experience: 3, knowledge: 2 })
  const rD = buildAttractionReason(userVec, d, [d, b, c])
  assert.match(rD, /다른 추천지와 비교하면 지식 요소가 조금 더/)
  assert.equal((rD.match(/이색성/g) || []).length, 1)
})

test('buildAttractionReason: peers를 안 넘기면(기존 호출부) 기존 동작 그대로 유지된다', () => {
  const userVec = { walk: 1, rest: 1, scenery: 1, exploration: 1, immersion: 1, appreciation: 1, sightseeing: 1, experience: 1, knowledge: 1, uniqueness: 5, activity: 5 }
  const attraction = mockAttraction('x', '중구', ['etc'], { uniqueness: 5, activity: 5 })
  assert.equal(buildAttractionReason(userVec, attraction), buildAttractionReason(userVec, attraction, []))
})

test('getTourRecommendation: 전체 파이프라인이 district/branch/theme/results를 반환한다', () => {
  const answers = sampleAnswers('B', [0, 0, 2, 0], '중구')
  const attractions = [
    mockAttraction('n1', '중구', ['nature']),
    mockAttraction('n2', '중구', ['nature']),
    mockAttraction('n3', '중구', ['nature']),
  ]
  const result = getTourRecommendation(answers, attractions)
  assert.equal(result.district, '중구')
  assert.equal(result.branch, 'B')
  assert.equal(result.theme, 'nature')
  assert.equal(result.results.length, 3)
  assert.ok(result.themeReason.length > 0)
})

test('getTourRecommendation: 응답이 부족하면 null', () => {
  assert.equal(getTourRecommendation({}, []), null)
})

test('적합도는 성향 80%·동행 20%이며 작은 점수 차이도 반올림 전에 정렬한다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '중구')
  const attractions = ['a', 'b', 'c'].map(id => mockAttraction(id, '중구', ['nature']))
  attractions[0].companion.solo = 50
  attractions[1].companion.solo = 51
  attractions[2].companion.solo = 52
  const { results } = scoreAttractions({ district: '중구', theme: 'nature', branchId: 'A', answers, attractions })
  assert.deepEqual(results.map(r => r.attraction.id), ['c', 'b', 'a'])
  const vector = buildUserTraitVector('A', answers)
  for (const row of results) {
    assert.equal(row.finalScore, cosineSimilarity(vector, row.attraction.traits) * 100 * .8 + row.attraction.companion.solo * .2)
  }
  const displayed = getTourRecommendation(answers, attractions)
  assert.deepEqual(displayed.results.map(r => r.attraction.id), ['c', 'b', 'a'])
  assert.deepEqual(displayed.results.map(r => r.score), results.map(r => Math.round(r.finalScore)))
})

test('실제 성향과 동행 점수가 같으면 순위용 가산점으로 적합도를 조작하지 않는다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '중구')
  const attractions = ['c', 'a', 'b'].map(id => mockAttraction(id, '중구', ['nature']))
  const { results } = getTourRecommendation(answers, attractions)
  assert.deepEqual(results.map(r => r.attraction.id), ['a', 'b', 'c'])
  assert.equal(new Set(results.map(r => r.score)).size, 1)
})

function* cartesian(counts) {
  const indexes = new Array(counts.length).fill(0)
  while (true) {
    yield [...indexes]
    let i = counts.length - 1
    while (i >= 0) {
      indexes[i]++
      if (indexes[i] < counts[i]) break
      indexes[i] = 0
      i--
    }
    if (i < 0) return
  }
}

// 코드리뷰 발견: PR 설명이 내세운 "동일 벡터 쌍 68→0, 전부 동일 케이스 22.6%→3.2%"를 검증하는
// 테스트가 없었다(위 벡터 중복 테스트는 데이터 차원만 봄). 실제 설문 조합(구5×브랜치5×문항4×5지선다
// = 15,625개) 전수를 실제 TAGGED_ATTRACTIONS로 돌려 top-3 반올림 점수가 전부 같아지는 비율을 재고,
// 이후 SITE_TRAIT_OVERRIDES를 손대다 동점률이 다시 오르면 잡아내는 회귀 가드로 둔다.
test('설문 조합 전수 순회(15,625개): top-3 적합도가 전부 같아지는 비율이 낮게 유지된다 (PR #82 주장: 22.6%→3.2%)', () => {
  let total = 0
  let allTied = 0
  for (const districtOpt of Q0.options) {
    for (const branchId of Object.keys(BRANCHES)) {
      const branch = BRANCHES[branchId]
      const counts = branch.questions.map((q) => q.options.length)
      for (const indexes of cartesian(counts)) {
        const answers = sampleAnswers(branchId, indexes, districtOpt.district)
        const rec = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
        if (!rec || rec.results.length < 3) continue
        total++
        const [s0, s1, s2] = rec.results.map((r) => r.score)
        if (s0 === s1 && s1 === s2) allTied++
      }
    }
  }
  assert.equal(total, 15625, `조합 수가 예상과 다름: ${total}`)
  const rate = allTied / total
  assert.ok(rate <= 0.05, `top-3 전부 동점 비율이 임계값(5%)을 넘음: ${(rate * 100).toFixed(1)}% (${allTied}/${total})`)
})
