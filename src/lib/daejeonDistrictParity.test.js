import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DISTRICT_RINGS } from '../data/daejeonDistricts.js'

// classify_daejeon_district()(SQL)는 src/data/daejeonDistricts.js 의 DISTRICT_RINGS 를
// schema.sql 안에 통째로 복제해 둔다. 한쪽만 고치면 소유자 화면(JS)과 공개 집계(SQL)의
// 구 분류가 조용히 어긋난다. 이 테스트가 두 좌표 테이블이 정확히 같은지 고정한다.
// (DB 없이: schema.sql 의 jsonb 리터럴을 파싱해 비교한다.)
const schemaSql = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')

test('schema.sql classify_daejeon_district 의 링 좌표가 DISTRICT_RINGS 와 완전히 일치한다', () => {
  const match = schemaSql.match(/v_rings jsonb := '(\[[\s\S]*?\])'::jsonb;/)
  assert.ok(match, "schema.sql 에서 v_rings jsonb 리터럴을 찾지 못했다 (classify_daejeon_district)")

  const sqlRings = JSON.parse(match[1])
  const sqlByName = sqlRings.map((entry) => entry.name)
  const jsByName = Object.keys(DISTRICT_RINGS)

  // 순회 순서가 경계 공유 지점의 귀속을 정하므로 순서까지 같아야 한다.
  assert.deepEqual(sqlByName, jsByName, '구 순서가 다르다')

  for (const entry of sqlRings) {
    assert.deepEqual(
      entry.ring,
      DISTRICT_RINGS[entry.name],
      `${entry.name} 링 좌표가 schema.sql 과 daejeonDistricts.js 사이에서 어긋난다`,
    )
  }
})
