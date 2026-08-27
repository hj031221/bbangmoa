import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Q0, Q1, BRANCHES } from '../data/tourSurveyConfig.js'
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
