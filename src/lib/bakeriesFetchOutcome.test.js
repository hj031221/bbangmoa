import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveFetchOutcome } from './bakeriesFetchOutcome.js'

// PR #82 검증 발견 (P2) — 관광공사·카카오 요청이 모두 실패해도 이전엔 각각 .catch(()=>[])로
// 삼켜져 merged.length===0 인 "정상적인 0건"과 구분 없이 샘플 데이터로 조용히 대체됐다.
// resolveFetchOutcome이 Promise.allSettled 결과를 받아 error/sample/api 중 무엇으로 처리할지
// 결정하는 순수 로직이라 여기서 직접 검증한다.

const kakaoDoc = (id) => ({
  id,
  place_name: `빵집${id}`,
  road_address_name: '대전 중구',
  x: '127.4217',
  y: '36.3283',
  category_name: '음식점 > 카페 > 베이커리',
})

test('resolveFetchOutcome — 두 요청 모두 실패하면 error(샘플 폴백 아님)', () => {
  const tourResult = { status: 'rejected', reason: new Error('tour down') }
  const kakaoResult = { status: 'rejected', reason: new Error('kakao down') }
  const outcome = resolveFetchOutcome(tourResult, kakaoResult)
  assert.equal(outcome.status, 'error')
  assert.equal(outcome.error.message, 'tour down')
})

// 코드리뷰 발견 — 이 경우를 "둘 다 실패"와 같은 error로 묶으면, 관광공사 커버리지가 약한
// 지역(성공한 카카오 쪽이 정말 0건)에서 재시도 분기(useBakeries.js)를 못 타고 즉시 에러가
// 떴다. error는 두 요청이 모두 실패했을 때만 쓰고, 한쪽만 실패했으면 병합 결과가 0건이어도
// partial로 보내 재시도 기회를 준다.
test('resolveFetchOutcome — 한쪽만 실패하고 결과가 0건이면 partial(재시도 대상, error 아님)', () => {
  const tourResult = { status: 'rejected', reason: new Error('tour down') }
  const kakaoResult = { status: 'fulfilled', value: [] }
  const outcome = resolveFetchOutcome(tourResult, kakaoResult)
  assert.equal(outcome.status, 'partial')
  assert.equal(outcome.merged.length, 0)
})

test('resolveFetchOutcome — 둘 다 성공했는데 정말 0건이면 sample(에러 아님)', () => {
  const tourResult = { status: 'fulfilled', value: [] }
  const kakaoResult = { status: 'fulfilled', value: [] }
  const outcome = resolveFetchOutcome(tourResult, kakaoResult)
  assert.equal(outcome.status, 'sample')
})

// 이슈 #86: 예전엔 이 경우도 'api'(정상)로 취급해 "관광공사가 이번엔 빠졌다"는 사실이
// 삼켜졌다 — 같은 빵을 반복 요청해도 매칭 결과가 매번 달라지는 원인. 'api'와 구분되는
// 'partial'로 반환해 호출부가 캐시하지 않고 재시도할 여지를 남기게 한다.
test('resolveFetchOutcome — 한쪽이 실패해도 다른 쪽에 결과가 있으면 partial(캐시 금지 신호)', () => {
  const tourResult = { status: 'rejected', reason: new Error('tour down') }
  const kakaoResult = { status: 'fulfilled', value: [kakaoDoc('1')] }
  const outcome = resolveFetchOutcome(tourResult, kakaoResult)
  assert.equal(outcome.status, 'partial')
  assert.equal(outcome.merged.length, 1)
})

test('resolveFetchOutcome — 둘 다 성공하고 결과가 있으면 api', () => {
  const tourResult = { status: 'fulfilled', value: [] }
  const kakaoResult = { status: 'fulfilled', value: [kakaoDoc('2')] }
  const outcome = resolveFetchOutcome(tourResult, kakaoResult)
  assert.equal(outcome.status, 'api')
  assert.equal(outcome.merged.length, 1)
})
