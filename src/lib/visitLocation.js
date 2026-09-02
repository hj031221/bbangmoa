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
