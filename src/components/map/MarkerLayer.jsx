import { useEffect, useRef } from 'react'

// 빵집 마커 레이어 (렌더 출력 없음, 지도에 마커만 부착).
// - bakeries 가 바뀌면 마커를 다시 그림.
// - clusterer 가 있으면 클러스터러에 묶고(줌아웃=묶음/줌인=개별), 없으면 개별 setMap.
// - selectedId 가 있으면: 줌인 + panTo + 말풍선 + "나머지 마커는 흐리게(딤)".
export default function MarkerLayer({ map, bakeries, selectedId, onSelect, clusterer }) {
  const markersRef = useRef([]) // [{ id, marker, pos }]
  const infoRef = useRef(null)

  // 마커 렌더
  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map) return
    const t0 = performance.now()

    // 이전 마커 정리
    if (clusterer) clusterer.clear()
    markersRef.current.forEach((m) => m.marker.setMap(null))
    markersRef.current = []
    if (!infoRef.current) infoRef.current = new kakao.maps.InfoWindow({ zIndex: 1 })

    const next = []
    bakeries.forEach((b) => {
      if (!b.lat || !b.lng) return
      const pos = new kakao.maps.LatLng(b.lat, b.lng)
      // 클러스터 모드에선 map 을 주지 않는다(클러스터러가 표시 관리). 개별 모드에선 직접 부착.
      const marker = new kakao.maps.Marker({
        position: pos,
        map: clusterer ? undefined : map,
        title: b.name,
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
