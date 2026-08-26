// (테스트 전용) daejeonTour.json 186곳(이미지 있는 173곳만 사용)에 태그(themes/traits/companion)를
// 부여한 고정 픽스처. 태깅 로직 자체는 src/lib/attractionTagging.js 로 옮겨졌다 — 실서비스는
// 더 이상 이 파일을 쓰지 않고, tourAttractionTags.test.js / tourIntegration.test.js 만 이 상수를 쓴다.
import daejeonTour from './daejeonTour.json' with { type: 'json' }
import { tagSite } from '../lib/attractionTagging.js'

export const TAGGED_ATTRACTIONS = daejeonTour.filter((s) => s.image).map(tagSite)

export function getAttractionById(id) {
  return TAGGED_ATTRACTIONS.find((a) => a.id === id) ?? null
}
