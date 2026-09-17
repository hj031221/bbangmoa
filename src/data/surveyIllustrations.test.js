import test from 'node:test'
import assert from 'node:assert/strict'
import { Q1, BRANCHES } from './surveyConfig.js'
import { Q0, Q1 as TOUR_Q1, BRANCHES as TOUR_BRANCHES } from './tourSurveyConfig.js'
import { SURVEY_ILLUSTRATIONS } from './surveyIllustrations.js'
import { SURVEY_ILLUSTRATION_PATHS } from './surveyIllustrationPaths.js'

for (const [kind, questions] of [
  ['bread', [Q1, ...Object.values(BRANCHES).flatMap(b => b.questions)]],
  ['tour', [Q0, TOUR_Q1, ...Object.values(TOUR_BRANCHES).flatMap(b => b.questions)]],
]) {
  test(`${kind}: 모든 선지에 그림이 있고 지역 선택 외에는 문항 내 중복하지 않는다`, () => {
    for (const question of questions) {
      const illustrations = SURVEY_ILLUSTRATIONS[kind][question.id]
      assert.equal(illustrations?.length, question.options.length, question.id)
      assert.ok(illustrations.every(Boolean), question.id)
      for (const illustration of illustrations) {
        assert.ok(SURVEY_ILLUSTRATION_PATHS[illustration]?.[0], `${kind}/${question.id}: ${illustration} 그림 누락`)
      }
      if (kind === 'tour' && question.id === Q0.id) {
        assert.deepEqual(illustrations, question.options.map(() => '📍'))
      } else {
        assert.equal(new Set(illustrations).size, illustrations.length, question.id)
      }
    }
  })
}
