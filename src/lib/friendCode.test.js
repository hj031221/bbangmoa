import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFriendCode, isValidFriendCode } from './friendCode.js'

test('normalizeFriendCode: 소문자를 대문자로 바꾼다', () => {
  assert.equal(normalizeFriendCode('ab3d9f2k'), 'AB3D9F2K')
})

test('normalizeFriendCode: 공백/대시를 제거한다', () => {
  assert.equal(normalizeFriendCode(' AB3D-9F2K '), 'AB3D9F2K')
})

test('normalizeFriendCode: null/undefined 는 빈 문자열', () => {
  assert.equal(normalizeFriendCode(null), '')
  assert.equal(normalizeFriendCode(undefined), '')
})

test('isValidFriendCode: 정상 8자리 코드는 true', () => {
  assert.equal(isValidFriendCode('AB3D9F2K'), true)
})

test('isValidFriendCode: 길이가 다르면 false', () => {
  assert.equal(isValidFriendCode('AB3D9F2'), false)
  assert.equal(isValidFriendCode('AB3D9F2KX'), false)
})

test('isValidFriendCode: 제외 문자(0/O/1/I) 포함 시 false', () => {
  assert.equal(isValidFriendCode('AB3D9O2K'), false)
  assert.equal(isValidFriendCode('AB3D9012'), false)
})
