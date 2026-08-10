import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAGGED_ATTRACTIONS, getAttractionById } from './tourAttractionTags.js'
import { THEMES, TRAIT_TAGS } from './tourSurveyConfig.js'

test('모든 태깅된 관광지는 1개 이상의 유효한 테마를 가진다', () => {
  assert.ok(TAGGED_ATTRACTIONS.length > 100)
  for (const a of TAGGED_ATTRACTIONS) {
    assert.ok(a.themes.length > 0, `${a.name}: themes 비어있음`)
    for (const t of a.themes) assert.ok(THEMES.includes(t), `${a.name}: 잘못된 테마 "${t}"`)
  }
})

test('모든 태깅된 관광지는 5개 구 중 하나에 속한다', () => {
  const districts = ['동구', '중구', '서구', '유성구', '대덕구']
  for (const a of TAGGED_ATTRACTIONS) {
    assert.ok(districts.includes(a.district), `${a.name}: district=${a.district}`)
  }
})

test('trait 벡터는 0~5 범위이며 전부 0인 벡터는 없다', () => {
  for (const a of TAGGED_ATTRACTIONS) {
    let sum = 0
    for (const tag of TRAIT_TAGS) {
      const v = a.traits[tag]
      assert.ok(v >= 0 && v <= 5, `${a.name}: ${tag}=${v}`)
      sum += v
    }
    assert.ok(sum > 0, `${a.name}: trait 벡터 전부 0`)
  }
})

test('동행 적합도는 0~100 범위다', () => {
  for (const a of TAGGED_ATTRACTIONS) {
    for (const key of ['solo', 'couple', 'friends', 'childrenFamily', 'parentsFamily']) {
      const v = a.companion[key]
      assert.ok(v >= 0 && v <= 100, `${a.name}: ${key}=${v}`)
    }
  }
})

test('뿌리공원(cat=A02020700, 공원류)은 자연 테마로 분류된다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '뿌리공원')
  assert.ok(site, '뿌리공원을 찾을 수 없음')
  assert.ok(site.themes.includes('nature'))
})

test('이응노 미술관(cat=A02060500)은 문화 테마로 분류된다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '이응노 미술관')
  assert.ok(site)
  assert.ok(site.themes.includes('culture'))
})

test('한밭교육박물관(cat=A02060100)은 교육 테마로 분류된다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '한밭교육박물관')
  assert.ok(site)
  assert.ok(site.themes.includes('education'))
})

test('국립 대전 현충원은 cat 코드 없이 이름 키워드로 역사 테마를 받고, 자연이 보조 테마로 추가된다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '국립 대전 현충원')
  assert.ok(site)
  assert.deepEqual(site.themes, ['history', 'nature'])
})

test('한밭수목원(cat 없음)은 이름 키워드로 자연 테마를 받는다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '한밭수목원')
  assert.ok(site)
  assert.ok(site.themes.includes('nature'))
})

test('getAttractionById는 존재하는 id를 반환하고 없으면 null', () => {
  const first = TAGGED_ATTRACTIONS[0]
  assert.equal(getAttractionById(first.id).id, first.id)
  assert.equal(getAttractionById('__없는_id__'), null)
})
