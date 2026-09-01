import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BREAD_CANDIDATES, pickBreadStory } from './breadCandidates.js'

test('빵 15종 모두 stories(빵 이야기)를 3개씩 가진다', () => {
  assert.equal(BREAD_CANDIDATES.length, 15)
  for (const b of BREAD_CANDIDATES) {
    assert.ok(Array.isArray(b.stories), `${b.name}: stories 배열 아님`)
    assert.equal(b.stories.length, 3, `${b.name}: stories가 3개가 아님 (${b.stories.length})`)
    for (const s of b.stories) {
      assert.equal(typeof s, 'string', `${b.name}: story가 문자열 아님`)
      const len = s.trim().length
      assert.ok(len >= 10, `${b.name}: story가 너무 짧음 (${len}자): ${s}`)
      assert.ok(len <= 160, `${b.name}: story가 너무 김 (${len}자): ${s}`)
    }
  }
})

test('어떤 story도 그 빵의 description을 그대로 복사한 값이 아니다', () => {
  for (const b of BREAD_CANDIDATES) {
    for (const s of b.stories) {
      assert.notEqual(s.trim(), b.description.trim(), `${b.name}: story가 description과 동일`)
    }
  }
})

test('pickBreadStory는 그 빵의 stories 중 하나를 반환한다', () => {
  for (const b of BREAD_CANDIDATES) {
    const picked = pickBreadStory(b)
    assert.ok(b.stories.includes(picked), `${b.name}: 반환값이 stories에 없음`)
  }
})

test('pickBreadStory는 주입된 난수로 인덱스를 결정한다', () => {
  const bread = BREAD_CANDIDATES[0]
  assert.equal(pickBreadStory(bread, () => 0), bread.stories[0])
  assert.equal(pickBreadStory(bread, () => 0.999), bread.stories[2])
})

test('pickBreadStory는 stories가 없으면 null을 반환한다(방어)', () => {
  assert.equal(pickBreadStory({}), null)
  assert.equal(pickBreadStory({ stories: [] }), null)
  assert.equal(pickBreadStory(null), null)
})
