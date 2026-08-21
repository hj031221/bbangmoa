import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getDisplayName } from './displayName.js'

test('getDisplayName: nickname 이 있으면 최우선', () => {
  const user = { user_metadata: { nickname: '장발장', full_name: 'Jean', name: 'JV' }, email: 'a@b.com' }
  assert.equal(getDisplayName(user), '장발장')
})

test('getDisplayName: nickname 없으면 full_name', () => {
  const user = { user_metadata: { full_name: 'Jean' }, email: 'a@b.com' }
  assert.equal(getDisplayName(user), 'Jean')
})

test('getDisplayName: full_name 없으면 name', () => {
  const user = { user_metadata: { name: 'JV' }, email: 'a@b.com' }
  assert.equal(getDisplayName(user), 'JV')
})

test('getDisplayName: metadata 없으면 email', () => {
  const user = { user_metadata: {}, email: 'a@b.com' }
  assert.equal(getDisplayName(user), 'a@b.com')
})

test('getDisplayName: 아무것도 없으면 기본값', () => {
  const user = { user_metadata: {} }
  assert.equal(getDisplayName(user), '내 계정')
})

test('getDisplayName: user 가 null 이면 null', () => {
  assert.equal(getDisplayName(null), null)
})
