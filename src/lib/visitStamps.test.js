import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeVisitStamps } from './visitStamps.js'

const JUNG = { lat: 36.3277, lng: 127.4276 } // 중구
const SEO = { lat: 36.3515, lng: 127.3781 }  // 서구
const DONG = { lat: 36.331, lng: 127.434 }   // 동구

function entry(id, coords, extra) {
  return { bakery_id: id, bakery: { id, lat: coords?.lat, lng: coords?.lng }, ...extra }
}

const byName = (r, name) => r.perDistrict.find((d) => d.name === name)

test('빈 입력, 기본 목표 3', () => {
  const r = computeVisitStamps([])
  assert.deepEqual(r.perDistrict.map((d) => d.name), ['동구', '중구', '서구', '유성구', '대덕구'])
  assert.ok(r.perDistrict.every((d) => d.count === 0 && d.completedSlots === 0 && d.goalPct === 0 && d.completed === false && d.target === 3))
  assert.equal(r.visitedBakeryCount, 0)
  assert.equal(r.completedSlots, 0)
  assert.equal(r.totalSlots, 15)
  assert.equal(r.goalPct, 0)
  assert.equal(r.completedDistrictCount, 0)
})

test('null / undefined 입력도 빈 입력과 동일', () => {
  assert.equal(computeVisitStamps(null).totalSlots, 15)
  assert.equal(computeVisitStamps(undefined).goalPct, 0)
})

test('목표 3, 한 구 서로 다른 빵집 4곳 → completedSlots 3, goalPct 100, completed', () => {
  const r = computeVisitStamps([entry('a', JUNG), entry('b', JUNG), entry('c', JUNG), entry('d', JUNG)])
  const j = byName(r, '중구')
  assert.equal(j.count, 4)
  assert.equal(j.completedSlots, 3)
  assert.equal(j.goalPct, 100)
  assert.equal(j.completed, true)
  assert.equal(r.visitedBakeryCount, 4)
  assert.equal(r.completedSlots, 3)
  assert.equal(r.totalSlots, 15)
  assert.equal(r.goalPct, 20) // 3/15
  assert.equal(r.completedDistrictCount, 1)
})

test('같은 빵집 3번 (목표 3) → count 1, completedSlots 1, goalPct 33, 미완료', () => {
  const r = computeVisitStamps([entry('x', JUNG), entry('x', JUNG), entry('x', JUNG)])
  const j = byName(r, '중구')
  assert.equal(j.count, 1)
  assert.equal(j.completedSlots, 1)
  assert.equal(j.goalPct, 33)
  assert.equal(j.completed, false)
})

test('좌표 없는 / 대전 밖 기록은 count·visitedBakeryCount 에서 제외', () => {
  const r = computeVisitStamps([
    entry('a', JUNG),
    entry('b', null),
    entry('c', { lat: 37.5665, lng: 126.978 }), // 서울
  ])
  assert.equal(byName(r, '중구').count, 1)
  assert.equal(r.visitedBakeryCount, 1)
})

test('스펙 예제: 목표 5, 중구 5곳·서구 3곳·동구 2곳', () => {
  const es = [
    ...['j1', 'j2', 'j3', 'j4', 'j5'].map((id) => entry(id, JUNG)),
    ...['s1', 's2', 's3'].map((id) => entry(id, SEO)),
    ...['d1', 'd2'].map((id) => entry(id, DONG)),
  ]
  const r = computeVisitStamps(es, { targetPerDistrict: 5 })
  assert.deepEqual(
    [byName(r, '중구'), byName(r, '서구'), byName(r, '동구')].map((d) => [d.completedSlots, d.goalPct, d.completed]),
    [[5, 100, true], [3, 60, false], [2, 40, false]],
  )
  assert.equal(r.visitedBakeryCount, 10)
  assert.equal(r.completedSlots, 10)
  assert.equal(r.totalSlots, 25)
  assert.equal(r.goalPct, 40)
  assert.equal(r.completedDistrictCount, 1)
})

test('targetPerDistrict 클램프: 0→1, 100→20, 2.6→3', () => {
  assert.equal(computeVisitStamps([], { targetPerDistrict: 0 }).perDistrict[0].target, 1)
  assert.equal(computeVisitStamps([], { targetPerDistrict: 100 }).totalSlots, 100)
  assert.equal(computeVisitStamps([], { targetPerDistrict: 2.6 }).perDistrict[0].target, 3)
})

test('goalPct 100 상한', () => {
  // 목표 1, 다섯 구 모두 2곳씩 → completedSlots 5 / totalSlots 5
  const es = [JUNG, SEO, DONG, { lat: 36.362, lng: 127.356 } /*유성*/, { lat: 36.428, lng: 127.415 } /*대덕*/]
    .flatMap((c, i) => [entry(`${i}a`, c), entry(`${i}b`, c)])
  const r = computeVisitStamps(es, { targetPerDistrict: 1 })
  assert.equal(r.completedSlots, 5)
  assert.equal(r.totalSlots, 5)
  assert.equal(r.goalPct, 100)
  assert.equal(r.completedDistrictCount, 5)
})

test('verifiedOnly: verified 없는 기록은 제외, verified:true 만 포함', () => {
  const mixed = [entry('a', JUNG), entry('b', JUNG, { verified: true })]
  assert.equal(computeVisitStamps(mixed, { verifiedOnly: true }).visitedBakeryCount, 1)
  assert.equal(computeVisitStamps(mixed, { verifiedOnly: true }).perDistrict.find((d) => d.name === '중구').count, 1)
  assert.equal(computeVisitStamps(mixed, { verifiedOnly: false }).visitedBakeryCount, 2)
})
