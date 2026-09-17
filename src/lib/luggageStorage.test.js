import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearestLockers } from './luggageStorage.js'

// 대전역 근처를 기준점으로, 거리 순서가 자명하도록 위도만 조금씩 벌려 놓은 픽스처.
const DAEJEON_STATION = { lat: 36.3324, lng: 127.4347 }
const FIXTURE = [
  { id: 'near', name: '가까운 보관함', lat: 36.335, lng: 127.4347 }, // ~0.3km
  { id: 'mid', name: '중간 보관함', lat: 36.35, lng: 127.4347 }, // ~2km
  { id: 'far', name: '먼 보관함', lat: 36.42, lng: 127.4347 }, // ~10km
  { id: 'nocoord', name: '좌표 없는 보관함', lat: null, lng: 127.4347 },
]

test('nearestLockers: 기준점에서 가까운 순으로 정렬하고 km 를 붙인다', () => {
  const out = nearestLockers(DAEJEON_STATION, { lockers: FIXTURE, maxKm: Infinity })
  assert.deepEqual(
    out.map((l) => l.id),
    ['near', 'mid', 'far'],
  )
  assert.ok(out[0].km < out[1].km && out[1].km < out[2].km)
  assert.ok(Number.isFinite(out[0].km))
})

test('nearestLockers: limit 만큼만 반환한다 (기본 3)', () => {
  const out = nearestLockers(DAEJEON_STATION, { lockers: FIXTURE, limit: 2, maxKm: Infinity })
  assert.equal(out.length, 2)
  assert.deepEqual(out.map((l) => l.id), ['near', 'mid'])
})

test('nearestLockers: maxKm 밖의 보관함은 제외한다', () => {
  const out = nearestLockers(DAEJEON_STATION, { lockers: FIXTURE, maxKm: 5 })
  assert.deepEqual(out.map((l) => l.id), ['near', 'mid'])
})

test('nearestLockers: 좌표 없는 보관함은 건너뛴다', () => {
  const out = nearestLockers(DAEJEON_STATION, { lockers: FIXTURE, maxKm: Infinity })
  assert.ok(!out.some((l) => l.id === 'nocoord'))
})

test('nearestLockers: 기준점 좌표가 유효하지 않으면 빈 배열', () => {
  assert.deepEqual(nearestLockers(null, { lockers: FIXTURE }), [])
  assert.deepEqual(nearestLockers({ lat: null, lng: 1 }, { lockers: FIXTURE }), [])
})

test('nearestLockers: 기본 반경은 5km로 6km 거리의 보관소를 제외한다', () => {
  const lockers = [...FIXTURE, { id: 'six-km', lat: DAEJEON_STATION.lat + 0.054, lng: DAEJEON_STATION.lng }]
  const out = nearestLockers(DAEJEON_STATION, { lockers })
  assert.deepEqual(out.map((l) => l.id), ['near', 'mid'])
})
