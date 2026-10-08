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

test('경유지는 최대 6곳까지만 담기고 넘친 개수는 dropped로 알려준다', () => {
  const four = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
  const result = appendCourseStops(four, null, ['e', 'f', 'g', 'h'].map((id) => ({ id })))
  assert.deepEqual(result.stops.map((s) => s.id), ['a', 'b', 'c', 'd', 'e', 'f'])
  assert.deepEqual(result.orderIds, ['a', 'b', 'c', 'd', 'e', 'f'])
  assert.equal(result.dropped, 2)
})

test('이미 6곳이면 더 담지 않고, 중복은 dropped에 세지 않는다', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }))
  const full = appendCourseStops(six, null, [{ id: 'g' }])
  assert.equal(full.stops.length, 6)
  assert.equal(full.dropped, 1)
  assert.equal(appendCourseStops(six, null, [{ id: 'a' }]).dropped, 0)
})
