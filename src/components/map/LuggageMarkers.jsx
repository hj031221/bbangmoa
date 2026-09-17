import { useEffect } from 'react'
import { formatDistance } from '../../lib/distance'

// Separate suitcase markers keep nearby lockers distinct from bakery pins.
export default function LuggageMarkers({ map, lockers }) {
  useEffect(() => {
    if (!map || !lockers.length) return
    const { kakao } = window
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="0 0 34 40"><path d="M17 39 7 29a16 16 0 1 1 20 0Z" fill="#705945" stroke="white" stroke-width="2"/><g fill="none" stroke="white" stroke-width="1.7"><rect x="9" y="12" width="16" height="15" rx="3"/><path d="M13 12V9h8v3M13 16v7m8-7v7"/></g></svg>`
    const image = new kakao.maps.MarkerImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), new kakao.maps.Size(34, 40), { offset: new kakao.maps.Point(17, 40) })
    const info = new kakao.maps.InfoWindow({ removable: true })
    const markers = lockers.map((locker) => {
      const marker = new kakao.maps.Marker({ map, position: new kakao.maps.LatLng(locker.lat, locker.lng), image, title: locker.name, zIndex: 5 })
      const onClick = () => {
        const label = document.createElement('div')
        label.className = 'bm-locker-map-label'
        label.textContent = locker.name + ' · 직선 ' + formatDistance(locker.km)
        info.setContent(label)
        info.open(map, marker)
      }
      kakao.maps.event.addListener(marker, 'click', onClick)
      return { marker, onClick }
    })
    return () => {
      info.close()
      markers.forEach(({ marker, onClick }) => {
        kakao.maps.event.removeListener(marker, 'click', onClick)
        marker.setMap(null)
      })
    }
  }, [map, lockers])
  return null
}
