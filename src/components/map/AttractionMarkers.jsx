import { useEffect, useRef } from 'react'

// 가까운 관광지 마커 (빵집과 구분되는 초록 핀). 클러스터 안 함 → 지도에서 항상 보임.
//   attractions: [{ name, lat, lng }]  (빵집별 최근접 관광지의 중복 제거 목록)
function attractionPin(kakao) {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='30' viewBox='0 0 24 30'>" +
    "<path d='M12 0C5.4 0 0 5 0 11.6 0 20 12 30 12 30S24 20 24 11.6C24 5 18.6 0 12 0Z' fill='#2E9E6B' stroke='#fff' stroke-width='1.5'/>" +
    "<circle cx='12' cy='11.5' r='4.5' fill='#fff'/></svg>"
  return new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
    new kakao.maps.Size(24, 30),
    { offset: new kakao.maps.Point(12, 30) },
  )
}

export default function AttractionMarkers({ map, attractions = [] }) {
  const markersRef = useRef([])
  const infoRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    const { kakao } = window
    if (!kakao || !map) return
    if (!imgRef.current) imgRef.current = attractionPin(kakao)
    if (!infoRef.current) infoRef.current = new kakao.maps.InfoWindow({ zIndex: 3 })

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = attractions
      .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng))
      .map((a) => {
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(a.lat, a.lng),
          image: imgRef.current,
          map,
          title: a.name,
          zIndex: 2,
        })
        kakao.maps.event.addListener(marker, 'click', () => {
          infoRef.current.setContent(
            `<div style="padding:5px 9px;font-size:12px;color:#1c6b48;white-space:nowrap;">📸 <b>${a.name}</b></div>`,
          )
          infoRef.current.open(map, marker)
        })
        return marker
      })

    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
    }
  }, [map, attractions])

  return null
}
