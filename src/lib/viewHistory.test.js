import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildHistoryState, restoreHistoryState, HISTORY_STATE_DEFAULTS } from './viewHistory.js'

const base = () => ({
  ...HISTORY_STATE_DEFAULTS,
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
  assert.deepEqual(restoreHistoryState(eventState, base()), { ...base(), ...eventState })
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

test('지도 상세 → 검색 → 구 필터를 역순 복원하고 앞으로가기도 같은 상태를 복원한다', () => {
  const district = buildHistoryState(base(), { browseMap: { ...base().browseMap, district: '중구' } })
  const search = buildHistoryState(district, { browseMap: { ...district.browseMap, search: '성심당' } })
  const detail = buildHistoryState(search, { browseMap: { ...search.browseMap, selectedId: 'bakery-1' } })
  const backToSearch = restoreHistoryState(structuredClone(search), detail)
  assert.equal(backToSearch.browseMap.selectedId, null)
  assert.equal(backToSearch.browseMap.search, '성심당')
  const backToDistrict = restoreHistoryState(structuredClone(district), backToSearch)
  assert.equal(backToDistrict.browseMap.district, '중구')
  assert.equal(backToDistrict.browseMap.search, '')
  assert.deepEqual(restoreHistoryState(structuredClone(detail), backToDistrict), detail)
})

test('일반 지도와 추천 지도 선택을 분리하고 근처 빵집 진입 조건도 복원한다', () => {
  const nearby = { name: '테스트 관광지', lat: 36.3, lng: 127.4 }
  const previous = buildHistoryState(base(), {
    browseMap: { ...base().browseMap, origin: nearby, selectedId: 'browse' },
    resultMap: { ...base().resultMap, district: '서구', selectedId: 'result' },
  })
  const cleared = buildHistoryState(previous, { browseMap: base().browseMap })
  assert.equal(cleared.resultMap.selectedId, 'result')
  assert.deepEqual(restoreHistoryState(structuredClone(previous), cleared).browseMap.origin, nearby)
})

test('두 설문 모두 완료 화면에서 마지막 문항과 해당 분기의 응답을 복원한다', () => {
  for (const [stageKey, stepKey] of [['stage', 'breadStep'], ['tourStage', 'tourStep']]) {
    const lastQuestion = buildHistoryState(base(), {
      [stepKey]: 5,
      surveySnapshot: { answers: { q1: 'A' }, tourAnswers: { q0: '서구', q1: 'B' }, origin: null },
    })
    const result = buildHistoryState(lastQuestion, { [stageKey]: 'reveal' })
    const restarted = buildHistoryState(result, { [stageKey]: 'survey', [stepKey]: 0, surveySnapshot: { answers: {}, tourAnswers: {}, origin: null } })
    const restored = restoreHistoryState(structuredClone(lastQuestion), restarted)
    assert.equal(restored[stepKey], 5)
    assert.equal(restored[stageKey], 'survey')
    assert.deepEqual(restored.surveySnapshot, lastQuestion.surveySnapshot)
  }
})
