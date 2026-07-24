import { useEffect, useRef } from 'react'

// 외부 API(카카오/관광공사) 가게명을 CustomOverlay HTML 에 그대로 꽂아 넣으므로 이스케이프.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 카카오 기본 마커(파란 핀) 대신 쓸 작은 원형 점 마커. 사이트 팔레트 색으로 직접 그린 SVG.
function buildDotImage(kakao, { size, fill, ringWidth = 2.5 }) {
  const r = size / 2 - ringWidth
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='${fill}' stroke='#fff' stroke-width='${ringWidth}'/></svg>`
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  // offset 을 중심으로 잡아 좌표가 원의 중앙에 오게 (기본 핀처럼 아래 뾰족한 끝이 아니라 점 자체가 위치)
  return new kakao.maps.MarkerImage(src, new kakao.maps.Size(size, size), {
    offset: new kakao.maps.Point(size / 2, size / 2),
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
        normal: buildDotImage(kakao, { size: 16, fill: '#F2814A' }),
        selected: buildDotImage(kakao, { size: 22, fill: '#E06B34', ringWidth: 3 }),
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

  // 선택 동작: 줌인 + 포커스 + 나머지 흐리게
  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map) return

    const sel = markersRef.current.find((m) => m.id === selectedId)

    // 선택 없으면 전부 또렷, 선택 있으면 선택만 또렷 + 나머지 딤. 선택된 점은 더 크게.
    markersRef.current.forEach((m) => {
      const isSel = m.id === selectedId
      const lit = !selectedId || isSel
      m.marker.setOpacity(lit ? 1 : 0.25)
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
