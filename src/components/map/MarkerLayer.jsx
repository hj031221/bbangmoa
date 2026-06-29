import { useEffect, useRef } from 'react'

// 빵집 마커 레이어 (렌더 출력 없음, 지도에 마커만 부착).
// bakeries 가 바뀌면 마커를 다시 그리고, selectedId 가 바뀌면 해당 위치로 panTo.
export default function MarkerLayer({ map, bakeries, selectedId, onSelect }) {
  const markersRef = useRef([])
  const infoRef = useRef(null)

  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map) return

    // 기존 마커 제거
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    if (!infoRef.current) infoRef.current = new kakao.maps.InfoWindow({ zIndex: 1 })

    const bounds = new kakao.maps.LatLngBounds()
    bakeries.forEach((b) => {
      if (!b.lat || !b.lng) return
      const pos = new kakao.maps.LatLng(b.lat, b.lng)
      const marker = new kakao.maps.Marker({ position: pos, map, title: b.name })
      kakao.maps.event.addListener(marker, 'click', () => {
        infoRef.current.setContent(
          `<div style="padding:6px 10px;font-size:13px;font-weight:600;">${b.name}</div>`,
        )
        infoRef.current.open(map, marker)
        onSelect?.(b.id)
      })
      markersRef.current.push(marker)
      bounds.extend(pos)
    })

    if (bakeries.some((b) => b.lat && b.lng)) map.setBounds(bounds)

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  }, [map, bakeries, onSelect])

  // 선택된 빵집으로 부드럽게 이동
  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map || !selectedId) return
    const b = bakeries.find((x) => x.id === selectedId)
    if (b?.lat && b?.lng) map.panTo(new kakao.maps.LatLng(b.lat, b.lng))
  }, [map, selectedId, bakeries])

  return null
}
