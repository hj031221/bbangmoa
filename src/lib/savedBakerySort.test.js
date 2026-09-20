import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortSavedBakeries } from './savedBakerySort.js'

test('찜 목록은 빵집 이름 가나다순이며 원본 저장 순서를 변경하지 않는다', () => {
  const saved = [{ id: 'z', name: '하늘빵' }, { id: 'b', name: '나무빵' }, { id: 'a', name: '가온빵' }]
  assert.deepEqual(sortSavedBakeries(saved).map((b) => b.id), ['a', 'b', 'z'])
  assert.deepEqual(saved.map((b) => b.id), ['z', 'b', 'a'])
})

test('같은 이름은 빵 종류와 ID로 비교해 조회 순서가 달라도 순서가 일정하다', () => {
  const saved = [{ id: '2', name: '가온빵', breadType: '소금빵' }, { id: '1', name: '가온빵', breadType: '소금빵' }, { id: '3', name: '가온빵', breadType: '단팥빵' }]
  assert.deepEqual(sortSavedBakeries(saved), sortSavedBakeries([...saved].reverse()))
  assert.deepEqual(sortSavedBakeries(saved).map((b) => b.id), ['3', '1', '2'])
})
