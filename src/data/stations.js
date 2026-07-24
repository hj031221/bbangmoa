// 사용자가 대전 밖에 있을 때 거리 기준점으로 쓰는 대전 주요 기차역(KTX/일반열차 관문).
import { haversineKm } from '../lib/distance'

export const STATIONS = [
  { id: 'daejeon', name: '대전역', lat: 36.33184, lng: 127.43417 },
  { id: 'seodaejeon', name: '서대전역', lat: 36.31984, lng: 127.40287 },
]

// 주어진 좌표에서 가장 가까운 역
export function nearestStation(point, stations = STATIONS) {
  let best = null
  let bestKm = Infinity
  for (const st of stations) {
    const km = haversineKm(point, st)
    if (km < bestKm) {
      bestKm = km
      best = st
    }
  }
  return best
}
