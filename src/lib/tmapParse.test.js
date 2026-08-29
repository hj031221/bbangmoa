import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePedestrianResponse } from './tmapParse.js'

// 아래 고정값(3560m/3038초, 구간 1244m/1020초 + 2316m/2018초)은 실제 TMAP API를 호출해
// 얻은 응답(경유지 1개, passList)에서 그대로 가져온 것 — 합계가 정확히 일치함을 실측으로 확인함.
function point(lng, lat, pointType, extra = {}) {
  return { geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { pointType, ...extra } }
}
function line(distance, time, coords) {
  return { geometry: { type: 'LineString', coordinates: coords }, properties: { distance, time } }
}

const realWaypointResponse = {
  features: [
    point(127.4276, 36.3277, 'SP', { totalDistance: 3560, totalTime: 3038 }),
    line(3, 2, [[127.4276, 36.3277], [127.4277, 36.3278]]),
    point(127.428, 36.328, 'GP'), // 안내점 — 구간 경계 아님
    line(1241, 1018, [[127.428, 36.328], [127.4295, 36.3345]]),
    point(127.43, 36.335, 'PP1'), // 경유지 — 여기서 구간1 닫힘
    line(2316, 2018, [[127.43, 36.335], [127.4348, 36.3505]]),
    point(127.4348, 36.3505, 'EP'),
  ],
}

test('parsePedestrianResponse: SP~PP1~EP 구간이 정확히 분리되고 합계가 헤더와 일치한다', () => {
  const result = parsePedestrianResponse(realWaypointResponse, 3) // origin + 경유1 + 도착 = 3지점
  assert.ok(result)
  assert.equal(result.totalDistance, 3560)
  assert.equal(result.totalTime, 3038)
  assert.equal(result.legs.length, 2)
  assert.equal(result.legs[0].distanceM, 1244)
  assert.equal(result.legs[0].timeS, 1020)
  assert.equal(result.legs[1].distanceM, 2316)
  assert.equal(result.legs[1].timeS, 2018)
  const sumD = result.legs.reduce((a, l) => a + l.distanceM, 0)
  const sumT = result.legs.reduce((a, l) => a + l.timeS, 0)
  assert.equal(sumD, result.totalDistance)
  assert.equal(sumT, result.totalTime)
})

test('parsePedestrianResponse: 경유지 없는 단순 A→B(SP~EP)도 구간 1개로 파싱된다', () => {
  const simple = {
    features: [
      point(127.0, 36.0, 'SP', { totalDistance: 500, totalTime: 400 }),
      line(500, 400, [[127.0, 36.0], [127.01, 36.01]]),
      point(127.01, 36.01, 'EP'),
    ],
  }
  const result = parsePedestrianResponse(simple, 2)
  assert.ok(result)
  assert.equal(result.legs.length, 1)
  assert.equal(result.legs[0].distanceM, 500)
})

test('parsePedestrianResponse: totalTime을 못 찾으면(SP 없음 등) null', () => {
  const broken = { features: [line(100, 100, [[127, 36], [127.01, 36.01]])] }
  assert.equal(parsePedestrianResponse(broken, 2), null)
})

test('parsePedestrianResponse: 구간 개수가 지점 개수와 안 맞으면 null(신뢰 안 함)', () => {
  // pointsCount=3(경유 1개)을 기대하는데 실제론 경유지가 없는 응답(구간 1개) — 불일치.
  const simple = {
    features: [
      point(127.0, 36.0, 'SP', { totalDistance: 500, totalTime: 400 }),
      line(500, 400, [[127.0, 36.0], [127.01, 36.01]]),
      point(127.01, 36.01, 'EP'),
    ],
  }
  assert.equal(parsePedestrianResponse(simple, 3), null)
})

test('parsePedestrianResponse: features가 비어있으면 null', () => {
  assert.equal(parsePedestrianResponse({ features: [] }, 2), null)
  assert.equal(parsePedestrianResponse(null, 2), null)
})
