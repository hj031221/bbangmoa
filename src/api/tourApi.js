// 한국관광공사 KorService2 래퍼.
// 매뉴얼 v4.4 기준 엔드포인트: searchKeyword2 / locationBasedList2 / detailCommon2
// base 는 dev proxy(`/tourapi`) 를 통해 https://apis.data.go.kr 로 전달된다 (CORS 우회).
import { getJson, hasKey } from './http'
import { getRegion } from '../config/regions'

const BASE = '/tourapi/B551011/KorService2'
const SERVICE_KEY = import.meta.env.VITE_TOUR_API_KEY

const COMMON = {
  serviceKey: SERVICE_KEY,
  MobileOS: 'ETC',
  MobileApp: 'DaejeonBreadMap',
  _type: 'json',
}

export const tourEnabled = () => hasKey(SERVICE_KEY)

// 응답에서 items 배열을 안전하게 꺼낸다. (item 이 단일 객체로 올 때도 배열화)
function extractItems(json) {
  const item = json?.response?.body?.items?.item
  if (!item) return []
  return Array.isArray(item) ? item : [item]
}

// 키워드 기반 검색. 빵집은 분류코드가 없어 키워드("대전 빵" 등)로 긁는다.
export async function searchByKeyword(keyword, { regionId, numOfRows = 30 } = {}) {
  const region = getRegion(regionId)
  const json = await getJson(`${BASE}/searchKeyword2`, {
    params: {
      ...COMMON,
      keyword,
      lDongRegnCd: region.lDongRegnCd,
      arrange: 'C', // 수정일순 + 이미지 우선
      numOfRows,
      pageNo: 1,
    },
  })
  return extractItems(json)
}

// 좌표 반경 기반 검색 (음식점 contentTypeId=39). "내 주변" 확장 기능용.
export async function searchByLocation({ lat, lng, radius = 2000, numOfRows = 30 } = {}) {
  const json = await getJson(`${BASE}/locationBasedList2`, {
    params: {
      ...COMMON,
      mapX: lng,
      mapY: lat,
      radius,
      contentTypeId: 39,
      arrange: 'E', // 거리순
      numOfRows,
      pageNo: 1,
    },
  })
  return extractItems(json)
}

// 상세 공통정보 (마커/카드 탭 시 설명·대표이미지 보강)
export async function getDetail(contentId) {
  const json = await getJson(`${BASE}/detailCommon2`, {
    params: { ...COMMON, contentId, numOfRows: 1, pageNo: 1 },
  })
  return extractItems(json)[0] || null
}

// 지역 + 신분류(제과 FD030100)로 관광공사 빵집을 가져온다.
//  ⚠️ searchKeyword2("대전 빵" 등)는 실측 0건이라 폐기. areaBasedList2 + 제과 분류가
//     성심당 등 등재 빵집(실측 3곳)을 안정적으로 반환한다.
export async function fetchTourBakeries(regionId) {
  if (!tourEnabled()) return []
  const region = getRegion(regionId)
  const json = await getJson(`${BASE}/areaBasedList2`, {
    params: {
      ...COMMON,
      contentTypeId: 39, // 음식점
      lDongRegnCd: region.lDongRegnCd,
      lclsSystm1: 'FD',
      lclsSystm2: 'FD03',
      lclsSystm3: 'FD030100', // 제과(빵집)
      arrange: 'C',
      numOfRows: 100,
      pageNo: 1,
    },
  })
  return extractItems(json)
}
