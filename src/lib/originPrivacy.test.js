import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeOriginForSave } from './originPrivacy.js'

const region = {
  origins: [
    { id: 'a', name: 'A역', lat: 36.0, lng: 127.0 },
    { id: 'b', name: 'B역', lat: 36.1, lng: 127.1 },
  ],
}

test('sanitizeOriginForSave: gps 출처는 가장 가까운 프리셋으로 치환된다', () => {
  const origin = { lat: 36.001, lng: 127.001, label: '현재 위치', source: 'gps' }
  const result = sanitizeOriginForSave(origin, region)
  assert.deepEqual(result, { lat: 36.0, lng: 127.0, label: 'A역', source: 'preset' })
})

test('sanitizeOriginForSave: preset/pick/search 출처는 그대로 통과한다', () => {
  for (const source of ['preset', 'pick', 'search']) {
    const origin = { lat: 1, lng: 2, label: 'x', source }
    assert.equal(sanitizeOriginForSave(origin, region), origin)
  }
})

test('sanitizeOriginForSave: origin이나 프리셋이 없으면 그대로 통과한다', () => {
  assert.equal(sanitizeOriginForSave(null, region), null)
  const origin = { lat: 1, lng: 2, label: 'x', source: 'gps' }
  assert.equal(sanitizeOriginForSave(origin, { origins: [] }), origin)
  assert.equal(sanitizeOriginForSave(origin, null), origin)
})
