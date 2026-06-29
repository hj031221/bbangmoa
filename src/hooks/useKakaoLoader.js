import { useEffect, useState } from 'react'

// 카카오맵 JS SDK 를 동적으로 로드한다.
//  - libraries: services(주소검색), clusterer(마커클러스터) 미리 포함
//  - autoload=false + kakao.maps.load() 패턴으로 안전하게 초기화
// 반환: { loaded, error } — loaded 가 true 면 window.kakao.maps 사용 가능
const JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY
const SDK_ID = 'kakao-maps-sdk'

export function useKakaoLoader() {
  const [loaded, setLoaded] = useState(
    () => typeof window !== 'undefined' && !!window.kakao?.maps,
  )
  const [error, setError] = useState(null)

  useEffect(() => {
    if (loaded) return
    if (!JS_KEY) {
      setError(new Error('VITE_KAKAO_JS_KEY 가 설정되지 않았습니다.'))
      return
    }

    const onReady = () => window.kakao.maps.load(() => setLoaded(true))

    const existing = document.getElementById(SDK_ID)
    if (existing) {
      if (window.kakao?.maps) onReady()
      else existing.addEventListener('load', onReady)
      return
    }

    const script = document.createElement('script')
    script.id = SDK_ID
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&autoload=false&libraries=services,clusterer`
    script.addEventListener('load', onReady)
    script.addEventListener('error', () =>
      setError(new Error('카카오맵 SDK 로드 실패 (JS 키/도메인 등록 확인)')),
    )
    document.head.appendChild(script)
  }, [loaded])

  return { loaded, error }
}
