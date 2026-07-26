// 빵집까지의 거리 정보.
//   - 설문에서 고른 출발 위치(origin)가 있으면: origin → 빵집 직선거리 (최우선)
//   - origin 없고 대전 안이면: 현재 위치(GPS) → 빵집 직선거리
//   - 둘 다 없으면(대전 밖·위치 미확인): 가장 가까운 역(대전역/서대전역) → 빵집 직선거리
import { haversineKm, isWithinBbox } from './distance'
import { nearestStation } from '../data/stations'

// 반환: { km, from } | null  (from: origin 라벨 | '현재 위치' | 역 이름)
export function getBakeryDistanceInfo(bakery, { origin, coords, bbox }) {
  if (!Number.isFinite(bakery.lat) || !Number.isFinite(bakery.lng)) return null
  const target = { lat: bakery.lat, lng: bakery.lng }

  if (origin) {
    return { km: haversineKm(origin, target), from: origin.label || '출발 위치' }
  }

  if (coords && isWithinBbox(coords, bbox)) {
    return { km: haversineKm(coords, target), from: '현재 위치' }
  }

  const station = nearestStation(target)
  if (!station) return null
  return { km: haversineKm(station, target), from: station.name }
}
