// 지역 설정. 지금은 대전 단일 대상이지만, 다른 도시로 확장할 때 여기만 늘리면 된다.
//
// - lDongRegnCd: 관광공사 KorService2 의 법정동 시도코드 (대전 = 30)
//   (구버전 areaCode 가 아니라 신분류체계 v4.4 의 lDongRegnCd 를 쓴다)
// - center: 카카오맵 초기 중심좌표
// - bbox: 대전 경계 bounding box (카카오 rect 한정 + 경계 밖 결과 필터)
// - districts: 구 목록 (구별 분산 검색으로 카카오 쿼리당 45개 상한 우회)
// - kakaoKeywords: "OO {kw}" 형태의 시 전역 키워드 (빵집·베이커리·제과·도넛·…)
// - districtKeywords: "OO {구} {kw}" 형태로 구마다 돌릴 핵심 키워드
// - specialtyQueries: 명물(성심당 등) 보강용 단발 질의
// - tourKeywords: 관광공사 searchKeyword2 에 쓰는 키워드들 (빵집은 분류코드가 없어 키워드로 긁는다)

export const DEFAULT_REGION = 'daejeon'

export const REGIONS = {
  daejeon: {
    id: 'daejeon',
    label: '대전',
    lDongRegnCd: '30',
    center: { lat: 36.3504, lng: 127.3845 },
    zoomLevel: 6,
    bbox: { minLat: 36.18, maxLat: 36.5, minLng: 127.25, maxLng: 127.56 },
    districts: ['동구', '중구', '서구', '유성구', '대덕구'],
    kakaoKeywords: ['빵집', '베이커리', '제과', '제과점', '도넛', '케이크', '디저트'],
    districtKeywords: ['빵집', '베이커리'],
    specialtyQueries: ['대전 성심당', '대전 유명 빵집'],
    tourKeywords: ['대전 빵', '대전 베이커리', '대전 제과', '대전 디저트'],
  },
}

export function getRegion(id = DEFAULT_REGION) {
  return REGIONS[id] || REGIONS[DEFAULT_REGION]
}
