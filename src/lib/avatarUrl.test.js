import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getAvatarUrl } from './avatarUrl.js'

test('getAvatarUrl: user_metadata.avatar_url 이 최우선', () => {
  const user = { user_metadata: { avatar_url: 'https://x/a.jpg' }, avatar_url: 'https://x/b.jpg' }
  assert.equal(getAvatarUrl(user), 'https://x/a.jpg')
})

test('getAvatarUrl: user_metadata 없으면 최상위 avatar_url (친구 entry)', () => {
  assert.equal(getAvatarUrl({ avatar_url: 'https://x/b.jpg' }), 'https://x/b.jpg')
})

test('getAvatarUrl: user_metadata.avatar_url 이 빈 문자열이면 폴백', () => {
  const user = { user_metadata: { avatar_url: '' }, avatar_url: 'https://x/b.jpg' }
  assert.equal(getAvatarUrl(user), 'https://x/b.jpg')
})

test('getAvatarUrl: 아무 값도 없으면 null', () => {
  assert.equal(getAvatarUrl({ user_metadata: {} }), null)
})

test('getAvatarUrl: 인자가 null 이면 null', () => {
  assert.equal(getAvatarUrl(null), null)
})
