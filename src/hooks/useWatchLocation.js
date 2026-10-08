import { useEffect, useState } from 'react'
import { isFreshVisitLocation, VISIT_LOCATION_MAX_AGE_MS } from '../lib/visitLocation'

// 지도용 실시간 내 위치. enabled가 true인 동안만 watchPosition으로 따라간다 — 지도에 들어오자마자
// 권한 팝업을 띄우지 않으려고 호출 쪽이 "내 위치 버튼" 또는 "빵집 선택" 시점에 켠다.
// retryKey가 바뀌면 다시 요청한다(거부 후 버튼을 다시 눌렀을 때).
//
// status: 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable' | 'unsupported'
// coords: { lat, lng, accuracy, timestamp } | null
export function useWatchLocation(enabled, retryKey = 0) {
  const [state, setState] = useState({ status: 'idle', coords: null })

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', coords: null })
      return
    }
    const geo = globalThis.navigator?.geolocation
    if (typeof geo?.watchPosition !== 'function') {
      setState({ status: 'unsupported', coords: null })
      return
    }
    let active = true
    let expiryTimer
    setState({ status: 'loading', coords: null })
    const id = geo.watchPosition(
      (pos) => {
        if (!active) return
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        const coords = { lat, lng, accuracy, timestamp: pos.timestamp }
        if (!isFreshVisitLocation(coords)) return
        clearTimeout(expiryTimer)
        setState({ status: 'ready', coords })
        expiryTimer = setTimeout(() => {
          if (active) setState({ status: 'unavailable', coords: null })
        }, Math.max(0, coords.timestamp + VISIT_LOCATION_MAX_AGE_MS - Date.now()))
      },
      (err) => {
        if (!active) return
        clearTimeout(expiryTimer)
        setState({ status: err?.code === 1 ? 'denied' : 'unavailable', coords: null })
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
    return () => {
      active = false
      clearTimeout(expiryTimer)
      geo.clearWatch(id)
    }
  }, [enabled, retryKey])

  return enabled ? state : { status: 'idle', coords: null }
}
