import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineKm, pathLengthKm, midpointOf } from './distance.js'

// 리뷰 발견: 이 PR이 새로 만든 순수함수들(midpointOf, 구간 거리 배분에 쓰는 haversine 기반
// 길이 계산)이 테스트 0개였음.

test('midpointOf: 2점(직선 폴백)이면 실제 좌표 중점을 계산한다', () => {
  // 예전 버그: points[Math.floor(2/2)] = points[1] = 끝점을 그대로 골라서, 하이라이트 라벨이
  // 중점이 아니라 목적지 핀 위에 겹쳐 그려졌음.
  const a = { lat: 36.0, lng: 127.0 }
  const b = { lat: 36.2, lng: 127.4 }
  assert.deepEqual(midpointOf([a, b]), { lat: 36.1, lng: 127.2 })
})

test('midpointOf: 점이 1개면 그 점 그대로', () => {
  const a = { lat: 36.0, lng: 127.0 }
  assert.deepEqual(midpointOf([a]), a)
})

test('midpointOf: 홀수 개면 가운데 점을 그대로 고른다', () => {
  const a = { lat: 36.0, lng: 127.0 }
  const b = { lat: 36.1, lng: 127.1 }
  const c = { lat: 36.2, lng: 127.2 }
  assert.deepEqual(midpointOf([a, b, c]), b)
})

test('midpointOf: 짝수 개(4점)면 가운데 두 점의 평균', () => {
  const points = [
    { lat: 36.0, lng: 127.0 },
    { lat: 36.1, lng: 127.1 },
    { lat: 36.3, lng: 127.3 },
    { lat: 36.4, lng: 127.4 },
  ]
  const mid = midpointOf(points)
  // 부동소수점 연산 오차(0.1+0.3 등)가 있을 수 있어 근사 비교
  assert.ok(Math.abs(mid.lat - 36.2) < 1e-9)
  assert.ok(Math.abs(mid.lng - 127.2) < 1e-9)
})

test('pathLengthKm: 좌표가 1개 이하면 길이 0', () => {
  assert.equal(pathLengthKm([]), 0)
  assert.equal(pathLengthKm([{ lat: 36.0, lng: 127.0 }]), 0)
})

test('pathLengthKm: 여러 점을 이은 폴리라인 길이는 각 구간 haversine의 합과 같다', () => {
  // 리뷰 발견: 예전엔 이 자리에서 "꼭짓점 개수"를 가중치로 썼는데, 꼭짓점 개수는 실제 거리와
  // 무관하다(직선 고속도로 구간은 꼭짓점이 적고, 짧고 구불구불한 구간은 많다) — 실제 좌표 길이로
  // 교체했으니, 그 값이 구간별 haversine 합과 정확히 같은지 확인한다.
  const a = { lat: 36.0, lng: 127.0 }
  const b = { lat: 36.1, lng: 127.1 }
  const c = { lat: 36.2, lng: 127.0 }
  const expected = haversineKm(a, b) + haversineKm(b, c)
  assert.equal(pathLengthKm([a, b, c]), expected)
})

test('pathLengthKm: 여러 꼭짓점을 지나는 구불구불한 구간이 꼭짓점 적은 직선 구간보다 항상 긴 건 아니다', () => {
  // "꼭짓점 개수 ≠ 거리"라는 이번 수정의 핵심 근거를 직접 확인 — 꼭짓점 2개짜리 긴 직선이,
  // 꼭짓점 5개짜리 짧게 꼬불꼬불한 구간보다 실제로 더 길 수 있다.
  const longStraight = [
    { lat: 36.0, lng: 127.0 },
    { lat: 36.5, lng: 127.5 },
  ]
  const shortWiggly = [
    { lat: 36.0, lng: 127.0 },
    { lat: 36.001, lng: 127.001 },
    { lat: 36.0, lng: 127.002 },
    { lat: 36.001, lng: 127.003 },
    { lat: 36.0, lng: 127.004 },
  ]
  assert.ok(pathLengthKm(longStraight) > pathLengthKm(shortWiggly))
})
