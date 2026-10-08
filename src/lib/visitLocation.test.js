import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captureVisitLocation, VISIT_LOCATION_OPTIONS, resolveVisitLocation, VISIT_LOCATION_MAX_AGE_MS } from './visitLocation.js'

test('최근 측위만 재사용하고 측정 시각과 정확도는 서버 전송에서 제외한다', async () => {
  const coords = { lat: 36.3, lng: 127.4, accuracy: 10, timestamp: 99999 }
  const geo = { getCurrentPosition() { assert.fail('최근 좌표는 새 측위 불필요') } }
  assert.deepEqual(await resolveVisitLocation(coords, geo, 100000), { lat: 36.3, lng: 127.4 })
})

test('만료/시각 누락 좌표는 새로 측위하고 실패하면 이전 좌표로 인증하지 않는다', async () => {
  const now = 100000
  for (const timestamp of [undefined, now - VISIT_LOCATION_MAX_AGE_MS, now + 1]) {
    const coords = { lat: 36.3, lng: 127.4, timestamp }
    const success = { getCurrentPosition(ok) { ok({ coords: { latitude: 37, longitude: 128 } }) } }
    const failure = { getCurrentPosition(_ok, fail) { fail({ code: 2 }) } }
    assert.deepEqual(await resolveVisitLocation(coords, success, now), { lat: 37, lng: 128 })
    assert.equal(await resolveVisitLocation(coords, failure, now), null)
  }
})

test('지원하지 않는 환경은 null을 반환한다', async () => {
  assert.equal(await captureVisitLocation(null), null)
})

test('현재 위치와 8초 타임아웃 옵션을 사용한다', async () => {
  let receivedOptions
  const geolocation = {
    getCurrentPosition(success, _error, options) {
      receivedOptions = options
      success({ coords: { latitude: 36.35, longitude: 127.38 } })
    },
  }

  assert.deepEqual(await captureVisitLocation(geolocation), { lat: 36.35, lng: 127.38 })
  assert.deepEqual(receivedOptions, VISIT_LOCATION_OPTIONS)
  assert.equal(receivedOptions.timeout, 8000)
})

test('권한 거부나 잘못된 좌표는 null을 반환한다', async () => {
  const denied = {
    getCurrentPosition(_success, error) {
      error(new Error('denied'))
    },
  }
  const invalid = {
    getCurrentPosition(success) {
      success({ coords: { latitude: NaN, longitude: 127.38 } })
    },
  }

  assert.equal(await captureVisitLocation(denied), null)
  assert.equal(await captureVisitLocation(invalid), null)
})

test('위치 API가 동기적으로 실패해도 null을 반환한다', async () => {
  const broken = {
    getCurrentPosition() {
      throw new Error('broken')
    },
  }

  assert.equal(await captureVisitLocation(broken), null)
})
