import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VISIT_RADIUS_M, visitRadiusStatus, visitRadiusMessage } from './visitRadius.js'

const bakery = { lat: 36.3275, lng: 127.4273 }
// 위도 0.001도 ≈ 111m
const near = { lat: 36.3275 + 0.0009, lng: 127.4273, accuracy: 20 }
const far = { lat: 36.3275 + 0.003, lng: 127.4273, accuracy: 20 }

test('인증 반경은 서버와 같은 150m', () => {
  assert.equal(VISIT_RADIUS_M, 150)
})

test('좌표가 없으면 null', () => {
  assert.equal(visitRadiusStatus(null, bakery), null)
  assert.equal(visitRadiusStatus(near, { lat: null, lng: 127 }), null)
  assert.equal(visitRadiusMessage(null), null)
})

test('150m 안이면 inside', () => {
  const s = visitRadiusStatus(near, bakery)
  assert.equal(s.inside, true)
  assert.ok(s.distanceM > 90 && s.distanceM < 110)
  assert.equal(s.lowAccuracy, false)
  assert.equal(visitRadiusMessage(s), '인증 범위 안이에요 · 빵집까지 약 100m')
})

test('150m 밖이면 남은 거리를 알려준다', () => {
  const s = visitRadiusStatus(far, bakery)
  assert.equal(s.inside, false)
  // 약 334m - 150m ≈ 184m → 50m 단위 반올림
  assert.equal(visitRadiusMessage(s), '인증 범위까지 약 200m 남았어요')
})

test('정확도가 반경보다 나쁘면 경고를 붙인다', () => {
  const s = visitRadiusStatus({ ...near, accuracy: 500 }, bakery)
  assert.equal(s.lowAccuracy, true)
  assert.match(visitRadiusMessage(s), /정확도가 낮아/)
})
