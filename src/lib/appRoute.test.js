import test from 'node:test'
import assert from 'node:assert/strict'
import { getAppPath, getAppView } from './appRoute.js'

test('메뉴 경로를 새로고침용 화면 상태로 복원한다', () => {
  assert.equal(getAppView('/info'), 'info')
  assert.equal(getAppView('/bread-finder'), 'bread')
  assert.equal(getAppView('/bread-map'), 'map')
  assert.equal(getAppView('/tour'), 'tour')
  assert.equal(getAppView('/pilgrimage'), 'pilgrimage')
  assert.equal(getAppView('/mypage'), 'mypage')
})

test('후행 슬래시를 허용하고 알 수 없는 경로는 홈으로 보낸다', () => {
  assert.equal(getAppView('/bread-map/'), 'map')
  assert.equal(getAppView('/unknown'), 'home')
  assert.equal(getAppView(''), 'home')
})

test('화면 상태에 맞는 공개 경로를 반환한다', () => {
  assert.equal(getAppPath('home'), '/')
  assert.equal(getAppPath('mypage'), '/mypage')
  assert.equal(getAppPath('unknown'), '/')
})
