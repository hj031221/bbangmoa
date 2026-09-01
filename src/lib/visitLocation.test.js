import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captureVisitLocation, VISIT_LOCATION_OPTIONS } from './visitLocation.js'

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
