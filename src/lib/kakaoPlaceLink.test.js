import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kakaoPlaceLink } from './kakaoPlaceLink.js'

test('카카오 출처 빵집은 장소 페이지로 바로 연결한다', () => {
  assert.equal(kakaoPlaceLink({ id: 'kakao:12345', name: '몽심' }), 'https://place.map.kakao.com/12345')
})

test('관광공사 빵집·관광지는 대전 + 이름 검색으로 연결한다', () => {
  assert.equal(
    kakaoPlaceLink({ id: 'tour:777', name: '성심당 본점' }),
    `https://map.kakao.com/link/search/${encodeURIComponent('대전 성심당 본점')}`,
  )
  assert.equal(
    kakaoPlaceLink({ id: '127663', name: '대청댐' }),
    `https://map.kakao.com/link/search/${encodeURIComponent('대전 대청댐')}`,
  )
})
