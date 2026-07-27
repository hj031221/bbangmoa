import { useEffect, useRef, useState } from 'react'
import { useKakaoLoader } from '../../hooks/useKakaoLoader'
import { useAppStore } from '../../store/useAppStore'
import { getRegion } from '../../config/regions'
import { DAEJEON_RING } from '../../data/daejeonBoundary'
import { DISTRICT_RINGS } from '../../data/daejeonDistricts'
import MarkerLayer from './MarkerLayer'
import AttractionMarkers from './AttractionMarkers'
import { getEnabledFeatures, createClusterer } from './features'

// 카카오맵 컨테이너 + 대전 마스킹(스포트라이트) + 마커 레이어 + 확장기능 실행기.
// highlightDistrict: 구 이름을 주면 그 구의 행정경계를 색칠해서 보여준다.
export default function MapView({
  bakeries,
  selectedId,
  onSelect,
  attractions = [],
  highlightDistrict = null,
}) {
  const { loaded, error } = useKakaoLoader()
  const regionId = useAppStore((s) => s.regionId)
  const region = getRegion(regionId)
  const containerRef = useRef(null)
  const [map, setMap] = useState(null)
  const [clusterer, setClusterer] = useState(null)
  const highlightRef = useRef(null)
  const boundsRef = useRef(null)

  // 지도 생성 + 대전 외곽 딤 + 시점 고정 (1회)
  useEffect(() => {
    if (!loaded || !containerRef.current || map) return
    const { kakao } = window
    const m = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(region.center.lat, region.center.lng),
      level: region.zoomLevel,
    })

    // 대전 경계 링
    const ring = DAEJEON_RING.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng))

    // ① 외곽 딤(스포트라이트): 큰 사각형에서 대전 구멍을 뚫어 바깥만 반투명 회색으로
    const world = [
      new kakao.maps.LatLng(30, 120),
      new kakao.maps.LatLng(30, 135),
      new kakao.maps.LatLng(45, 135),
      new kakao.maps.LatLng(45, 120),
    ]
    new kakao.maps.Polygon({
      map: m,
      path: [world, ring], // even-odd: 바깥 - 대전 = 대전만 환함
      fillColor: '#5b4a36',
      fillOpacity: 0.5,
      strokeWeight: 0,
    })
    // 대전 윤곽선 강조
    new kakao.maps.Polygon({
      map: m,
      path: ring,
      strokeWeight: 2,
      strokeColor: '#E0913A',
      strokeOpacity: 0.9,
      fillOpacity: 0,
    })

    // ② 대전 전체가 보이게 + 줌아웃 제한(대전 밖 못 벗어나게)
    const bounds = new kakao.maps.LatLngBounds()
    ring.forEach((ll) => bounds.extend(ll))
    m.setBounds(bounds)
    m.setMaxLevel(9)
    boundsRef.current = bounds

    // 마커 클러스터러 생성(기능 enabled 시). MarkerLayer 가 이걸로 마커를 묶는다.
    setClusterer(createClusterer({ map: m, kakao }))
    setMap(m)
  }, [loaded, map, region])

  // 선택된 빵집이 없으면(구 필터를 바꿔서 이전 선택이 사라진 경우 포함) 대전 전체 시점으로 복귀.
  useEffect(() => {
    if (!map || !boundsRef.current || selectedId) return
    map.setBounds(boundsRef.current)
  }, [map, selectedId, highlightDistrict])

  // 구 필터 색칠: highlightDistrict 가 있으면 그 구의 경계를 채워 그리고, 없으면 지운다.
  useEffect(() => {
    if (!map) return
    const { kakao } = window
    if (highlightRef.current) {
      highlightRef.current.setMap(null)
      highlightRef.current = null
    }
    const ring = highlightDistrict && DISTRICT_RINGS[highlightDistrict]
    if (ring) {
      const path = ring.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng))
      highlightRef.current = new kakao.maps.Polygon({
        map,
        path,
        strokeWeight: 2,
        strokeColor: '#F2814A',
        strokeOpacity: 0.9,
        fillColor: '#F2814A',
        fillOpacity: 0.28,
      })
    }
    return () => {
      if (highlightRef.current) {
        highlightRef.current.setMap(null)
        highlightRef.current = null
      }
    }
  }, [map, highlightDistrict])

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
          <code>VITE_KAKAO_JS_KEY</code> 와 카카오 플랫폼 도메인 등록을 확인하세요.
        </div>
      )}
      <div ref={containerRef} className="map-canvas" />
      {map && (
        <>
          <AttractionMarkers map={map} attractions={attractions} />
          <MarkerLayer
            map={map}
            bakeries={bakeries}
            selectedId={selectedId}
            onSelect={onSelect}
            clusterer={clusterer}
          />
        </>
      )}
    </div>
  )
}
