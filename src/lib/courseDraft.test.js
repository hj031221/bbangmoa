import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendCourseStops } from './courseDraft.js'

test('지도에서 담아도 기존 경유지와 수동 방문 순서를 보존한다', () => {
  const stops = [{ id: 'a' }, { id: 'b' }]
  const result = appendCourseStops(stops, ['b', 'a'], [{ id: 'c' }])
  assert.deepEqual(result.stops.map((s) => s.id), ['a', 'b', 'c'])
  assert.deepEqual(result.orderIds, ['b', 'a', 'c'])
  assert.equal(stops.length, 2)
})

test('반복 담기와 입력 내 중복은 경유지를 늘리지 않는다', () => {
  const result = appendCourseStops([{ id: 'a' }], null, [{ id: 'a' }, { id: 'b' }, { id: 'b' }])
  assert.deepEqual(result.stops.map((s) => s.id), ['a', 'b'])
  assert.deepEqual(result.orderIds, ['a', 'b'])
  assert.deepEqual(appendCourseStops([], null, [{ id: 'a' }]).orderIds, ['a'])
})
