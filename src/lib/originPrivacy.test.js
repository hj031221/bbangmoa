import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeOriginForSave } from './originPrivacy.js'

const region = {
  center: { lat: 36.35, lng: 127.38 },
  label: '대전',
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

test('sanitizeOriginForSave: origin이 없으면 그대로 통과한다(null)', () => {
  assert.equal(sanitizeOriginForSave(null, region), null)
})

test('sanitizeOriginForSave: 프리셋이 비어있는 지역이면 GPS 원본 대신 region.center로 대체한다(fail-open 금지)', () => {
  const origin = { lat: 1, lng: 2, label: 'x', source: 'gps' }
  const result = sanitizeOriginForSave(origin, { center: region.center, label: '대전', origins: [] })
  assert.deepEqual(result, { lat: region.center.lat, lng: region.center.lng, label: '대전', source: 'preset' })
  assert.notEqual(result.lat, origin.lat)
})

test('sanitizeOriginForSave: region 자체가 없으면(도달 불가능한 예외) 원본을 내보내지 않고 null을 반환한다', () => {
  const origin = { lat: 1, lng: 2, label: 'x', source: 'gps' }
  assert.equal(sanitizeOriginForSave(origin, null), null)
  assert.equal(sanitizeOriginForSave(origin, {}), null)
})
