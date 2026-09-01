import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DISTRICT_RINGS } from '../../data/daejeonDistricts.js'
import { STAMP_VIEWBOX, DISTRICT_PATHS, projectRing } from './daejeonStampPaths.js'

test('DISTRICT_PATHS 는 DISTRICT_RINGS 와 같은 구를 같은 순서로 담는다', () => {
  assert.deepEqual(
    DISTRICT_PATHS.map((p) => p.name),
    Object.keys(DISTRICT_RINGS),
  )
})

test('각 path d 는 M 으로 시작하고 Z 로 끝난다', () => {
  for (const { name, d } of DISTRICT_PATHS) {
    assert.match(d, /^M[-\d.]/, `${name}`)
    assert.ok(d.trim().endsWith('Z'), `${name}: Z 로 안 끝남`)
  }
})

test('모든 좌표가 유한하고 viewBox 범위 안에 있다', () => {
  const [, , w, h] = STAMP_VIEWBOX.split(' ').map(Number)
  assert.ok(w > 0 && h > 0)
  for (const { name, d } of DISTRICT_PATHS) {
    const nums = d.match(/-?\d+(\.\d+)?/g).map(Number)
    assert.ok(nums.length > 0 && nums.length % 2 === 0, `${name}: 좌표쌍 아님`)
    for (let i = 0; i < nums.length; i += 2) {
      const x = nums[i]
      const y = nums[i + 1]
      assert.ok(Number.isFinite(x) && x >= 0 && x <= w, `${name}: x=${x} 범위 밖`)
      assert.ok(Number.isFinite(y) && y >= 0 && y <= h, `${name}: y=${y} 범위 밖`)
    }
  }
})

test('각 구는 라벨 앵커 cx/cy 를 가지고 viewBox 범위 안에 있다', () => {
  const [, , w, h] = STAMP_VIEWBOX.split(' ').map(Number)
  for (const { name, cx, cy } of DISTRICT_PATHS) {
    assert.ok(Number.isFinite(cx) && cx >= 0 && cx <= w, `${name}: cx=${cx} 범위 밖`)
    assert.ok(Number.isFinite(cy) && cy >= 0 && cy <= h, `${name}: cy=${cy} 범위 밖`)
  }
})

test('projectRing 은 점 개수만큼 좌표쌍을 만든다', () => {
  const ring = DISTRICT_RINGS['중구']
  const d = projectRing(ring)
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number)
  assert.equal(nums.length, ring.length * 2)
})
