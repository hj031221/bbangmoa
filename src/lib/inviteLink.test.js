import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildInviteLink,
  parseInviteCodeFromSearch,
  removeInviteCodeFromSearch,
} from './inviteLink.js'

test('buildInviteLink: origin + 코드로 초대 링크를 만든다', () => {
  assert.equal(
    buildInviteLink('https://bbangmoa.app', 'AB3D9F2K'),
    'https://bbangmoa.app/?friend=AB3D9F2K',
  )
})

test('parseInviteCodeFromSearch: friend 파라미터를 추출한다', () => {
  assert.equal(parseInviteCodeFromSearch('?friend=AB3D9F2K'), 'AB3D9F2K')
})

test('parseInviteCodeFromSearch: 파라미터가 없으면 null', () => {
  assert.equal(parseInviteCodeFromSearch(''), null)
  assert.equal(parseInviteCodeFromSearch('?other=1'), null)
})

test('removeInviteCodeFromSearch: friend 파라미터만 제거하고 나머지는 유지', () => {
  assert.equal(removeInviteCodeFromSearch('?friend=AB3D9F2K&x=1'), '?x=1')
})

test('removeInviteCodeFromSearch: 남는 파라미터가 없으면 빈 문자열', () => {
  assert.equal(removeInviteCodeFromSearch('?friend=AB3D9F2K'), '')
})
