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

test('둔산선사유적지(cat 없음)는 이름에 "산"이 있어도 유적 키워드로 역사 테마를 받는다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '둔산선사유적지')
  assert.ok(site, '둔산선사유적지를 찾을 수 없음')
  assert.ok(site.themes.includes('history'))
  assert.ok(!site.themes.includes('nature'))
})

test('대전무형유산전수교육관(cat 없음)은 이름에 "산"이 있어도 교육 키워드로 교육 테마를 받는다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '대전무형유산전수교육관')
  assert.ok(site, '대전무형유산전수교육관을 찾을 수 없음')
  assert.ok(site.themes.includes('education'))
  assert.ok(!site.themes.includes('nature'))
})

test('대전예술의전당(cat 없음, type=문화시설)은 이름 키워드로 문화 테마를 받는다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '대전예술의전당')
  assert.ok(site, '대전예술의전당을 찾을 수 없음')
  assert.ok(site.themes.includes('culture'))
})

test('헤레디움(cat 없음, 이름 키워드 없음, type=문화시설)은 기타가 아니라 문화 테마로 기본 배정된다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '헤레디움')
  assert.ok(site, '헤레디움을 찾을 수 없음')
  assert.ok(site.themes.includes('culture'))
  assert.ok(!site.themes.includes('etc'))
})

test('대전한밭도서관(cat 없음, type=문화시설)은 도서관 키워드로 교육 테마를 받는다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '대전한밭도서관')
  assert.ok(site, '대전한밭도서관을 찾을 수 없음')
  assert.ok(site.themes.includes('education'))
})

test('같은 (구, 테마) 풀 안에서도 trait 벡터가 다양화된다: 동구 nature 17곳이 1개 벡터로 수렴하지 않는다', () => {
  const pool = TAGGED_ATTRACTIONS.filter((a) => a.district === '동구' && a.themes[0] === 'nature')
  assert.ok(pool.length >= 5, `동구 nature 풀 크기가 예상보다 작음: ${pool.length}`)
  const distinct = new Set(pool.map((a) => JSON.stringify(a.traits)))
  assert.ok(distinct.size > 1, `동구 nature ${pool.length}곳이 여전히 ${distinct.size}개 벡터로 수렴함`)
})

// 같은 풀 안에서 벡터가 같으면 성향일치도·동행적합도가 모두 같아져 표시 적합도가 겹친다.
// 반올림·가중치 조정으로는 갈라낼 수 없으므로 데이터 단계에서 중복을 막는다.
test('같은 (구, 테마) 풀 안에 trait 벡터가 완전히 같은 관광지 쌍은 없다', () => {
  const pools = new Map()
  for (const a of TAGGED_ATTRACTIONS) {
    for (const t of a.themes) {
      const key = `${a.district}/${t}`
      if (!pools.has(key)) pools.set(key, [])
      pools.get(key).push(a)
    }
  }
  const dups = []
  for (const [key, list] of pools) {
    const seen = new Map()
    for (const a of list) {
      const vec = JSON.stringify(a.traits)
      if (seen.has(vec)) dups.push(`${key}: ${seen.get(vec)} = ${a.name}`)
      else seen.set(vec, a.name)
    }
  }
  assert.deepEqual(dups, [], `동일 벡터 ${dups.length}쌍:\n${dups.join('\n')}`)
})

test('getAttractionById는 존재하는 id를 반환하고 없으면 null', () => {
  const first = TAGGED_ATTRACTIONS[0]
  assert.equal(getAttractionById(first.id).id, first.id)
  assert.equal(getAttractionById('__없는_id__'), null)
})

// 코드리뷰 발견: /기념관|의거/ 가 '문화예술의거리'의 '의거리'(=거리)를 '의거'(봉기)로 오매칭해
// knowledge 1→3, appreciation 4→5(상한)로 부풀렸다. 129행과 같은 클래스의 버그(부정전방탐색 누락).
test('"의거"는 boost 매칭하되 "…의거리"는 매칭하지 않는다 (대흥동 문화예술의거리 오매칭 회귀 방지)', () => {
  const street = TAGGED_ATTRACTIONS.find((a) => a.name === '대흥동 문화예술의거리')
  const memorial = TAGGED_ATTRACTIONS.find((a) => a.name === '3.8민주의거기념관')
  assert.ok(street, '대흥동 문화예술의거리를 찾을 수 없음')
  assert.ok(memorial, '3.8민주의거기념관을 찾을 수 없음')
  // cat=A02030600 nudge(appreciation+1)만 반영되어야 한다 — '의거' boost(knowledge+2, appreciation+1)가 더해지면 안 됨
  assert.equal(street.traits.knowledge, 1, `문화예술의거리 knowledge가 부풀려짐: ${street.traits.knowledge}`)
  assert.equal(street.traits.appreciation, 4, `문화예술의거리 appreciation이 부풀려짐: ${street.traits.appreciation}`)
  // '기념관' 키워드로 정상적으로 boost는 계속 적용돼야 한다
  assert.equal(memorial.traits.knowledge, 5)
  assert.equal(memorial.traits.appreciation, 2)
})
