// 기준점에서 가까운 짐 보관함(락커)을 거리순으로 추린다.
// nearestStation(../data/stations.js)·nearestAttraction(MapResult.jsx)과 같은 패턴 —
// lockers 를 주입 가능하게 두어 데이터 파일 없이도 테스트한다.
import { haversineKm, hasValidCoords } from './distance.js'
import { LUGGAGE_STORAGE } from '../data/luggageStorage.js'

// 반환: [{ ...locker, km }] — km 오름차순, 최대 limit 개, maxKm 이내만.
export function nearestLockers(point, { limit = 3, maxKm = 5, lockers = LUGGAGE_STORAGE } = {}) {
  if (!hasValidCoords(point)) return []
  return lockers
    .filter(hasValidCoords)
    .map((l) => ({ ...l, km: haversineKm(point, l) }))
    .filter((l) => l.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
}
