import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roundToSum } from './rounding.js'

// 리뷰 발견: 대전한바퀴 구간별 시간을 각자 반올림하면 합이 헤더 총계와 어긋나던 실제 버그
// (11+11+11=33분인데 헤더는 32분)가 있었음 — 그 정확한 형태를 회귀 테스트로 고정한다.
test('roundToSum: 각자 반올림하면 어긋나는 값도 targetSum에 정확히 맞춘다', () => {
  // 10.6+10.6+10.6=31.8 → Math.round=32, 그런데 각자 반올림하면 11*3=33이 되는 사례
  const result = roundToSum([10.6, 10.6, 10.6], 32)
  assert.equal(
    result.reduce((a, b) => a + b, 0),
    32,
  )
  assert.equal(result.length, 3)
})

test('roundToSum: 나머지가 큰 항목부터 하나씩 올림해서 합을 맞춘다', () => {
  // floor: 1,1,1=3, target 5 → 나머지 2개를 나머지가 큰 순서(0.9, 0.8)로 배분, 0.1은 탈락
  assert.deepEqual(roundToSum([1.9, 1.8, 1.1], 5), [2, 2, 1])
})

test('roundToSum: 이미 정수라 나머지가 없으면 그대로', () => {
  assert.deepEqual(roundToSum([5, 5, 5], 15), [5, 5, 5])
})

test('roundToSum: 값이 하나뿐이면 그 값이 targetSum이 된다', () => {
  assert.deepEqual(roundToSum([7.3], 7), [7])
})

test('roundToSum: 빈 배열이면 빈 배열', () => {
  assert.deepEqual(roundToSum([], 0), [])
})
