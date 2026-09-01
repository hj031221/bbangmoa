import { districtOf } from './districtFromPoint.js'
import { DISTRICT_RINGS } from '../data/daejeonDistricts.js'

const DISTRICT_NAMES = Object.keys(DISTRICT_RINGS)
const CONQUER_THRESHOLD = 3 // 이 수 이상의 서로 다른 빵집이면 그 구 100%(정복)

// 기록장 배열에서 구별 방문도를 파생한다.
// count = 구별로 방문한 서로 다른 빵집 id 수 (중복 기록은 1). 분모는 항상 5개 구.
// 1단계는 전체 기록을 센다. 2단계 병합 시 verified 필터 인자를 추가하며 시그니처가 바뀐다.
export function computeVisitStamps(entries) {
  const byDistrict = new Map(DISTRICT_NAMES.map((name) => [name, new Set()]))

  for (const entry of entries ?? []) {
    const bakery = entry?.bakery
    const district = districtOf({ lat: bakery?.lat, lng: bakery?.lng })
    if (!district) continue
    const bakeryId = entry?.bakery_id ?? bakery?.id
    if (bakeryId == null) continue
    byDistrict.get(district).add(bakeryId)
  }

  const perDistrict = DISTRICT_NAMES.map((name) => {
    const count = byDistrict.get(name).size
    const pct = Math.round(Math.min(count / CONQUER_THRESHOLD, 1) * 100)
    return { name, count, pct }
  })

  const overallPct = Math.round(
    perDistrict.reduce((sum, d) => sum + d.pct, 0) / DISTRICT_NAMES.length,
  )
  const conqueredCount = perDistrict.filter((d) => d.pct === 100).length

  return { perDistrict, overallPct, conqueredCount }
}
