import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildHistoryState, restoreHistoryState, HISTORY_STATE_DEFAULTS } from './viewHistory.js'

const base = () => ({
  stage: 'survey', tourStage: 'survey', tourSelectedId: null, tourHubFromReveal: false, directBreadId: null,
})

test('buildHistoryState: 현재 상태에 patch만 덮어써서 병합한다', () => {
  const result = buildHistoryState(base(), { stage: 'reveal' })
  assert.deepEqual(result, { ...base(), stage: 'reveal' })
})

test('buildHistoryState: 빠진 필드는 기본값으로 채워 항상 완전한 튜플을 만든다', () => {
  // 옛 코드의 부분 튜플(directBreadId 없음)로 조립해도 키가 빠지지 않아야 한다.
  const result = buildHistoryState({ stage: 'map' }, { stage: 'reveal' })
  assert.deepEqual(result, { ...HISTORY_STATE_DEFAULTS, stage: 'reveal' })
})

test('buildHistoryState: directBreadId도 patch로 실어 보낼 수 있다(빵 종류 바로가기 진입)', () => {
  const result = buildHistoryState(base(), { stage: 'reveal', directBreadId: 'saltBread' })
  assert.deepEqual(result, { ...base(), stage: 'reveal', directBreadId: 'saltBread' })
})

test('restoreHistoryState: event.state가 있으면 그 값으로 복원한다', () => {
  const eventState = {
    stage: 'map', tourStage: 'hub', tourSelectedId: 'a1', tourHubFromReveal: true, directBreadId: 'saltBread',
  }
  assert.deepEqual(restoreHistoryState(eventState, base()), eventState)
})

test('restoreHistoryState: event.state가 null이면(직접 URL 진입 등) fallback을 그대로 쓴다', () => {
  const fallback = { ...base(), stage: 'reveal' }
  assert.deepEqual(restoreHistoryState(null, fallback), fallback)
})

test('restoreHistoryState: event.state에 일부 필드만 있으면 나머지는 fallback으로 채운다', () => {
  const eventState = { stage: 'reveal' }
  assert.deepEqual(restoreHistoryState(eventState, base()), { ...base(), stage: 'reveal' })
})

test('restoreHistoryState: 칩으로 고른 빵 이전 지점으로 돌아가면 directBreadId도 null로 되돌아간다', () => {
  // 칩 진입 항목에서 뒤로가기 → 홈 항목(directBreadId:null 로 심어둔 state)
  const eventState = { ...base() } // stage:'survey', directBreadId:null
  const fallbackWhileChipRevealIsShowing = { ...base(), stage: 'reveal', directBreadId: 'saltBread' }
  const restored = restoreHistoryState(eventState, fallbackWhileChipRevealIsShowing)
  assert.equal(restored.directBreadId, null)
  assert.equal(restored.stage, 'survey')
})

test('restoreHistoryState: 두 소스 모두 없는 필드는 기본값으로 채운다(배포 전 히스토리 항목)', () => {
  const legacyEventState = { stage: 'map' } // directBreadId 개념이 없던 시절 항목
  const restored = restoreHistoryState(legacyEventState, { stage: 'survey' })
  assert.deepEqual(restored, { ...HISTORY_STATE_DEFAULTS, stage: 'map' })
})
