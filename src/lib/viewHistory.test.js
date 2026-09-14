import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildHistoryState, restoreHistoryState } from './viewHistory.js'

test('buildHistoryState: 현재 상태에 patch만 덮어써서 병합한다', () => {
  const current = { stage: 'survey', tourStage: 'survey', tourSelectedId: null, tourHubFromReveal: false }
  const result = buildHistoryState(current, { stage: 'reveal' })
  assert.deepEqual(result, { stage: 'reveal', tourStage: 'survey', tourSelectedId: null, tourHubFromReveal: false })
})

test('restoreHistoryState: event.state가 있으면 그 값으로 복원한다', () => {
  const fallback = { stage: 'survey', tourStage: 'survey', tourSelectedId: null, tourHubFromReveal: false }
  const eventState = { stage: 'map', tourStage: 'hub', tourSelectedId: 'a1', tourHubFromReveal: true }
  assert.deepEqual(restoreHistoryState(eventState, fallback), eventState)
})

test('restoreHistoryState: event.state가 null이면(직접 URL 진입 등) fallback을 그대로 쓴다', () => {
  const fallback = { stage: 'survey', tourStage: 'survey', tourSelectedId: null, tourHubFromReveal: false }
  assert.deepEqual(restoreHistoryState(null, fallback), fallback)
})

test('restoreHistoryState: event.state에 일부 필드만 있으면 나머지는 fallback으로 채운다', () => {
  const fallback = { stage: 'survey', tourStage: 'survey', tourSelectedId: null, tourHubFromReveal: false }
  const eventState = { stage: 'reveal' }
  assert.deepEqual(restoreHistoryState(eventState, fallback), {
    stage: 'reveal', tourStage: 'survey', tourSelectedId: null, tourHubFromReveal: false,
  })
})
