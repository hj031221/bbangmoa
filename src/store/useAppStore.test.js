import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

// 실제 persist 미들웨어와 액션을 실행한다. 번들링은 앱의 확장자 없는 import를 Node에서 해석하기 위함.
test('설문 시각은 방문이 아니라 응답·다시하기에서 갱신되고 재방문에만 만료된다', async (t) => {
  let now = 200000000
  t.mock.method(Date, 'now', () => now)
  const memory = new Map()
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  } })
  t.after(() => {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else delete globalThis.localStorage
  })
  const result = await build({ entryPoints: ['src/store/useAppStore.js'], bundle: true, platform: 'node', format: 'esm', write: false })
  const { useAppStore: store } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))

  assert.equal(store.getState().surveyStartedAt, null)
  store.getState().selectBakery('bakery')
  assert.equal(JSON.parse(memory.get('bbangmoa-app-store')).state.surveyStartedAt, null)

  // 어제 9시 단순 방문 → 오늘 8:30 응답 → 9시 새로고침: 새 응답이 유지된다.
  now += 23.5 * 60 * 60 * 1000
  store.getState().setAnswer('q1', 'A')
  const answeredAt = now
  assert.equal(store.getState().surveyStartedAt, answeredAt)
  now += 30 * 60 * 1000
  await store.persist.rehydrate()
  assert.deepEqual(store.getState().answers, { q1: 'A' })
  assert.equal(store.getState().surveyStartedAt, answeredAt)

  for (const action of [
    () => store.getState().resetAnswers(),
    () => store.getState().setDirectBread('saltBread'),
    () => store.getState().resetTourAnswers(),
    () => store.getState().setTourAnswer('q1', 'B'),
  ]) {
    now += 1000
    action()
    assert.equal(store.getState().surveyStartedAt, now)
  }
  now += 24 * 60 * 60 * 1000
  // 마커 선택 등 설문과 무관한 조작은 화면의 답변을 지우거나 시각을 연장하지 않는다.
  store.getState().selectBakery('another')
  assert.deepEqual(store.getState().tourAnswers, { q1: 'B' })
  await store.persist.rehydrate()
  assert.deepEqual(store.getState().tourAnswers, {})
  assert.equal(store.getState().surveyStartedAt, null)
})
