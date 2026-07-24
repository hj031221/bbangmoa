import { useEffect, useState } from 'react'
import { reverseGeocode, kakaoLocalEnabled } from '../api'

// 브라우저 GPS 로 현재 위치를 얻고, 가능하면 행정구역명(예: "대전광역시 유성구")까지 붙여준다.
//
// status: 'loading' | 'ready' | 'denied' | 'unsupported'
// coords: { lat, lng } | null
// label : 행정구역명 문자열 | null (역지오코딩 실패/키 미설정 시 null)
export function useCurrentLocation() {
  const [state, setState] = useState({ status: 'loading', coords: null, label: null })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ status: 'unsupported', coords: null, label: null })
      return
    }

    let alive = true
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive) return
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setState({ status: 'ready', coords, label: null })
        if (kakaoLocalEnabled()) {
          reverseGeocode(coords.lat, coords.lng)
            .then((label) => alive && label && setState((s) => ({ ...s, label })))
            .catch(() => {})
        }
      },
      () => {
        if (alive) setState({ status: 'denied', coords: null, label: null })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )

    return () => {
      alive = false
    }
  }, [])

  return state
}
