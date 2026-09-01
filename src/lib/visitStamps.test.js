import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeVisitStamps } from './visitStamps.js'

// 중구 안 좌표 (Task 1 테스트에서 검증된 값)
const JUNG = { lat: 36.3277, lng: 127.4276 }
const SEO = { lat: 36.3515, lng: 127.3781 }

function entry(id, coords) {
  return { bakery_id: id, bakery: { id, lat: coords?.lat, lng: coords?.lng } }
}

test('빈 입력 — 5개 구 전부 0, overallPct 0, conqueredCount 0', () => {
  const r = computeVisitStamps([])
  assert.equal(r.perDistrict.length, 5)
  assert.deepEqual(r.perDistrict.map((d) => d.name), ['동구', '중구', '서구', '유성구', '대덕구'])
  assert.ok(r.perDistrict.every((d) => d.count === 0 && d.pct === 0))
  assert.equal(r.overallPct, 0)
  assert.equal(r.conqueredCount, 0)
})

test('null/undefined 입력도 빈 입력처럼 처리', () => {
  assert.equal(computeVisitStamps(null).overallPct, 0)
  assert.equal(computeVisitStamps(undefined).conqueredCount, 0)
})

test('한 구에 서로 다른 빵집 4곳 → 그 구 count 4, pct 100, 정복', () => {
  const r = computeVisitStamps([
    entry('b1', JUNG), entry('b2', JUNG), entry('b3', JUNG), entry('b4', JUNG),
  ])
  const jung = r.perDistrict.find((d) => d.name === '중구')
  assert.equal(jung.count, 4)
  assert.equal(jung.pct, 100)
  assert.equal(r.conqueredCount, 1)
  assert.equal(r.overallPct, 20) // 100 + 0*4 = 100 / 5
})

test('같은 빵집 3번 기록 → count 1, pct 33 (중복 제거)', () => {
  const r = computeVisitStamps([entry('b1', JUNG), entry('b1', JUNG), entry('b1', JUNG)])
  const jung = r.perDistrict.find((d) => d.name === '중구')
  assert.equal(jung.count, 1)
  assert.equal(jung.pct, 33)
  assert.equal(r.conqueredCount, 0)
})

test('좌표 없는 기록 / 경계 밖 기록은 제외, 분모는 항상 5', () => {
  const r = computeVisitStamps([
    entry('b1', JUNG),
    entry('b2', null),                       // 좌표 없음
    entry('b3', { lat: 37.5665, lng: 126.978 }), // 서울 (경계 밖)
  ])
  assert.equal(r.perDistrict.find((d) => d.name === '중구').count, 1)
  const total = r.perDistrict.reduce((s, d) => s + d.count, 0)
  assert.equal(total, 1) // b2, b3 는 어느 count 에도 안 잡힘
})

test('두 구에 각 3곳 → 두 구 정복, overallPct 40', () => {
  const r = computeVisitStamps([
    entry('a1', JUNG), entry('a2', JUNG), entry('a3', JUNG),
    entry('c1', SEO), entry('c2', SEO), entry('c3', SEO),
  ])
  assert.equal(r.conqueredCount, 2)
  assert.equal(r.overallPct, 40) // (100 + 100 + 0 + 0 + 0) / 5
})
