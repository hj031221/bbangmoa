// 한국관광공사 KorService2 래퍼.
// 매뉴얼 v4.4 기준 엔드포인트: areaBasedList2 / detailCommon2 / detailIntro2
// base 는 dev proxy(`/tourapi`) 를 통해 https://apis.data.go.kr 로 전달된다 (CORS 우회).
import { getJson, hasKey, toHttps } from './http'
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

// 상세 공통정보 (마커/카드 탭 시 설명·대표이미지 보강)
export async function getDetail(contentId) {
  const json = await getJson(`${BASE}/detailCommon2`, {
    params: { ...COMMON, contentId, numOfRows: 1, pageNo: 1 },
  })
  const item = extractItems(json)[0] || null
  if (item?.firstimage) item.firstimage = toHttps(item.firstimage) // CP11-6
  return item
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

// areaBasedList2 관광지/문화시설 원본 아이템 → attractionTagging.js 가 기대하는 site 형태로 정규화.
function normalizeAttraction(item, contentTypeId, typeLabel) {
  const lat = Number(item.mapy)
  const lng = Number(item.mapx)
  return {
    id: String(item.contentid),
    contentTypeId, // detailIntro2 호출 시 필요(관광지/문화시설 필드명이 다름)
    name: item.title || '',
    type: typeLabel,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    image: toHttps(item.firstimage) || '', // CP11-6
    addr: item.addr1 || '',
    cat: item.cat3 || item.cat2 || '',
  }
}

const ATTRACTION_TYPES = [
  { contentTypeId: 12, label: '관광지' },
  { contentTypeId: 14, label: '문화시설' },
]

// 지역의 관광지(12) + 문화시설(14) 목록을 실시간으로 가져온다.
//   prefetchTour.mjs(삭제됨, git log d1b51cf 참고)가 빌드타임에 하던 것과 같은 소스·필터를
//   런타임에 그대로 호출한다. 영업시간(detailIntro2)은 여기 포함하지 않는다 — 상세 열람 시
//   getAttractionIntro()로 그때 따로 가져온다(186곳 전부를 매번 부를 필요 없음).
export async function fetchAttractions(regionId) {
  if (!tourEnabled()) return []
  const region = getRegion(regionId)
  // allSettled — 관광지(12)/문화시설(14) 둘 중 하나만 실패해도 나머지는 그대로 살려서 보여준다.
  // 단, 둘 다 실패하면(API 전체 장애 등) 조용히 빈 배열로 넘기지 않고 실제로 throw해서
  // useAttractions의 error state가 채워지게 한다 — "이 지역엔 원래 없음"과 "지금 장애남"을
  // 구분할 방법이 아예 없었던 문제(finding #5) 대응.
  const settled = await Promise.allSettled(
    ATTRACTION_TYPES.map(({ contentTypeId, label }) =>
      getJson(`${BASE}/areaBasedList2`, {
        params: {
          ...COMMON,
          contentTypeId,
          lDongRegnCd: region.lDongRegnCd,
          arrange: 'C',
          numOfRows: 200,
          pageNo: 1,
        },
      }).then((json) => extractItems(json).map((item) => normalizeAttraction(item, contentTypeId, label))),
    ),
  )
  const succeeded = settled.filter((r) => r.status === 'fulfilled')
  if (succeeded.length === 0) throw settled[0].reason
  return succeeded.flatMap((r) => r.value).filter((a) => a.lat && a.lng && a.name)
}

// 관광지 상세 열람 시 영업시간/휴무 원문(detailIntro2). contentTypeId 별로 필드명이 다르다
// (관광지=usetime/restdate, 문화시설=usetimeculture/restdateculture).
export async function getAttractionIntro(contentId, contentTypeId) {
  const json = await getJson(`${BASE}/detailIntro2`, {
    params: { ...COMMON, contentId, contentTypeId, numOfRows: 1, pageNo: 1 },
  })
  const item = extractItems(json)[0] || null
  if (!item) return null
  const isCulture = String(contentTypeId) === '14'
  return {
    rawHours: (isCulture ? item.usetimeculture : item.usetime) || '',
    rest: (isCulture ? item.restdateculture : item.restdate) || '',
  }
}
