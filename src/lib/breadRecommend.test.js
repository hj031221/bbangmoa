import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBreadById } from '../data/breadCandidates.js'
import { matchBakeriesGrouped } from './breadRecommend.js'

// 큐레이션(bakeryBreadMenu.js)에서 확인된 실제 이름들:
//   도넛  → 이상화베이커리, 크리베리, 로삐아노
//   소금빵 → 레시피, 에코브레드하우스, 보보로베이커리, 토우베이크하우스, 시나몬 ...
const b = (name, extra = {}) => ({ id: name, name, category: '', ...extra })

test('matchBakeriesGrouped: bread 없으면 빈 그룹', () => {
  assert.deepEqual(matchBakeriesGrouped([b('아무빵집')], null), { confirmed: [], possible: [] })
})

test('matchBakeriesGrouped: 확인된 곳 >= minConfirmed 면 가능성 있는 곳은 버린다', () => {
  const donut = getBreadById('donut')
  const bakeries = [
    b('이상화베이커리'),
    b('크리베리'),
    b('로삐아노'),
    b('행복 도너츠'), // keyword('도너츠') 매칭이지만 확인된 곳이 이미 3곳
  ]
  const { confirmed, possible } = matchBakeriesGrouped(bakeries, donut, { minConfirmed: 3 })
  assert.deepEqual(confirmed.map((x) => x.name), ['이상화베이커리', '크리베리', '로삐아노'])
  assert.deepEqual(possible, [])
})

test('matchBakeriesGrouped: 확인된 곳 < minConfirmed 면 가능성 있는 곳으로 채운다', () => {
  const donut = getBreadById('donut')
  const bakeries = [b('이상화베이커리'), b('크리베리'), b('도넛나라'), b('수제 도너츠집')]
  const { confirmed, possible } = matchBakeriesGrouped(bakeries, donut, { minConfirmed: 3 })
  assert.deepEqual(confirmed.map((x) => x.name), ['이상화베이커리', '크리베리'])
  assert.deepEqual(possible.map((x) => x.name), ['도넛나라', '수제 도너츠집'])
})

test('matchBakeriesGrouped: 확인된 곳 0 이면 전부 가능성 있는 곳', () => {
  const donut = getBreadById('donut')
  const bakeries = [b('도넛나라'), b('수제 도너츠집'), b('상관없는집')]
  const { confirmed, possible } = matchBakeriesGrouped(bakeries, donut, { minConfirmed: 3 })
  assert.deepEqual(confirmed, [])
  assert.deepEqual(possible.map((x) => x.name), ['도넛나라', '수제 도너츠집'])
})

test('matchBakeriesGrouped: confirmed + possible 합계는 limit 를 넘지 않는다', () => {
  const salt = getBreadById('saltBread')
  const confirmedNames = ['레시피', '에코브레드하우스', '보보로베이커리', '토우베이크하우스', '시나몬']
  const { confirmed, possible } = matchBakeriesGrouped(
    confirmedNames.map((n) => b(n)),
    salt,
    { limit: 3, minConfirmed: 3 },
  )
  assert.equal(confirmed.length, 3)
  assert.deepEqual(possible, [])
})

test('matchBakeriesGrouped: 확인된 곳이 limit 보다 적고 minConfirmed 미만이면 possible 로 limit 까지만', () => {
  const donut = getBreadById('donut')
  const bakeries = [b('이상화베이커리'), b('도넛1'), b('도넛2'), b('도넛3'), b('도넛4')]
  const { confirmed, possible } = matchBakeriesGrouped(bakeries, donut, { limit: 3, minConfirmed: 3 })
  assert.deepEqual(confirmed.map((x) => x.name), ['이상화베이커리'])
  assert.deepEqual(possible.map((x) => x.name), ['도넛1', '도넛2'])
})
