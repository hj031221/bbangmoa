// src/components/mypage/SavedCourseMap.jsx
import { useEffect, useRef } from 'react'
import { useKakaoLoader } from '../../hooks/useKakaoLoader'

// 저장된 코스 상세 지도 — origin + stops 를 번호 핀으로 찍고 점선으로 잇는다.
// PilgrimagePage 의 RouteMap 과 달리 legPaths(실제 이동경로)는 저장 시점에 남기지 않으므로
// 항상 직선 점선으로만 그린다.
export default function SavedCourseMap({ origin, stops }) {
  const { loaded, error } = useKakaoLoader()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const polylinesRef = useRef([])

  useEffect(() => {
    if (!loaded || !containerRef.current || !origin) return
    const { kakao } = window

    if (!mapRef.current) {
      mapRef.current = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(origin.lat, origin.lng),
        level: 7,
      })
    }
    const map = mapRef.current

    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
    polylinesRef.current.forEach((p) => p.setMap(null))
    polylinesRef.current = []

    const points = [origin, ...stops]
    const bounds = new kakao.maps.LatLngBounds()

    for (let i = 0; i < points.length - 1; i++) {
      const path = [points[i], points[i + 1]].map((p) => new kakao.maps.LatLng(p.lat, p.lng))
      path.forEach((ll) => bounds.extend(ll))
      polylinesRef.current.push(
        new kakao.maps.Polyline({
          map,
          path,
          strokeWeight: 4,
          strokeColor: '#F2814A',
          strokeOpacity: 0.85,
          strokeStyle: 'shortdash',
        }),
      )
    }

    const originOverlay = new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(origin.lat, origin.lng),
      content: '<div class="pil-pin pil-pin-origin">S</div>',
      yAnchor: 0.5,
    })
    overlaysRef.current.push(originOverlay)
    bounds.extend(new kakao.maps.LatLng(origin.lat, origin.lng))

    stops.forEach((stop, i) => {
      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(stop.lat, stop.lng),
        content: `<div class="pil-pin pil-pin-${stop.type}">${i + 1}</div>`,
        yAnchor: 0.5,
      })
      overlaysRef.current.push(overlay)
      bounds.extend(new kakao.maps.LatLng(stop.lat, stop.lng))
    })

    if (points.length > 0) map.setBounds(bounds)
  }, [loaded, origin, stops])

  return (
    <div className="map-wrap mypage-course-map">
      {error && (
        <div className="map-error">
          지도를 불러오지 못했습니다.<br />
          <code>VITE_KAKAO_JS_KEY</code> 를 확인하세요.
        </div>
      )}
      <div ref={containerRef} className="map-canvas" />
    </div>
  )
}
