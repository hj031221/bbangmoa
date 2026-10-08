import { useEffect, useState } from 'react'

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
    setState({ status: 'loading', coords: null })
    const id = geo.watchPosition(
      (pos) => {
        if (!active) return
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        const coords = { lat, lng, accuracy, timestamp: pos.timestamp }
        // 화면은 마지막 측위를 유지한다. 시간/기기 시계 차이는 저장할 때만 검사한다.
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        setState({ status: 'ready', coords })
      },
      (err) => {
        if (!active) return
        if (err?.code === 1) setState({ status: 'denied', coords: null })
        else setState((previous) => previous.coords ? previous : { status: 'unavailable', coords: null })
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
    return () => {
      active = false
      geo.clearWatch(id)
    }
  }, [enabled, retryKey])

  return enabled ? state : { status: 'idle', coords: null }
}
