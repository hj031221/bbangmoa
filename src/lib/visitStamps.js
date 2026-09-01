import { districtOf } from './districtFromPoint.js'
import { DISTRICT_RINGS } from '../data/daejeonDistricts.js'

const DISTRICT_NAMES = Object.keys(DISTRICT_RINGS)

const clampTarget = (n) => Math.min(20, Math.max(1, Math.round(n)))

// 기록장 배열 + 사용자 목표에서 스탬프 달성도를 파생한다.
//   count          = 그 구에서 방문한 서로 다른 빵집 수 (중복 기록은 1)
//   completedSlots = min(count, target) — 목표 초과분은 스탬프에 안 잡힘
//   goalPct(구)    = round(completedSlots / target * 100)
//   completed      = count >= target
//   goalPct(전체)  = round(Σ completedSlots / (target*5) * 100), 100 상한
// verifiedOnly: 2단계(방문 인증)에서 verified 기록만 세기 위한 스위치. 지금 호출부는 false.
export function computeVisitStamps(
  entries,
  { targetPerDistrict = 3, verifiedOnly = false } = {},
) {
  const target = clampTarget(targetPerDistrict)
  const source = verifiedOnly
    ? (entries ?? []).filter((e) => e?.verified === true)
    : (entries ?? [])

  const byDistrict = new Map(DISTRICT_NAMES.map((name) => [name, new Set()]))
  for (const entry of source) {
    const bakery = entry?.bakery
    const district = districtOf({ lat: bakery?.lat, lng: bakery?.lng })
    if (!district) continue
    const bakeryId = entry?.bakery_id ?? bakery?.id
    if (bakeryId == null) continue
    byDistrict.get(district).add(bakeryId)
  }

  const perDistrict = DISTRICT_NAMES.map((name) => {
    const count = byDistrict.get(name).size
    const completedSlots = Math.min(count, target)
    const goalPct = Math.round((completedSlots / target) * 100)
    return { name, count, target, completedSlots, goalPct, completed: count >= target }
  })

  const visitedBakeryCount = perDistrict.reduce((sum, d) => sum + d.count, 0)
  const completedSlots = perDistrict.reduce((sum, d) => sum + d.completedSlots, 0)
  const totalSlots = target * DISTRICT_NAMES.length
  const goalPct = Math.min(100, Math.round((completedSlots / totalSlots) * 100))
  const completedDistrictCount = perDistrict.filter((d) => d.completed).length

  return { perDistrict, visitedBakeryCount, completedSlots, totalSlots, goalPct, completedDistrictCount }
}
