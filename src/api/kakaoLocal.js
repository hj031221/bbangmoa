// 카카오 로컬 키워드 검색 API. 빵집 좌표/주소/전화를 밀도 높게 확보하는 보조 소스.
// 브라우저에서 Authorization 헤더로 직접 호출 가능 (데모 한정으로 REST 키 노출 감수).
//
// 단일 "대전 빵집" 쿼리는 카카오가 쿼리당 최대 45건(3페이지×15)만 주므로 지도가 비어 보인다.
// → 키워드 다중화 + 구별 분산 + 페이지네이션으로 쿼리를 늘려 수백 곳을 수집한다.
//   (쿼리당 45개 상한을 "구/키워드 분산"으로 우회. dedup 은 normalize.mergeBakeries 가 담당)
import { getJson, hasKey } from './http'
import { getRegion } from '../config/regions'

const REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY
const ENDPOINT = 'https://dapi.kakao.com/v2/local/search/keyword.json'
const REGIONCODE_ENDPOINT = 'https://dapi.kakao.com/v2/local/geo/coord2regioncode.json'
const COORD2ADDR_ENDPOINT = 'https://dapi.kakao.com/v2/local/geo/coord2address.json'
const CATEGORY_ENDPOINT = 'https://dapi.kakao.com/v2/local/search/category.json'

export const kakaoLocalEnabled = () => hasKey(REST_KEY)

// CP11-4 — 좌표 근처(기본 반경 1.5km) 주차장 1곳을 찾는다. 카카오 자동차 길찾기가 도로망을 못
// 찾는 지점(대청호 같은 호수/공원 초입 등, result_code 103)에 실제로 차로 갈 수 있는 대체
// 목적지를 마련해 재요청할 때 쓴다 — 대체 지점부터 실제 목적지까지 마지막 구간은 여전히 추정치로
// 남지만, 통째로 직선거리로 어림하는 것보다 훨씬 정확하다.
// → { lat, lng } | null
export async function findNearbyParking(lat, lng, radiusM = 1500) {
  if (!kakaoLocalEnabled()) return null
  const headers = { Authorization: `KakaoAK ${REST_KEY}` }
  const data = await getJson(CATEGORY_ENDPOINT, {
    params: { category_group_code: 'PK6', x: lng, y: lat, radius: radiusM, sort: 'distance' },
    headers,
  })
  const doc = data?.documents?.[0]
  if (!doc) return null
  const plat = parseFloat(doc.y)
  const plng = parseFloat(doc.x)
  if (!Number.isFinite(plat) || !Number.isFinite(plng)) return null
  return { lat: plat, lng: plng }
}

// 장소명/주소로 좌표를 찾는다 (설문 0단계 "출발지 검색"). bbox로 지역을 한정하지 않는다 —
// 대전 밖에서 출발하는 사용자도 있을 수 있어(PickMap과 동일 전제) 전국 검색 결과를 그대로 준다.
// → [{ name, address, lat, lng }] (최대 8건)
export async function searchPlace(query) {
  if (!kakaoLocalEnabled() || !query?.trim()) return []
  const headers = { Authorization: `KakaoAK ${REST_KEY}` }
  const data = await getJson(ENDPOINT, {
    params: { query: query.trim(), size: 8 },
    headers,
  })
  return (data?.documents ?? [])
    .map((d) => {
      const lat = parseFloat(d.y)
      const lng = parseFloat(d.x)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        name: d.place_name,
        address: d.road_address_name || d.address_name || '',
        lat,
        lng,
      }
    })
    .filter(Boolean)
}

// 좌표 → 행정구역명 (예: "대전광역시 유성구"). GPS 로 얻은 좌표가 어디쯤인지 사용자에게 보여줄 때 사용.
export async function reverseGeocode(lat, lng) {
  if (!kakaoLocalEnabled()) return null
  const headers = { Authorization: `KakaoAK ${REST_KEY}` }
  const data = await getJson(REGIONCODE_ENDPOINT, {
    params: { x: lng, y: lat },
    headers,
  })
  const region = data?.documents?.find((d) => d.region_type === 'H') || data?.documents?.[0]
  if (!region) return null
  return [region.region_1depth_name, region.region_2depth_name].filter(Boolean).join(' ')
}

// 좌표 → 상세 주소(도로명 우선, 없으면 지번). 관광공사 정적 데이터가 "OO동"까지만
// 제공하는 경우가 많아, 좌표 기반으로 더 정확한 주소를 보강할 때 쓴다.
export async function reverseGeocodeAddress(lat, lng) {
  if (!kakaoLocalEnabled()) return null
  const headers = { Authorization: `KakaoAK ${REST_KEY}` }
  const data = await getJson(COORD2ADDR_ENDPOINT, {
    params: { x: lng, y: lat },
    headers,
  })
  const doc = data?.documents?.[0]
  if (!doc) return null
  return doc.road_address?.address_name || doc.address?.address_name || null
}

// 카카오 rect 파라미터: "왼쪽경도,아래위도,오른쪽경도,위위도" (lng,lat 순서)
function bboxRect(bbox) {
  return `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`
}

function inBbox(doc, bbox) {
  const lat = parseFloat(doc.y)
  const lng = parseFloat(doc.x)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  )
}

// 지역 설정으로부터 카카오 질의어 목록을 만든다 (중복 질의 제거).
//   - 시 전역: "대전 빵집", "대전 베이커리", ...
//   - 구별:   "대전 동구 빵집", "대전 동구 베이커리", ... (5개 구)
//   - 명물:   "대전 성심당" 등
export function buildKakaoQueries(region) {
  const set = new Set()
  for (const kw of region.kakaoKeywords ?? []) set.add(`${region.label} ${kw}`)
  for (const d of region.districts ?? []) {
    for (const kw of region.districtKeywords ?? []) {
      set.add(`${region.label} ${d} ${kw}`)
    }
  }
  for (const q of region.specialtyQueries ?? []) set.add(q)
  // 어떤 키워드도 설정 안 됐으면 최소 fallback
  if (set.size === 0) set.add(`${region.label} 빵집`)
  return [...set]
}

// 단일 질의어를 여러 페이지 긁어 합친다 (페이지당 최대 15건).
async function fetchOneQuery(query, { headers, rect, pages }) {
  const results = await Promise.allSettled(
    Array.from({ length: pages }, (_, i) =>
      getJson(ENDPOINT, {
        params: { query, size: 15, page: i + 1, rect },
        headers,
      }),
    ),
  )
  return results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value?.documents ?? [] : [],
  )
}

// 지역의 모든 질의어를 긁어 합친다. 카카오 원본 document[] 반환 (정규화/중복제거는 호출부에서).
//   - rect 로 대전 bbox 한정 + 응답을 bbox 로 한번 더 필터(대전 밖 결과 제외)
export async function fetchKakaoBakeries(regionId, { pages = 3 } = {}) {
  if (!kakaoLocalEnabled()) return []
  const region = getRegion(regionId)
  const headers = { Authorization: `KakaoAK ${REST_KEY}` }
  const rect = region.bbox ? bboxRect(region.bbox) : undefined
  const queries = buildKakaoQueries(region)

  const lists = await Promise.allSettled(
    queries.map((q) => fetchOneQuery(q, { headers, rect, pages })),
  )
  let docs = lists.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  if (region.bbox) docs = docs.filter((d) => inBbox(d, region.bbox))
  return docs
}
