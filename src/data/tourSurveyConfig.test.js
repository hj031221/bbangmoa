import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Q0, Q1, BRANCHES, THEMES, TRAIT_TAGS } from './tourSurveyConfig.js'

test('Q0는 5개 행정구 옵션을 가진다', () => {
  assert.equal(Q0.options.length, 5)
  const districts = Q0.options.map((o) => o.district)
  assert.deepEqual(districts, ['동구', '중구', '서구', '유성구', '대덕구'])
})

test('Q1은 5개 동행자 옵션이며 Branch A~E와 1:1 매핑된다', () => {
  assert.equal(Q1.options.length, 5)
  const branches = Q1.options.map((o) => o.branch).sort()
  assert.deepEqual(branches, ['A', 'B', 'C', 'D', 'E'])
})

test('모든 Branch는 Q2~Q5 4문항, 각 5지선다를 가진다', () => {
  for (const branchId of ['A', 'B', 'C', 'D', 'E']) {
    const branch = BRANCHES[branchId]
    assert.equal(branch.questions.length, 4)
    for (const q of branch.questions) {
      assert.equal(q.options.length, 5)
      for (const opt of q.options) {
        for (const theme of THEMES) assert.ok(theme in opt.themeWeight, `${opt.id}: ${theme} 누락`)
        for (const tag of Object.keys(opt.traits)) {
          assert.ok(TRAIT_TAGS.includes(tag), `${opt.id}: 잘못된 태그 ${tag}`)
        }
      }
    }
  }
})

test('PDF 7절 예시: 연인(B) Q2①,Q3①,Q4③,Q5① → 자연15/역사1/문화8/교육1/기타5', () => {
  const branch = BRANCHES.B
  const scores = { nature: 0, history: 0, culture: 0, education: 0, etc: 0 }
  const picks = [
    branch.questions[0].options[0],
    branch.questions[1].options[0],
    branch.questions[2].options[2],
    branch.questions[3].options[0],
  ]
  for (const opt of picks) {
    for (const theme of THEMES) scores[theme] += opt.themeWeight[theme]
  }
  assert.deepEqual(scores, { nature: 15, history: 1, culture: 8, education: 1, etc: 5 })
})
