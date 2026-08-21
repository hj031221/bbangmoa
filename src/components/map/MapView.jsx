import { useEffect, useRef, useState } from 'react'
import { useKakaoLoader } from '../../hooks/useKakaoLoader'
import { useAppStore } from '../../store/useAppStore'
import { getRegion } from '../../config/regions'
import { DAEJEON_RING } from '../../data/daejeonBoundary'
import { DISTRICT_RINGS } from '../../data/daejeonDistricts'
import MarkerLayer from './MarkerLayer'
import AttractionMarkers from './AttractionMarkers'
import { getEnabledFeatures, createClusterer } from './features'

// DISTRICT_RINGS(구별 14~23점, southkorea-maps kostat/2013 단순화)와 DAEJEON_RING(353점, 별도
// 단순화)은 같은 실제 경계를 서로 다르게 단순화한 거라, 둘 다 "대전 외곽선"인 구간(예: 유성구
// 서쪽 변)도 좌표가 미세하게 어긋나 지도에 그려둔 대전 외곽선과 구 강조색이 안 겹쳐 보였다.
// → 구 경계 중 대전 외곽과 맞닿은 구간은 DAEJEON_RING 의 해당 구간으로 그대로 스냅해서 지도
//   테두리와 정확히 겹치게 하고, 다른 구와 맞닿은 내부 경계만 Chaikin's corner-cutting 으로 다듬는다.
const OUTER_SNAP_DEG = 0.006 // 대전 외곽선과 "같은 지점"으로 볼 거리 임계값(약 600m)

function nearestOnRing(point, ring) {
  let bestIndex = 0
  let bestDist = Infinity
  for (let i = 0; i < ring.length; i++) {
    const dLat = point[0] - ring[i][0]
    const dLng = point[1] - ring[i][1]
    const d = dLat * dLat + dLng * dLng
    if (d < bestDist) {
      bestDist = d
      bestIndex = i
    }
  }
  return { index: bestIndex, dist: Math.sqrt(bestDist) }
}

// 닫힌 링 위 두 인덱스 사이, 더 짧은 쪽 호(arc)의 점들을 반환.
function ringArcBetween(ring, i, j) {
  const n = ring.length
  const fwd = (j - i + n) % n
  const bwd = (i - j + n) % n
  const out = []
  if (fwd <= bwd) {
    for (let k = 0; k <= fwd; k++) out.push(ring[(i + k) % n])
  } else {
    for (let k = 0; k <= bwd; k++) out.push(ring[(i - k + n) % n])
  }
  return out
}

// 열린 점열용 Chaikin's corner-cutting — 양 끝점은 고정하고 안쪽 모서리만 깎는다.
function chaikinOpen(points, iterations = 3) {
  let pts = points
  for (let it = 0; it < iterations && pts.length >= 3; it++) {
    const next = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]
      const p1 = pts[i + 1]
      next.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]])
      next.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]])
    }
    next.push(pts[pts.length - 1])
    pts = next
  }
  return pts
}

// 구 이름 → (대전 외곽 스냅 + 내부 경계 스무딩 완료된) 좌표 배열. 구는 5개뿐이라 1회 계산 후 캐시.
const smoothedDistrictCache = new Map()
function getSmoothedDistrict(name) {
  if (smoothedDistrictCache.has(name)) return smoothedDistrictCache.get(name)
  const raw = DISTRICT_RINGS[name]
  const first = raw[0]
  const last = raw[raw.length - 1]
  const ring = first[0] === last[0] && first[1] === last[1] ? raw.slice(0, -1) : raw
  const n = ring.length

  const matches = ring.map((p) => nearestOnRing(p, DAEJEON_RING))
  const isOuter = matches.map((m) => m.dist < OUTER_SNAP_DEG)

  let result
  if (!isOuter.some(Boolean) || isOuter.every(Boolean)) {
    // 방어적 폴백: 전부 내부거나 전부 외곽이면(있을 수 없지만) 구간 분리 없이 통째로 다듬는다.
    result = chaikinOpen([...ring, ring[0]], 3)
  } else {
    // outer/inner 가 바뀌는 지점에서 시작하도록 회전시켜 구간을 단순하게 나눌 수 있게 한다.
    let startIdx = 0
    for (let k = 0; k < n; k++) {
      if (isOuter[k] !== isOuter[(k - 1 + n) % n]) {
        startIdx = k
        break
      }
    }
    const out = []
    let i = startIdx
    let visited = 0
    let isFirstSeg = true
    while (visited < n) {
      const type = isOuter[i]
      const idxs = [i]
      let steps = 1
      while (steps < n && isOuter[(i + steps) % n] === type) {
        idxs.push((i + steps) % n)
        steps++
      }
      const seg = type
        ? ringArcBetween(DAEJEON_RING, matches[idxs[0]].index, matches[idxs[idxs.length - 1]].index)
        : chaikinOpen(idxs.map((k) => ring[k]), 3)
      out.push(...(isFirstSeg ? seg : seg.slice(1)))
      isFirstSeg = false
      i = (i + steps) % n
      visited += steps
    }
    result = out
  }
  smoothedDistrictCache.set(name, result)
  return result
}

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
      const path = getSmoothedDistrict(highlightDistrict).map(([lat, lng]) => new kakao.maps.LatLng(lat, lng))
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
