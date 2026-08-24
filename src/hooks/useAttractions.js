import daejeonTour from '../data/daejeonTour.json' with { type: 'json' }
import { TAGGED_ATTRACTIONS } from '../data/tourAttractionTags'

// 관광지 데이터 접근 창구. 화면들은 daejeonTour.json / TAGGED_ATTRACTIONS 를 직접
// import 하지 말고 이 훅을 통해 가져온다.
//
// 지금(Step 1)은 정적 파일을 그대로 반환한다 — 동작 변화 없음.
// 이후 Step 3에서 내부 구현만 한국관광공사 API 실시간 호출로 교체될 예정이며,
// 그때도 반환 형태(tagged/raw/loading/error)는 그대로 유지된다.
//
//   tagged  : 태그(themes/traits/companion) 부여된 관광지[] — 이미지 있는 것만 (추천·상세용)
//   raw     : 태그 없는 원본 관광지[] — 이미지 유무 무관 전체 (좌표 매칭 등 폭넓게 쓸 때)
//   loading : 로딩 중 여부
//   error   : 에러 객체 | null
export function useAttractions() {
  return { tagged: TAGGED_ATTRACTIONS, raw: daejeonTour, loading: false, error: null }
}
