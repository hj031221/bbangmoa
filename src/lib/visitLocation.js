export const VISIT_LOCATION_MAX_AGE_MS = 10000

export function isFreshVisitLocation(coords, now = Date.now()) {
  return Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)
    && Number.isFinite(coords?.timestamp) && coords.timestamp <= now
    && now - coords.timestamp < VISIT_LOCATION_MAX_AGE_MS
}

export function resolveVisitLocation(coords, geolocation = globalThis.navigator?.geolocation, now = Date.now()) {
  return isFreshVisitLocation(coords, now)
    ? Promise.resolve({ lat: coords.lat, lng: coords.lng })
    : captureVisitLocation(geolocation)
}

export const VISIT_LOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 0,
})

// 위치 권한 거부·타임아웃·미지원은 기록 작성을 막지 않고 미인증(null)으로 처리한다.
export function captureVisitLocation(geolocation = globalThis.navigator?.geolocation) {
  if (typeof geolocation?.getCurrentPosition !== 'function') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    try {
      geolocation.getCurrentPosition(
        (position) => {
          const lat = position?.coords?.latitude
          const lng = position?.coords?.longitude
          resolve(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null)
        },
        () => resolve(null),
        VISIT_LOCATION_OPTIONS,
      )
    } catch {
      resolve(null)
    }
  })
}
