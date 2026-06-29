// 카카오 로컬 키워드 검색 API. 빵집 좌표/주소/전화를 밀도 높게 확보하는 보조 소스.
// 브라우저에서 Authorization 헤더로 직접 호출 가능 (데모 한정으로 REST 키 노출 감수).
import { getJson, hasKey } from './http'
import { getRegion } from '../config/regions'

const REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY
const ENDPOINT = 'https://dapi.kakao.com/v2/local/search/keyword.json'

export const kakaoLocalEnabled = () => hasKey(REST_KEY)

// 여러 페이지를 긁어 합친다 (페이지당 최대 15건).
export async function fetchKakaoBakeries(regionId, { pages = 3 } = {}) {
  if (!kakaoLocalEnabled()) return []
  const region = getRegion(regionId)
  const headers = { Authorization: `KakaoAK ${REST_KEY}` }

  const results = await Promise.allSettled(
    Array.from({ length: pages }, (_, i) =>
      getJson(ENDPOINT, {
        params: { query: region.kakaoQuery, size: 15, page: i + 1 },
        headers,
      }),
    ),
  )

  return results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value?.documents ?? [] : [],
  )
}
