import { useEffect } from 'react'
import { VISIT_RADIUS_M } from '../../lib/visitRadius'
import { hasValidCoords } from '../../lib/distance'

// 선택한 빵집 둘레에 방문 인증 반경(150m) 원을, 내 위치엔 파란 점 + GPS 정확도 원을 그린다.
export default function VisitRadiusLayer({ map, bakery, myCoords }) {
  const bakeryLat = bakery?.lat
  const bakeryLng = bakery?.lng
  useEffect(() => {
    if (!map || !hasValidCoords({ lat: bakeryLat, lng: bakeryLng })) return
    const { kakao } = window
    const circle = new kakao.maps.Circle({
      map,
      center: new kakao.maps.LatLng(bakeryLat, bakeryLng),
      radius: VISIT_RADIUS_M,
      strokeWeight: 2,
      strokeColor: '#E0913A',
      strokeOpacity: 0.9,
      strokeStyle: 'dash',
      fillColor: '#F2B05E',
      fillOpacity: 0.18,
      zIndex: 1,
    })
    return () => circle.setMap(null)
  }, [map, bakeryLat, bakeryLng])

  const lat = myCoords?.lat
  const lng = myCoords?.lng
  const accuracy = myCoords?.accuracy
  useEffect(() => {
    if (!map || !hasValidCoords({ lat, lng })) return
    const { kakao } = window
    const position = new kakao.maps.LatLng(lat, lng)
    const dot = document.createElement('div')
    dot.className = 'bm-my-location-dot'
    dot.setAttribute('role', 'img')
    dot.setAttribute('aria-label', '내 위치')
    const overlay = new kakao.maps.CustomOverlay({ map, position, content: dot, xAnchor: 0.5, yAnchor: 0.5, zIndex: 20 })
    const halo = Number.isFinite(accuracy) && accuracy > 0
      ? new kakao.maps.Circle({
          map,
          center: position,
          radius: Math.min(accuracy, 1000),
          strokeWeight: 1,
          strokeColor: '#2F80ED',
          strokeOpacity: 0.4,
          fillColor: '#2F80ED',
          fillOpacity: 0.12,
          zIndex: 2,
        })
      : null
    return () => {
      overlay.setMap(null)
      halo?.setMap(null)
    }
  }, [map, lat, lng, accuracy])

  return null
}
