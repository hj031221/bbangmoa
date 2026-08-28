import { useEffect, useRef } from 'react'

// 외부 API(카카오/관광공사) 가게명을 CustomOverlay HTML 에 그대로 꽂아 넣으므로 이스케이프.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 빵모아 로고 마커 — 로고 원본 벡터 path 그대로 (코랄 물방울 핀 + 윗면 3-혹 흰 빵).
const PIN_D =
  'M99.78 40.39C97.37 17.71 78.24 0.04 55 0.04 54.54 0.04 54.09 0.04 53.64 0.06 19.84 1.06-.01 38.81 17.47 67.86 26.11 82.23 40.17 105.61 48.41 119.3 51.4 124.28 58.6 124.28 61.59 119.3 70.34 104.75 85.67 79.27 94.08 65.27 98.58 57.8 100.7 49.07 99.78 40.39Z'
const BREAD_D =
  'M69.84 30.27C66.68 30.27 63.95 32.13 62.68 34.81 61.41 32.13 58.68 30.27 55.52 30.27 52.34 30.27 49.59 32.16 48.33 34.88 47.08 32.16 44.33 30.27 41.14 30.27 36.77 30.27 33.22 33.82 33.22 38.21L33.22 52.04C33.22 54.72 35.39 56.89 38.06 56.89L72.92 56.89C75.59 56.89 77.76 54.72 77.76 52.04L77.76 38.21C77.76 33.82 74.21 30.27 69.84 30.27Z'
function svgPin({ w, h, stroke }) {
  const strokeAttr = stroke ? " stroke='#fff' stroke-width='7' stroke-linejoin='round'" : ''
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 100.7 124.3'>` +
    `<path d='${PIN_D}' fill='#F97658'${strokeAttr}/>` +
    `<path d='${BREAD_D}' fill='#fff'/>` +
    `</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// 로고 핀 MarkerImage 생성. viewBox 100.7×124.3 → 세로/가로 비 1.234, 핀 끝(tip) x≈0.546·w, y=h.
function buildPinImage(kakao, { w, stroke }) {
  const h = Math.round(w * 1.234)
  return new kakao.maps.MarkerImage(svgPin({ w, h, stroke }), new kakao.maps.Size(w, h), {
    offset: new kakao.maps.Point(Math.round(w * 0.546), h),
  })
}

// 빵집 마커 레이어 (렌더 출력 없음, 지도에 마커만 부착).
// - bakeries 가 바뀌면 마커를 다시 그림.
// - clusterer 가 있으면 클러스터러에 묶고(줌아웃=묶음/줌인=개별), 없으면 개별 setMap.
// - selectedId 가 있으면: 줌인 + panTo + 말풍선 + "나머지 마커는 흐리게(딤)".
export default function MarkerLayer({ map, bakeries, selectedId, onSelect, clusterer }) {
  const markersRef = useRef([]) // [{ id, marker, pos }]
  const infoRef = useRef(null)
  const imagesRef = useRef(null) // { normal, selected } 마커 이미지 (kakao 로드 후 1회 생성)

  // 마커 렌더
  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map) return
    const t0 = performance.now()

    // 이전 마커 정리
    if (clusterer) clusterer.clear()
    markersRef.current.forEach((m) => m.marker.setMap(null))
    markersRef.current = []
    // 카카오 기본 InfoWindow 는 자체 여백/테두리를 강제로 씌워 짧은 이름일수록 빈 공간이 커진다.
    // CustomOverlay 는 우리가 만든 DOM 을 그대로 쓰므로 텍스트 길이에 맞게 박스가 줄고 사이트 톤도 입힐 수 있다.
    if (!infoRef.current) {
      infoRef.current = new kakao.maps.CustomOverlay({ zIndex: 30, yAnchor: 1.4 })
    }
    if (!imagesRef.current) {
      imagesRef.current = {
        normal: buildPinImage(kakao, { w: 30, stroke: false }),
        selected: buildPinImage(kakao, { w: 44, stroke: true }),
      }
    }

    const next = []
    bakeries.forEach((b) => {
      if (!b.lat || !b.lng) return
      const pos = new kakao.maps.LatLng(b.lat, b.lng)
      // 클러스터 모드에선 map 을 주지 않는다(클러스터러가 표시 관리). 개별 모드에선 직접 부착.
      const marker = new kakao.maps.Marker({
        position: pos,
        map: clusterer ? undefined : map,
        title: b.name,
        image: imagesRef.current.normal,
      })
      kakao.maps.event.addListener(marker, 'click', () => onSelect?.(b.id))
      next.push({ id: b.id, marker, pos })
    })
    markersRef.current = next

    // 클러스터러에 일괄 추가 (배치 — 360개도 빠름)
    if (clusterer) clusterer.addMarkers(next.map((m) => m.marker))

    console.log(
      `[markers] ${next.length}개 생성 ${Math.round(performance.now() - t0)}ms` +
        (clusterer ? ' (클러스터링)' : ' (개별)'),
    )

    return () => {
      if (clusterer) clusterer.clear()
      markersRef.current.forEach((m) => m.marker.setMap(null))
      markersRef.current = []
    }
  }, [map, bakeries, onSelect, clusterer])

  // 지도의 빈 영역(마커·오버레이가 아닌 곳)을 클릭하면 선택 해제. 카카오에서 마커 click 은
  // map click 으로 전파되지 않으므로 마커 선택과 충돌하지 않는다.
  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map) return
    const handleMapClick = () => onSelect?.(null)
    kakao.maps.event.addListener(map, 'click', handleMapClick)
    return () => kakao.maps.event.removeListener(map, 'click', handleMapClick)
  }, [map, onSelect])

  // 선택 동작: 줌인 + 포커스 + 나머지 흐리게
  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map) return

    const sel = markersRef.current.find((m) => m.id === selectedId)

    // 선택 없으면 전부 또렷, 선택 있으면 선택만 또렷 + 나머지는 살짝 딤(너무 흐리면 안 보여서 0.45).
    markersRef.current.forEach((m) => {
      const isSel = m.id === selectedId
      const lit = !selectedId || isSel
      m.marker.setOpacity(lit ? 1 : 0.45)
      m.marker.setZIndex(isSel ? 10 : 1)
      if (imagesRef.current) {
        m.marker.setImage(isSel ? imagesRef.current.selected : imagesRef.current.normal)
      }
    })

    if (sel) {
      map.setLevel(4) // 확대
      map.panTo(sel.pos) // 그 빵집으로 이동
      const name = bakeries.find((x) => x.id === selectedId)?.name || ''
      infoRef.current.setContent(
        `<div class="map-label"><span class="map-label-text">${escapeHtml(name)}</span></div>`,
      )
      infoRef.current.setPosition(sel.pos)
      infoRef.current.setMap(map)
    } else if (infoRef.current) {
      infoRef.current.setMap(null)
    }
  }, [map, selectedId, bakeries])

  return null
}
