import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SURVEY_SESSION_MAX_AGE_MS as TTL, restoreSurveySession, expireSurveyHistory } from './surveySession.js'

const now = 200000000
const saved = {
  answers: { q1: 'A' }, tourAnswers: { q1: 'B' },
  origin: { lat: 36.3, lng: 127.4 }, district: '중구', surveyStartedAt: now - 1000,
}

test('당일 새로고침은 설문과 출발지를 복원하고 만료 시각을 연장하지 않는다', () => {
  assert.deepEqual(restoreSurveySession(saved, now), saved)
  assert.deepEqual(restoreSurveySession(saved, now + 1000), saved)
})

test('24시간 경계, 저장 시각 없는 기존 데이터, 미래 시각은 초기화한다', () => {
  for (const surveyStartedAt of [now - TTL, now - TTL - 1, undefined, null, now + 1]) {
    const restored = restoreSurveySession({ ...saved, surveyStartedAt }, now)
    assert.deepEqual(restored.answers, {})
    assert.deepEqual(restored.tourAnswers, {})
    assert.equal(restored.origin, null)
    assert.equal(restored.courseDraft, null)
    assert.equal(restored.surveyStartedAt, now)
  }
})

test('유효한 뒤로가기 스냅샷은 그대로 복원한다', () => {
  const history = { stage: 'reveal', breadStep: 5, surveySnapshot: saved }
  assert.equal(expireSurveyHistory(history, now), history)
})

test('오래된 history는 응답과 결과 화면을 되살리지 않고 일반 지도 상태는 유지한다', () => {
  for (const surveyStartedAt of [undefined, now - TTL]) {
    const history = {
      stage: 'map', tourStage: 'reveal', breadStep: 5, tourStep: 5,
      directBreadId: 'saltBread', appDepth: 3, browseMap: { search: '성심당' },
      surveySnapshot: { ...saved, surveyStartedAt },
    }
    const restored = expireSurveyHistory(history, now)
    assert.equal(restored.surveySnapshot, null)
    assert.equal(restored.stage, 'survey')
    assert.equal(restored.tourStage, 'survey')
    assert.equal(restored.breadStep, 0)
    assert.equal(restored.tourStep, 0)
    assert.equal(restored.directBreadId, null)
    assert.deepEqual(restored.browseMap, history.browseMap)
    assert.equal(restored.appDepth, 3)
  }
})
