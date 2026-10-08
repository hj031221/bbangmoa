import { useEffect, useState } from 'react'

// 지도용 실시간 내 위치. enabled가 true인 동안만 watchPosition으로 따라간다 — 지도에 들어오자마자
// 권한 팝업을 띄우지 않으려고 호출 쪽이 "내 위치 버튼" 또는 "빵집 선택" 시점에 켠다.
// retryKey가 바뀌면 다시 요청한다(거부 후 버튼을 다시 눌렀을 때).
//
// status: 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable' | 'unsupported'
// coords: { lat, lng, accuracy } | null
export function useWatchLocation(enabled, retryKey = 0) {
  const [state, setState] = useState({ status: 'idle', coords: null })

  useEffect(() => {
    if (!enabled) return
    const geo = globalThis.navigator?.geolocation
    if (typeof geo?.watchPosition !== 'function') {
      setState({ status: 'unsupported', coords: null })
      return
    }
    setState((s) => (s.coords ? s : { status: 'loading', coords: null }))
    const id = geo.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        setState({ status: 'ready', coords: { lat, lng, accuracy } })
      },
      (err) => {
        // 타임아웃/일시적 실패는 마지막 위치를 유지한다. 권한 거부(code 1)만 상태를 바꾼다.
        if (err?.code === 1) setState({ status: 'denied', coords: null })
        else setState((s) => (s.coords ? s : { status: 'unavailable', coords: null }))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
    return () => geo.clearWatch(id)
  }, [enabled, retryKey])

  return state
}
