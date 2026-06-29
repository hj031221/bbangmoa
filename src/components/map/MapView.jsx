import { useEffect, useRef, useState } from 'react'
import { useKakaoLoader } from '../../hooks/useKakaoLoader'
import { useAppStore } from '../../store/useAppStore'
import { getRegion } from '../../config/regions'
import MarkerLayer from './MarkerLayer'
import { getEnabledFeatures } from './features'

// 카카오맵 컨테이너 + 마커 레이어 + 확장기능 실행기.
export default function MapView({ bakeries, selectedId, onSelect }) {
  const { loaded, error } = useKakaoLoader()
  const regionId = useAppStore((s) => s.regionId)
  const region = getRegion(regionId)
  const containerRef = useRef(null)
  const [map, setMap] = useState(null)

  // 지도 생성 (1회)
  useEffect(() => {
    if (!loaded || !containerRef.current || map) return
    const { kakao } = window
    const m = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(region.center.lat, region.center.lng),
      level: region.zoomLevel,
    })
    setMap(m)
  }, [loaded, map, region])

  // 확장기능 실행 (enabled 인 것만)
  useEffect(() => {
    if (!map) return
    const cleanups = getEnabledFeatures()
      .map((f) => f.setup?.({ map, kakao: window.kakao }))
      .filter((c) => typeof c === 'function')
    return () => cleanups.forEach((c) => c())
  }, [map])

  return (
    <div className="map-wrap">
      {error && (
        <div className="map-error">
          지도를 불러오지 못했습니다.<br />
          <code>.env</code> 의 <code>VITE_KAKAO_JS_KEY</code> 와 카카오 플랫폼
          도메인(localhost) 등록을 확인하세요.
        </div>
      )}
      <div ref={containerRef} className="map-canvas" />
      {map && (
        <MarkerLayer
          map={map}
          bakeries={bakeries}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}
