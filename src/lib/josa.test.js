import test from 'node:test'
import assert from 'node:assert/strict'
import { hasBatchim, josa } from './josa.js'
import { BREAD_CANDIDATES } from '../data/breadCandidates.js'

test('받침 유무를 판별한다', () => {
  assert.equal(hasBatchim('식빵'), true)
  assert.equal(hasBatchim('치아바타'), false)
  assert.equal(hasBatchim('스콘'), true)
  assert.equal(hasBatchim('케이크'), false)
  assert.equal(hasBatchim('bagel'), false)
  assert.equal(hasBatchim(''), false)
  assert.equal(hasBatchim(undefined), false)
})

test('"이에요/예요"를 빵 이름에 맞게 고른다', () => {
  const ending = (name) => josa(name, '이에요', '예요')
  assert.equal(ending('식빵'), '이에요')
  assert.equal(ending('치아바타'), '예요')
  assert.equal(ending('에그타르트'), '예요')
  assert.equal(ending('단팥빵'), '이에요')
  for (const bread of BREAD_CANDIDATES) assert.ok(['이에요', '예요'].includes(ending(bread.name)), bread.name)
})
