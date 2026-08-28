import { useEffect, useRef, useState } from 'react'
import { useKakaoLoader } from '../../hooks/useKakaoLoader'
import { getRegion } from '../../config/regions'
import { useAppStore } from '../../store/useAppStore'
import { searchPlace } from '../../api'

// 설문 0단계 — 출발 위치 선택. 카카오맵 길찾기 출발지 화면 톤: 검색바가 최상단 고정 →
// 그 아래 큰 지도(클릭해서 직접 찍기도 가능) → 검색 중엔 지도 위로 결과 리스트가 덮인다.
// 프리셋(대전역 등)은 지도 아래 작은 칩으로.
//
// 여기서 고른 origin이 결과(거리·정렬)로 흐르고, "대전한바퀴" 코스 저장 시 DB에도 들어간다.
// GPS(자동 취득 개인위치정보)는 화면 계산에만 쓰고, 저장 시엔 가장 가까운 프리셋으로 치환해
// 원본 좌표가 서버로 나가지 않게 막는다(originPrivacy.js) — 위치정보법상 "서버로 전송하는
// 자체만으로" 신고 대상이 될 수 있다는 기준(위치정보지원센터 안내) 때문(#39).
export default function LocationStep({ onDone }) {
  const regionId = useAppStore((s) => s.regionId)
  const region = getRegion(regionId)
  const setOrigin = useAppStore((s) => s.setOrigin)

  const choose = (origin) => {
    setOrigin(origin)
    onDone?.()
  }

  const [gpsMsg, setGpsMsg] = useState('')
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

  // 검색 (장소명/주소 → 카카오 키워드 검색, 300ms 디바운스)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const reqId = useRef(0)
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const id = ++reqId.current
    const timer = setTimeout(() => {
      searchPlace(query)
        .then((docs) => {
          if (reqId.current === id) setResults(docs)
        })
        .catch(() => {
          if (reqId.current === id) setResults([])
        })
        .finally(() => {
          if (reqId.current === id) setSearching(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // 지도 — 직접 클릭해서 찍기(핀 표시 후 확정 버튼)
  const mapRef = useRef(null)
  const { loaded } = useKakaoLoader()
  const markerRef = useRef(null)
  const [picked, setPicked] = useState(null)
  useEffect(() => {
    if (!loaded || !mapRef.current) return
    const { kakao } = window
    const map = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(region.center.lat, region.center.lng),
      level: 6,
    })
    const marker = new kakao.maps.Marker()
    markerRef.current = marker
    kakao.maps.event.addListener(map, 'click', (e) => {
      const ll = e.latLng
      marker.setPosition(ll)
      marker.setMap(map)
      setPicked({ lat: ll.getLat(), lng: ll.getLng() })
    })
  }, [loaded, region])

  return (
    <div className="survey-step">
      <h2 className="survey-question">어디서 출발하세요?</h2>
      <p className="loc-sub">추천 빵집까지 거리를 알려드리려면 위치가 필요해요.</p>

      <div className="loc-map-step">
        <div className="loc-map-searchbar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m16 16 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="장소명·주소로 출발지 검색"
            aria-label="출발지 검색"
          />
          {query.trim() && (
            <button type="button" className="loc-map-clear" onClick={() => setQuery('')} aria-label="지우기">
              ✕
            </button>
          )}
          <button type="button" className="loc-map-gps" onClick={useGps}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>현재 위치</span>
          </button>
        </div>
        {gpsMsg && <p className="loc-msg">{gpsMsg}</p>}

        <div className="loc-map-wrap">
          <div className="loc-map-canvas" ref={mapRef} />
          {query.trim() && (
            <div className="loc-map-results">
              {searching && <div className="loc-map-empty">검색 중…</div>}
              {!searching && results.length === 0 && (
                <div className="loc-map-empty">검색 결과가 없어요.</div>
              )}
              {!searching &&
                results.map((r, i) => (
                  <button
                    key={`${r.name}-${i}`}
                    type="button"
                    className="loc-map-result-row"
                    onClick={() => choose({ lat: r.lat, lng: r.lng, label: r.name, source: 'search' })}
                  >
                    <span className="loc-map-result-name">{r.name}</span>
                    {r.address && <span className="loc-map-result-addr">{r.address}</span>}
                  </button>
                ))}
            </div>
          )}
          {!query.trim() && picked && (
            <button
              type="button"
              className="loc-map-confirm"
              onClick={() => choose({ lat: picked.lat, lng: picked.lng, label: '지도에서 선택', source: 'pick' })}
            >
              이 위치로 시작 →
            </button>
          )}
        </div>

        <p className="loc-map-gps-notice">GPS 위치는 저장되지 않아요 — 코스를 저장하면 가까운 지점으로 표시돼요.</p>

        <div className="loc-map-presets">
          {region.origins.map((o) => (
            <button
              key={o.id}
              type="button"
              className="loc-map-preset-pill"
              onClick={() => choose({ lat: o.lat, lng: o.lng, label: o.name, source: 'preset' })}
            >
              {o.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
