import { test } from 'node:test'
import assert from 'node:assert/strict'
import { districtOf } from './districtFromPoint.js'

// 각 구 내부의 대표 좌표 (구 중심 인근, 실제 링과 대조해 확정한 값)
const SAMPLES = {
  동구: { lat: 36.331, lng: 127.434 },   // 대전역 인근
  중구: { lat: 36.3277, lng: 127.4276 }, // 성심당 본점
  서구: { lat: 36.3515, lng: 127.3781 }, // 둔산동
  유성구: { lat: 36.362, lng: 127.356 }, // 유성 온천 인근
  대덕구: { lat: 36.428, lng: 127.415 }, // 오정동 인근
}

test('각 구 대표 좌표가 자기 구로 분류된다', () => {
  for (const [name, point] of Object.entries(SAMPLES)) {
    assert.equal(districtOf(point), name, `${name} 대표점이 ${districtOf(point)} 로 분류됨`)
  }
})

test('대전 경계 밖 좌표는 null', () => {
  assert.equal(districtOf({ lat: 37.5665, lng: 126.978 }), null) // 서울
})

test('좌표가 없거나 숫자가 아니면 null', () => {
  assert.equal(districtOf(null), null)
  assert.equal(districtOf(undefined), null)
  assert.equal(districtOf({ lat: undefined, lng: 127.4 }), null)
  assert.equal(districtOf({ lat: NaN, lng: NaN }), null)
})
