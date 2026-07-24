// 빵집까지의 거리 정보.
//   - 사용자가 대전 안에 있으면: 현재 위치 → 빵집 직선거리
//   - 대전 밖(또는 위치 미확인)이면: 가장 가까운 역(대전역/서대전역) → 빵집 직선거리
import { haversineKm, isWithinBbox } from './distance'
import { nearestStation } from '../data/stations'

// 반환: { km, from } | null  (from: '현재 위치' | 역 이름)
export function getBakeryDistanceInfo(bakery, { coords, bbox }) {
  if (!Number.isFinite(bakery.lat) || !Number.isFinite(bakery.lng)) return null
  const target = { lat: bakery.lat, lng: bakery.lng }

  if (coords && isWithinBbox(coords, bbox)) {
    return { km: haversineKm(coords, target), from: '현재 위치' }
  }

  const station = nearestStation(target)
  if (!station) return null
  return { km: haversineKm(station, target), from: station.name }
}
