// 지역 설정. 지금은 대전 단일 대상이지만, 다른 도시로 확장할 때 여기만 늘리면 된다.
//
// - lDongRegnCd: 관광공사 KorService2 의 법정동 시도코드 (대전 = 30)
//   (구버전 areaCode 가 아니라 신분류체계 v4.4 의 lDongRegnCd 를 쓴다)
// - center: 카카오맵 초기 중심좌표
// - kakaoQuery: 카카오 로컬 키워드 검색에 쓰는 질의어
// - tourKeywords: 관광공사 searchKeyword2 에 쓰는 키워드들 (빵집은 분류코드가 없어 키워드로 긁는다)

export const DEFAULT_REGION = 'daejeon'

export const REGIONS = {
  daejeon: {
    id: 'daejeon',
    label: '대전',
    lDongRegnCd: '30',
    center: { lat: 36.3504, lng: 127.3845 },
    zoomLevel: 6,
    kakaoQuery: '대전 빵집',
    tourKeywords: ['대전 빵', '대전 베이커리'],
  },
}

export function getRegion(id = DEFAULT_REGION) {
  return REGIONS[id] || REGIONS[DEFAULT_REGION]
}
