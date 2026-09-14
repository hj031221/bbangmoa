import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LUGGAGE_STORAGE } from './luggageStorage.js'
import { hasValidCoords, isWithinBbox } from '../lib/distance.js'
import { isOpenNow } from '../lib/hours.js'

// 대전 대략 bbox — 모든 보관함은 대전 안에 있어야 한다(좌표 오타 방어).
const DAEJEON_BBOX = { minLat: 36.18, maxLat: 36.5, minLng: 127.25, maxLng: 127.56 }
const TYPES = new Set(['subway', 'station', 'tourist'])

test('모든 항목이 대전 경계 안의 유효 좌표를 가진다', () => {
  for (const l of LUGGAGE_STORAGE) {
    assert.ok(hasValidCoords(l), `${l.id}: 좌표 무효`)
    assert.ok(isWithinBbox(l, DAEJEON_BBOX), `${l.id}: 대전 밖 좌표 (${l.lat}, ${l.lng})`)
  }
})

test('id는 고유하고, type/coordAccuracy는 허용값이다', () => {
  const ids = LUGGAGE_STORAGE.map((l) => l.id)
  assert.equal(new Set(ids).size, ids.length, 'id 중복')
  for (const l of LUGGAGE_STORAGE) {
    assert.ok(TYPES.has(l.type), `${l.id}: 알 수 없는 type ${l.type}`)
    assert.ok(['exact', 'approx'].includes(l.coordAccuracy), `${l.id}: coordAccuracy ${l.coordAccuracy}`)
    assert.ok(l.name && l.fee, `${l.id}: name/fee 누락`)
  }
})

test('hours가 있으면 isOpenNow가 판단 가능한 형식이다', () => {
  for (const l of LUGGAGE_STORAGE) {
    if (!l.hours) continue
    assert.equal(typeof isOpenNow(l.hours), 'boolean', `${l.id}: hours 파싱 불가`)
  }
})
