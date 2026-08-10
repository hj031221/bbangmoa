import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAGGED_ATTRACTIONS } from '../data/tourAttractionTags.js'
import { Q0, Q1, BRANCHES, THEMES } from '../data/tourSurveyConfig.js'
import { getTourRecommendation } from './tourRecommend.js'

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

test('PDF 17절-1: 동일 응답을 반복 입력하면 동일한 테마와 TOP3가 반환된다(결정론성)', () => {
  const answers = sampleAnswers('B', [0, 0, 2, 0], '중구')
  const r1 = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
  const r2 = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
  assert.equal(r1.theme, r2.theme)
  assert.deepEqual(r1.results.map((r) => r.attraction.id), r2.results.map((r) => r.attraction.id))
})

test('PDF 17절-2: 모든 Branch에서 5개 테마 각각 결과로 나올 수 있는 경로가 존재한다', () => {
  const themeIndex = { nature: 0, history: 1, culture: 2, education: 3, etc: 4 }
  const seenThemes = new Set()
  for (const branchId of Object.keys(BRANCHES)) {
    for (const theme of THEMES) {
      const idx = themeIndex[theme]
      const answers = sampleAnswers(branchId, [idx, idx, idx, idx], '유성구')
      const r = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
      seenThemes.add(r.theme)
    }
  }
  for (const theme of THEMES) assert.ok(seenThemes.has(theme), `테마 도달 불가: ${theme}`)
})

test('PDF 17절-3: 각 Branch의 Q2~Q5에서 5개 테마가 균등하게 최댓값 옵션으로 나타난다(구조적 편향 없음)', () => {
  for (const branchId of Object.keys(BRANCHES)) {
    const branch = BRANCHES[branchId]
    const dominantCounts = { nature: 0, history: 0, culture: 0, education: 0, etc: 0 }
    for (const q of branch.questions) {
      for (const opt of q.options) {
        const top = Object.entries(opt.themeWeight).sort((a, b) => b[1] - a[1])[0][0]
        dominantCounts[top] += 1
      }
    }
    for (const theme of THEMES) {
      assert.equal(dominantCounts[theme], 4, `branch=${branchId} theme=${theme} count=${dominantCounts[theme]}`)
    }
  }
})

test('PDF 17절-4: 행정구 필터 이후 다른 구 관광지가 결과에 포함되지 않는다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '동구')
  const r = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
  for (const { attraction } of r.results) assert.equal(attraction.district, '동구')
})

test('PDF 17절-5: 복수 테마를 가진 관광지는 각 테마 후보군 모두에 나타날 수 있다', () => {
  const multiTheme = TAGGED_ATTRACTIONS.find((a) => a.themes.length > 1)
  assert.ok(multiTheme, '복수 테마 관광지가 없음')
  for (const theme of multiTheme.themes) {
    const pool = TAGGED_ATTRACTIONS.filter((a) => a.district === multiTheme.district && a.themes.includes(theme))
    assert.ok(pool.some((a) => a.id === multiTheme.id))
  }
})

test('PDF 17절-6: 실제 데이터에서도 추천 결과가 항상 1~3개 반환된다(후보 부족 예외처리 동작)', () => {
  for (const branchId of Object.keys(BRANCHES)) {
    for (const district of Q0.options.map((o) => o.district)) {
      const answers = sampleAnswers(branchId, [4, 4, 4, 4], district) // 기타(가장 후보가 적은 테마) 강제 선택
      const r = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
      assert.ok(r.results.length >= 1 && r.results.length <= 3, `branch=${branchId} district=${district} 결과 ${r.results.length}개`)
    }
  }
})
