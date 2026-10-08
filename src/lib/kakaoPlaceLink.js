// 정류장 → 카카오맵 장소 링크(후기·사진·영업시간을 볼 수 있는 곳).
// 카카오 로컬 출처 빵집(id 가 'kakao:<장소ID>')은 장소 페이지로 바로 가고, 관광공사 빵집·관광지는
// 장소 ID 를 몰라서 "대전 + 이름" 검색 결과로 보낸다(다른 지역 동명 장소가 섞이지 않게 대전을 붙인다).
export function kakaoPlaceLink(stop) {
  const id = String(stop?.id ?? '')
  if (id.startsWith('kakao:')) return `https://place.map.kakao.com/${id.slice('kakao:'.length)}`
  return `https://map.kakao.com/link/search/${encodeURIComponent(`대전 ${stop?.name ?? ''}`.trim())}`
}
