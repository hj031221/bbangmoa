import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DAEJEON_BBOX,
  parseBakeryId,
  inDaejeon,
  pickKakaoMatch,
  pickTourCoord,
} from '../../supabase/functions/resolve-bakery-coords/coordMatch.js'

test('parseBakeryId — 접두 있는 id 는 source/nativeId 로 분해', () => {
  assert.deepEqual(parseBakeryId('kakao:12345678'), { source: 'kakao', nativeId: '12345678' })
  assert.deepEqual(parseBakeryId('tour:741957'), { source: 'tour', nativeId: '741957' })
  assert.deepEqual(parseBakeryId('  kakao:abc  '), { source: 'kakao', nativeId: 'abc' })
})

test('parseBakeryId — 잘못된 입력은 null', () => {
  for (const bad of ['foo', '', 'kakao:', 'tour:', ':123', 'other:1', null, undefined, 123]) {
    assert.equal(parseBakeryId(bad), null, `${JSON.stringify(bad)} → null`)
  }
})

test('inDaejeon — 대전 안/밖', () => {
  assert.equal(inDaejeon(36.35, 127.42), true)
  assert.equal(inDaejeon(DAEJEON_BBOX.minLat, DAEJEON_BBOX.minLng), true) // 경계 포함
  assert.equal(inDaejeon(DAEJEON_BBOX.maxLat, DAEJEON_BBOX.maxLng), true)
  assert.equal(inDaejeon(37.5665, 126.978), false) // 서울
  assert.equal(inDaejeon(0, 0), false)
  assert.equal(inDaejeon(Number.NaN, 127.4), false)
  assert.equal(inDaejeon('36.3', '127.4'), false) // 문자열 비허용
})

test('pickKakaoMatch — id 일치 문서의 좌표(y=lat, x=lng)', () => {
  const docs = [
    { id: '111', x: '127.1', y: '36.2' },
    { id: '222', x: '127.42', y: '36.35' },
  ]
  assert.deepEqual(pickKakaoMatch(docs, '222'), { found: true, coord: { lat: 36.35, lng: 127.42 } })
  assert.deepEqual(pickKakaoMatch(docs, 222), { found: true, coord: { lat: 36.35, lng: 127.42 } }) // 숫자 nativeId 도 허용
})

test('pickKakaoMatch — 이 페이지에 없으면 found:false (호출부가 다음 페이지를 본다)', () => {
  assert.deepEqual(pickKakaoMatch([{ id: '999', x: '127.42', y: '36.35' }], '222'), { found: false, coord: null })
  assert.deepEqual(pickKakaoMatch([], '222'), { found: false, coord: null })
  assert.deepEqual(pickKakaoMatch(null, '222'), { found: false, coord: null })
  assert.deepEqual(pickKakaoMatch(undefined, '222'), { found: false, coord: null })
})

test('pickKakaoMatch — id 는 만났지만 대전 밖이면 found:true, coord:null (페이징 중단 신호)', () => {
  assert.deepEqual(pickKakaoMatch([{ id: '222', x: '126.978', y: '37.5665' }], '222'), {
    found: true,
    coord: null,
  }) // 서울 좌표
})

test('pickTourCoord — mapy=lat, mapx=lng', () => {
  assert.deepEqual(pickTourCoord({ mapx: '127.42', mapy: '36.35' }), { lat: 36.35, lng: 127.42 })
})

test('pickTourCoord — 좌표 없음/0,0/대전 밖은 null', () => {
  assert.equal(pickTourCoord({}), null)
  assert.equal(pickTourCoord({ mapx: '0', mapy: '0' }), null)
  assert.equal(pickTourCoord({ mapx: '126.978', mapy: '37.5665' }), null)
  assert.equal(pickTourCoord(null), null)
})
