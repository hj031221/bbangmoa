import { useEffect, useRef } from 'react'

// 빵모아 로고 마커 — 로고 원본 벡터 path 그대로 (코랄 물방울 핀 + 윗면 3-혹 흰 빵).
const PIN_D =
  'M99.78 40.39C97.37 17.71 78.24 0.04 55 0.04 54.54 0.04 54.09 0.04 53.64 0.06 19.84 1.06-.01 38.81 17.47 67.86 26.11 82.23 40.17 105.61 48.41 119.3 51.4 124.28 58.6 124.28 61.59 119.3 70.34 104.75 85.67 79.27 94.08 65.27 98.58 57.8 100.7 49.07 99.78 40.39Z'
const BREAD_D =
  'M69.84 30.27C66.68 30.27 63.95 32.13 62.68 34.81 61.41 32.13 58.68 30.27 55.52 30.27 52.34 30.27 49.59 32.16 48.33 34.88 47.08 32.16 44.33 30.27 41.14 30.27 36.77 30.27 33.22 33.82 33.22 38.21L33.22 52.04C33.22 54.72 35.39 56.89 38.06 56.89L72.92 56.89C75.59 56.89 77.76 54.72 77.76 52.04L77.76 38.21C77.76 33.82 74.21 30.27 69.84 30.27Z'
// 순위 배지(2차 개편) — 핀 머리 오른쪽 위에 얹는 작은 흰 원 + 코랄 숫자. 랭킹이 아니라
// 리스트 항목과 지도 핀을 대조하기 위한 인덱스라, 눈에 띄되 로고 핀 자체보다는 작게 둔다.
function badgeMarkup(number) {
  if (!number) return ''
  return (
    `<circle cx='82' cy='24' r='19' fill='#fff' stroke='#F97658' stroke-width='4'/>` +
    `<text x='82' y='25' text-anchor='middle' dominant-baseline='central' font-family='sans-serif' font-weight='700' font-size='22' fill='#F97658'>${number}</text>`
  )
}

function svgPin({ w, h, stroke, number }) {
  const strokeAttr = stroke ? " stroke='#fff' stroke-width='7' stroke-linejoin='round'" : ''
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 100.7 124.3'>` +
    `<path d='${PIN_D}' fill='#F97658'${strokeAttr}/>` +
    `<path d='${BREAD_D}' fill='#fff'/>` +
    badgeMarkup(number) +
    `</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// 로고 핀 MarkerImage 생성. viewBox 100.7×124.3 → 세로/가로 비 1.234, 핀 끝(tip) x≈0.546·w, y=h.
function buildPinImage(kakao, { w, stroke, number }) {
  const h = Math.round(w * 1.234)
  return new kakao.maps.MarkerImage(svgPin({ w, h, stroke, number }), new kakao.maps.Size(w, h), {
    offset: new kakao.maps.Point(Math.round(w * 0.546), h),
  })
}

// 빵집 마커 레이어 (렌더 출력 없음, 지도에 마커만 부착).
// - bakeries 가 바뀌면 마커를 다시 그림.
// - clusterer 가 있으면 클러스터러에 묶고(줌아웃=묶음/줌인=개별), 없으면 개별 setMap.
// - selectedId 가 있으면: 줌인 + panTo + 말풍선 + "나머지 마커는 흐리게(딤)".
// - rankById(2차 개편): bakery id → 순위 배지 번호의 Map. 리스트(BakeryMapPage)가 좌표 있는
//   항목만 세어서 만들어 넘긴다 — 여기서 배열 인덱스로 다시 계산하면 좌표 없어 마커 자체를
//   못 그리는 항목이 번호를 하나 먹어버려 "리스트엔 있는데 지도엔 없는 번호"가 생긴다(코드
//   리뷰 지적). null/undefined면 아무 마커에도 안 붙는다(MapResult 등 다른 화면 영향 없음).
export default function MarkerLayer({ map, bakeries, selectedId, onSelect, clusterer, rankById = null }) {
  const markersRef = useRef([]) // [{ id, marker, pos, rank }]
  const infoRef = useRef(null)
  const imagesRef = useRef(null) // { normal, selected, numbered:Map<number,{normal,selected}> }

  // 번호별 마커 이미지를 필요한 것만 그때그때 만들어 캐싱한다(kakao MarkerImage 생성 비용을
  // rankById 크기만큼만 쓰고, 기능 자체를 안 쓰는 화면은 0개).
  const getNumberedImages = (number) => {
    if (!imagesRef.current.numbered.has(number)) {
      const { kakao } = window
      imagesRef.current.numbered.set(number, {
        normal: buildPinImage(kakao, { w: 30, stroke: false, number }),
        selected: buildPinImage(kakao, { w: 44, stroke: true, number }),
      })
    }
    return imagesRef.current.numbered.get(number)
  }

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
        numbered: new Map(),
      }
    }

    const next = []
    bakeries.forEach((b) => {
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return
      const rank = rankById?.get(b.id) ?? null
      const pos = new kakao.maps.LatLng(b.lat, b.lng)
      const images = rank ? getNumberedImages(rank) : imagesRef.current
      // 클러스터 모드에선 map 을 주지 않는다(클러스터러가 표시 관리). 개별 모드에선 직접 부착.
      const marker = new kakao.maps.Marker({
        position: pos,
        map: clusterer ? undefined : map,
        title: b.name,
        image: images.normal,
      })
      kakao.maps.event.addListener(marker, 'click', () => onSelect?.(b.id))
      next.push({ id: b.id, marker, pos, rank })
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
  }, [map, bakeries, onSelect, clusterer, rankById])

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
        const images = m.rank ? getNumberedImages(m.rank) : imagesRef.current
        m.marker.setImage(isSel ? images.selected : images.normal)
      }
    })

    if (sel) {
      map.setLevel(4) // 확대
      map.panTo(sel.pos) // 그 빵집으로 이동
      const name = bakeries.find((x) => x.id === selectedId)?.name || ''
      const label = document.createElement('div')
      label.className = 'map-label'
      const labelText = document.createElement('span')
      labelText.className = 'map-label-text'
      labelText.textContent = name
      label.appendChild(labelText)
      // CustomOverlay DOM 이벤트는 지도까지 전파되므로 말풍선을 누른 것이
      // "빈 지도 클릭"으로 처리되어 선택이 풀리지 않게 막는다.
      label.addEventListener('mousedown', kakao.maps.event.preventMap)
      label.addEventListener('touchstart', kakao.maps.event.preventMap)
      infoRef.current.setContent(label)
      infoRef.current.setPosition(sel.pos)
      infoRef.current.setMap(map)
    } else if (infoRef.current) {
      infoRef.current.setMap(null)
    }
  }, [map, selectedId, bakeries])

  return null
}
