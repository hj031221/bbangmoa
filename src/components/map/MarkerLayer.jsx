import { useEffect, useRef } from 'react'

// 빵집 마커 레이어 (렌더 출력 없음, 지도에 마커만 부착).
// - bakeries 가 바뀌면 마커를 다시 그림.
// - selectedId 가 있으면: 줌인 + panTo + 말풍선 + "나머지 마커는 흐리게(딤)".
export default function MarkerLayer({ map, bakeries, selectedId, onSelect }) {
  const markersRef = useRef([]) // [{ id, marker, pos }]
  const infoRef = useRef(null)

  // 마커 렌더
  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map) return

    markersRef.current.forEach((m) => m.marker.setMap(null))
    markersRef.current = []
    if (!infoRef.current) infoRef.current = new kakao.maps.InfoWindow({ zIndex: 1 })

    bakeries.forEach((b) => {
      if (!b.lat || !b.lng) return
      const pos = new kakao.maps.LatLng(b.lat, b.lng)
      const marker = new kakao.maps.Marker({ position: pos, map, title: b.name })
      kakao.maps.event.addListener(marker, 'click', () => onSelect?.(b.id))
      markersRef.current.push({ id: b.id, marker, pos })
    })

    return () => {
      markersRef.current.forEach((m) => m.marker.setMap(null))
      markersRef.current = []
    }
  }, [map, bakeries, onSelect])

  // 선택 동작: 줌인 + 포커스 + 나머지 흐리게
  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map) return

    const sel = markersRef.current.find((m) => m.id === selectedId)

    // 선택 없으면 전부 또렷, 선택 있으면 선택만 또렷 + 나머지 딤
    markersRef.current.forEach((m) => {
      const lit = !selectedId || m.id === selectedId
      m.marker.setOpacity(lit ? 1 : 0.25)
      m.marker.setZIndex(m.id === selectedId ? 10 : 1)
    })

    if (sel) {
      map.setLevel(4) // 확대
      map.panTo(sel.pos) // 그 빵집으로 이동
      const name = bakeries.find((x) => x.id === selectedId)?.name || ''
      infoRef.current.setContent(
        `<div style="padding:6px 10px;font-size:13px;font-weight:700;color:#4A3520;">${name}</div>`,
      )
      infoRef.current.open(map, sel.marker)
    } else if (infoRef.current) {
      infoRef.current.close()
    }
  }, [map, selectedId, bakeries])

  return null
}
