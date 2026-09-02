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

// 소스 주석은 "DISTRICT_RINGS 삽입 순서로 순회하며 첫 번째로 포함하는 구를 반환한다
// (경계 공유 시 결정적)"고 보장한다. visitStamps.js 의 구별 카운트가 이 결정성에 의존한다.
// 아래 좌표는 여러 구 링이 실제로 공유하는 꼭짓점이라, 경계에서의 홀짝 판정이 링마다
// 갈린다(공유점이라도 어떤 링은 '안', 어떤 링은 '밖'으로 본다). 현재 분류 결과를 그대로
// 고정해, DISTRICT_RINGS 순서 변경이나 pointInRing 변경으로 귀속이 뒤집히면 잡히게 한다.
test('경계 공유 꼭짓점의 구 귀속이 결정적으로 유지된다', () => {
  const SHARED = [
    { point: { lat: 36.29774, lng: 127.45798 }, expect: '동구' }, // 동구·중구
    { point: { lat: 36.34076, lng: 127.4149 }, expect: '동구' }, // 동구·중구·대덕구
    { point: { lat: 36.26923, lng: 127.37453 }, expect: '중구' }, // 중구·서구
    { point: { lat: 36.34691, lng: 127.3512 }, expect: '서구' }, // 서구·유성구
    { point: { lat: 36.34715, lng: 127.40503 }, expect: '대덕구' }, // 중구·서구·유성구·대덕구
    { point: { lat: 36.36974, lng: 127.39712 }, expect: '대덕구' }, // 서구·유성구·대덕구
  ]
  for (const { point, expect } of SHARED) {
    assert.equal(districtOf(point), expect, `(${point.lat},${point.lng}) → ${districtOf(point)}`)
  }
})
