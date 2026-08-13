import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { useBakeries } from '../../hooks/useBakeries'
import { useKakaoLoader } from '../../hooks/useKakaoLoader'
import { pickBreadResult, matchBakeries } from '../../lib/breadRecommend'
import { getTourRecommendation, isTourSurveyComplete } from '../../lib/tourRecommend'
import { buildRoute, recalcRoute } from '../../lib/routePlan'
import { formatDistance } from '../../lib/distance'
import { supabase } from '../../lib/supabase'
import { TAGGED_ATTRACTIONS } from '../../data/tourAttractionTags'
import AddStopModal from './AddStopModal'

const MODES = [
  { id: 'car', label: '🚗 자동차' },
  { id: 'transit', label: '🚌 대중교통' },
  { id: 'walk', label: '🚶 도보' },
]

function formatMinutes(min) {
  if (!Number.isFinite(min)) return '-'
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

// CP6-3 — 대전한바퀴: 관광모아 + 빵모아 결과를 합친 기본 코스 화면.
// 두 설문이 모두 끝났을 때만 코스를 보여주고, 후보 풀(설문 결과) + 전체 지도 검색으로 추가/제거하며
// 커스터마이즈할 수 있다(§07). 순서는 origin 기준 그리디(§06), 이동수단 3종(§08).
export default function PilgrimagePage({ onStartBreadSurvey, onStartTourSurvey }) {
  const regionId = useAppStore((s) => s.regionId)
  const origin = useAppStore((s) => s.origin)
  const answers = useAppStore((s) => s.answers)
  const tourAnswers = useAppStore((s) => s.tourAnswers)
  const { user } = useAuth()

  const breadPick = pickBreadResult(answers)
  const tourResult = isTourSurveyComplete(tourAnswers)
    ? getTourRecommendation(tourAnswers, TAGGED_ATTRACTIONS)
    : null

  // 빵집 매칭은 대전 전역 풀에서(BreadReveal과 동일 방식) — origin 근처 10곳으로 잘리면 안 됨.
  const { bakeries: allBakeries, loading: bakeriesLoading } = useBakeries({
    regionId,
    answers: {},
    origin,
    limit: Infinity,
  })

  const breadDone = !!origin && !!breadPick
  const tourDone = !!tourResult

  const breadResult = breadPick
    ? { ...breadPick, bakeries: matchBakeries(allBakeries, breadPick.bread, 5) }
    : null

  const [travelMode, setTravelMode] = useState('car')
  const [customStops, setCustomStops] = useState(null) // null = 아직 기본 코스로 초기화 전
  const [addOpen, setAddOpen] = useState(false)
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'

  const baseRoute = useMemo(() => {
    if (!breadDone || !tourDone) return null
    return buildRoute({ breadResult, tourResult, origin, travelMode: 'car' })
  }, [breadDone, tourDone, breadResult, tourResult, origin])

  // 빵집 목록이 아직 로딩 중일 때 초기화하면 bakeries:[] 인 채로 고정돼버린다(빵집 0곳으로 굳음)
  // → 로딩이 끝난 뒤(bakeriesLoading=false) 딱 한 번만 기본 코스로 채운다.
  useEffect(() => {
    if (customStops === null && baseRoute && !bakeriesLoading) setCustomStops(baseRoute.stops)
  }, [baseRoute, customStops, bakeriesLoading])

  const route = useMemo(() => {
    if (!customStops || !origin) return null
    return recalcRoute(origin, customStops, travelMode)
  }, [customStops, travelMode, origin])

  const excludeIds = useMemo(() => new Set((customStops || []).map((s) => s.id)), [customStops])

  const removeStop = (id) => setCustomStops((prev) => (prev || []).filter((s) => s.id !== id))
  const addStop = (stop) => {
    setCustomStops((prev) => [...(prev || []), stop])
    setAddOpen(false)
  }

  const handleSave = async () => {
    if (!user || !route) return
    setSaveState('saving')
    const { error } = await supabase.from('saved_courses').insert({
      user_id: user.id,
      title: '대전한바퀴',
      travel_mode: travelMode,
      stops: route.stops,
      origin,
    })
    if (error) {
      console.error('[대전한바퀴] 코스 저장 실패', error)
      setSaveState('error')
      return
    }
    setSaveState('saved')
  }

  if (!breadDone || !tourDone) {
    return (
      <div className="pil-gate">
        <h2>대전한바퀴</h2>
        <p>관광모아와 빵집 찾기 설문을 모두 마치면, 취향에 맞는 기본 코스를 짜드려요.</p>
        <div className="pil-gate-cards">
          <div className={`pil-gate-card${breadDone ? ' done' : ''}`}>
            <b>{breadDone ? '✅ 빵집 찾기 완료' : '빵집 찾기'}</b>
            {!breadDone && (
              <button type="button" className="primary-btn" onClick={onStartBreadSurvey}>
                설문하러 가기
              </button>
            )}
          </div>
          <div className={`pil-gate-card${tourDone ? ' done' : ''}`}>
            <b>{tourDone ? '✅ 관광모아 완료' : '관광모아'}</b>
            {!tourDone && (
              <button type="button" className="primary-btn" onClick={onStartTourSurvey}>
                설문하러 가기
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!route) {
    return <div className="banner">코스를 준비하는 중…</div>
  }

  return (
    <div className="pil-page">
      <div className="pil-panel">
        <div className="pil-title-row">
          <span className="pil-title">대전한바퀴</span>
        </div>

        {route && (
          <div className="pil-summary">
            <div>
              <b>{formatMinutes(route.totalMinutes)}</b>
              <span>예상 소요</span>
            </div>
            <div>
              <b>{formatDistance(route.totalDistanceKm)}</b>
              <span>총 거리</span>
            </div>
            <div>
              <b>{route.stops.length}곳</b>
              <span>방문 예정</span>
            </div>
          </div>
        )}

        <ol className="pil-stops">
          {(route?.stops || []).map((stop) => (
            <li key={stop.id} className={`pil-stop ${stop.type}`}>
              <span className="pil-stop-num">{stop.order}</span>
              <span className="pil-stop-info">
                <span className="pil-stop-name">{stop.name}</span>
                <span className="pil-stop-type">{stop.type === 'attraction' ? '📍 관광지' : '🥐 빵집'}</span>
              </span>
              <button
                type="button"
                className="pil-stop-remove"
                onClick={() => removeStop(stop.id)}
                aria-label={`${stop.name} 코스에서 빼기`}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>

        <button type="button" className="pil-add-btn" onClick={() => setAddOpen(true)}>
          + 추가하기 (전체 지도에서 검색)
        </button>

        <div className="pil-modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={travelMode === m.id ? 'active' : ''}
              onClick={() => setTravelMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="pil-save-btn"
          onClick={handleSave}
          disabled={!user || saveState === 'saving' || saveState === 'saved'}
        >
          {!user
            ? '로그인 후 저장 가능'
            : saveState === 'saving'
              ? '저장 중…'
              : saveState === 'saved'
                ? '저장됨 ✓'
                : saveState === 'error'
                  ? '저장 실패, 다시 시도'
                  : '코스 저장하기'}
        </button>
      </div>

      <div className="pil-map">
        <RouteMap origin={origin} stops={route?.stops || []} />
      </div>

      {addOpen && (
        <AddStopModal
          bakeries={allBakeries}
          attractions={TAGGED_ATTRACTIONS}
          excludeIds={excludeIds}
          onAdd={addStop}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}

// origin + 순번 매겨진 stops → 카카오맵에 번호 핀 + 경로선. PilgrimagePage 전용이라 여기에 둔다.
function RouteMap({ origin, stops }) {
  const { loaded, error } = useKakaoLoader()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const polylineRef = useRef(null)

  useEffect(() => {
    if (!loaded || !containerRef.current || mapRef.current || !origin) return
    const { kakao } = window
    mapRef.current = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(origin.lat, origin.lng),
      level: 7,
    })
  }, [loaded, origin])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.kakao || !origin) return
    const { kakao } = window

    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
    if (polylineRef.current) polylineRef.current.setMap(null)

    const points = [origin, ...stops]
    const path = points.map((p) => new kakao.maps.LatLng(p.lat, p.lng))

    if (path.length > 1) {
      polylineRef.current = new kakao.maps.Polyline({
        map,
        path,
        strokeWeight: 4,
        strokeColor: '#F2814A',
        strokeOpacity: 0.85,
        strokeStyle: 'shortdash',
      })
    }

    const originOverlay = new kakao.maps.CustomOverlay({
      map,
      position: path[0],
      content: '<div class="pil-pin pil-pin-origin">S</div>',
      yAnchor: 0.5,
    })
    overlaysRef.current.push(originOverlay)

    stops.forEach((stop, i) => {
      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(stop.lat, stop.lng),
        content: `<div class="pil-pin pil-pin-${stop.type}">${i + 1}</div>`,
        yAnchor: 0.5,
      })
      overlaysRef.current.push(overlay)
    })

    if (path.length > 0) {
      const bounds = new kakao.maps.LatLngBounds()
      path.forEach((ll) => bounds.extend(ll))
      map.setBounds(bounds)
    }
  }, [stops, origin])

  return (
    <div className="map-wrap">
      {error && (
        <div className="map-error">
          지도를 불러오지 못했습니다.<br />
          <code>VITE_KAKAO_JS_KEY</code> 를 확인하세요.
        </div>
      )}
      <div ref={containerRef} className="map-canvas" />
    </div>
  )
}
