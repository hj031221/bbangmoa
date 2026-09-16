import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearestAttraction, resolveMapSelection, mapLocationNotice } from './mapPresentation.js'

// 예전엔 세 번째 인자(recommendationMode)가 있어 true면 bakeries[0]으로 폴백했다. 그 인자를
// 없애면서 테스트가 계속 세 번째 인자를 넘기고 있었다(리뷰 지적) — JS가 여분 인자를 조용히
// 무시해 초록불이었지만 시그니처와 어긋난 호출이라 정리한다.
test('추천 목록에서 없어진 선택을 다른 빵집으로 대체하지 않는다', () => {
  const bakeries = [{ id: 'a' }, { id: 'b' }]
  assert.equal(resolveMapSelection(bakeries, 'old'), null)
  assert.equal(resolveMapSelection(bakeries, 'b'), bakeries[1])
  assert.equal(resolveMapSelection(bakeries, null), null)
  assert.equal(resolveMapSelection([], 'old'), null)
  assert.equal(resolveMapSelection.length, 2) // 폴백 모드 인자가 다시 생기면 여기서 잡힌다
})
test('관광지 탐색은 잘못된 좌표를 제외하고 거리 상한을 지킨다', () => {
  const point = { lat: 36.33, lng: 127.43 }
  const spots = [{ name: 'invalid', lat: null, lng: 127.43 }, { name: 'far', lat: 36.5, lng: 127.43 }, { name: 'near', lat: 36.34, lng: 127.43 }]
  assert.equal(nearestAttraction(point, spots).name, 'near')
  assert.equal(nearestAttraction(point, spots, { maxKm: 0.5 }), null)
  assert.equal(nearestAttraction(null, spots), null)
})
test('위치 안내는 출발지를 우선하고 거부와 대전 밖 폴백을 알린다', () => {
  const bbox = { minLat: 36, maxLat: 37, minLng: 127, maxLng: 128 }
  assert.match(mapLocationNotice({ origin: { label: '대전역' }, status: 'denied', bbox }), /출발: 대전역/)
  assert.match(mapLocationNotice({ status: 'denied', bbox }), /허용되지.*역 기준/)
  assert.match(mapLocationNotice({ status: 'unsupported', bbox }), /지원하지.*역 기준/)
  assert.match(mapLocationNotice({ status: 'ready', coords: { lat: 38, lng: 127 }, bbox }), /대전 밖.*역 기준/)
  assert.match(mapLocationNotice({ status: 'ready', coords: { lat: 36.3, lng: 127.4 }, label: '중구', bbox }), /현재 위치.*중구/)
})
