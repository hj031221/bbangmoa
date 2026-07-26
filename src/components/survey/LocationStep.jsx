import { useEffect, useRef, useState } from 'react'
import { useKakaoLoader } from '../../hooks/useKakaoLoader'
import { getRegion } from '../../config/regions'
import { useAppStore } from '../../store/useAppStore'

// 설문 0단계 — 출발 위치 선택 (① 프리셋 ② GPS ③ 지도에서 직접 찍기).
// 여기서 고른 정밀 origin 이 결과(거리·정렬)로 흐른다. 선택 즉시 onDone 으로 다음 단계.
export default function LocationStep({ onDone }) {
  const regionId = useAppStore((s) => s.regionId)
  const region = getRegion(regionId)
  const setOrigin = useAppStore((s) => s.setOrigin)
  const [pickOpen, setPickOpen] = useState(false)
  const [gpsMsg, setGpsMsg] = useState('')

  const choose = (origin) => {
    setOrigin(origin)
    onDone?.()
  }

  const useGps = () => {
    if (!navigator.geolocation) {
      setGpsMsg('이 브라우저는 위치를 지원하지 않아요. 아래에서 골라주세요.')
      return
    }
    setGpsMsg('위치 확인 중…')
    navigator.geolocation.getCurrentPosition(
      (p) =>
        choose({ lat: p.coords.latitude, lng: p.coords.longitude, label: '현재 위치', source: 'gps' }),
      () => setGpsMsg('위치를 못 받았어요. 아래 출발지를 골라주세요.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return (
    <div className="survey-step">
      <h2 className="survey-question">어디서 출발하세요?</h2>
      <p className="loc-sub">추천 빵집까지 거리를 알려드리려면 위치가 필요해요.</p>

      <button type="button" className="loc-gps" onClick={useGps}>
        📍 현재 위치 사용
      </button>
      {gpsMsg && <p className="loc-msg">{gpsMsg}</p>}

      <div className="loc-or">또는 출발지 선택</div>
      <div className="loc-chips">
        {region.origins.map((o) => (
          <button
            key={o.id}
            type="button"
            className="loc-chip"
            onClick={() => choose({ lat: o.lat, lng: o.lng, label: o.name, source: 'preset' })}
          >
            {o.label}
          </button>
        ))}
      </div>

      <button type="button" className="loc-pick-toggle" onClick={() => setPickOpen((v) => !v)}>
        🗺️ {pickOpen ? '지도 접기' : '지도에서 직접 찍기'}
      </button>
      {pickOpen && (
        <PickMap
          region={region}
          onPick={(lat, lng) => choose({ lat, lng, label: '지도에서 선택', source: 'pick' })}
        />
      )}
    </div>
  )
}

// 클릭으로 출발지를 찍는 미니 지도. 대전 안/밖 어디든 가능.
function PickMap({ region, onPick }) {
  const { loaded } = useKakaoLoader()
  const ref = useRef(null)
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    if (!loaded || !ref.current) return
    const { kakao } = window
    const map = new kakao.maps.Map(ref.current, {
      center: new kakao.maps.LatLng(region.center.lat, region.center.lng),
      level: 6,
    })
    const marker = new kakao.maps.Marker()
    kakao.maps.event.addListener(map, 'click', (e) => {
      const ll = e.latLng
      marker.setPosition(ll)
      marker.setMap(map)
      setPicked({ lat: ll.getLat(), lng: ll.getLng() })
    })
  }, [loaded, region])

  return (
    <div className="loc-pickwrap">
      <div ref={ref} className="loc-pickmap" />
      <button
        type="button"
        className="loc-confirm"
        disabled={!picked}
        onClick={() => picked && onPick(picked.lat, picked.lng)}
      >
        이 위치로 시작 →
      </button>
    </div>
  )
}
