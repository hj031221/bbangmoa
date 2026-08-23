import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { useBakeries } from '../../hooks/useBakeries'
import { useKakaoLoader } from '../../hooks/useKakaoLoader'
import { pickBreadResult, matchBakeries } from '../../lib/breadRecommend'
import { getTourRecommendation, isTourSurveyComplete } from '../../lib/tourRecommend'
import { buildRoute, recalcRoute, summarizeOrder } from '../../lib/routePlan'
import { estimateActualRoute } from '../../lib/travelTime'
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
  const setOrigin = useAppStore((s) => s.setOrigin)
  const answers = useAppStore((s) => s.answers)
  const tourAnswers = useAppStore((s) => s.tourAnswers)
  const pendingCourseLoad = useAppStore((s) => s.pendingCourseLoad)
  const setPendingCourseLoad = useAppStore((s) => s.setPendingCourseLoad)
  const { user } = useAuth()

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

  // 로딩 중엔 필터 없이(연결된 빵집 없는 빵도 포함해서) 고르고, 로딩이 끝나면 §CP10-2 필터가 적용된
  // 결과로 다시 계산된다 — BreadReveal/MapResult 와 동일 패턴.
  const breadPick = pickBreadResult(answers, bakeriesLoading ? [] : allBakeries)

  const breadDone = !!origin && !!breadPick
  const tourDone = !!tourResult

  const breadResult = breadPick
    ? { ...breadPick, bakeries: matchBakeries(allBakeries, breadPick.bread, 5) }
    : null

  const [travelMode, setTravelMode] = useState('car')
  const [customStops, setCustomStops] = useState(null) // null = 아직 기본 코스로 초기화 전
  // null = 아직 손대기 전(그리디 자동 정렬 사용). 한 번이라도 드래그하면 순서 id 배열이 들어가고,
  // 그 뒤로는 add/remove를 해도 이 순서를 존중한다(그리디로 되돌아가지 않는다).
  const [manualOrderIds, setManualOrderIds] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const dragIndexRef = useRef(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // 마이페이지 "찜한 코스"에서 불러온 경우엔 설문 미완료여도 게이트를 우회한다(§CP10-3) — 이미
  // 확정된 경유지 목록이 있으니 설문이 필요 없다. pendingCourseLoad는 아래 effect가 한 번 소비하고
  // 비우므로, 그 뒤에도 게이트를 계속 우회하려면 별도 플래그(gateBypassed)로 기억해둬야 한다.
  const [gateBypassed, setGateBypassed] = useState(false)
  const loadedFromSavedRef = useRef(false)

  useEffect(() => {
    if (!pendingCourseLoad) return
    loadedFromSavedRef.current = true
    setGateBypassed(true)
    setCustomStops(pendingCourseLoad.stops)
    setManualOrderIds(pendingCourseLoad.stops.map((s) => s.id))
    setTravelMode(pendingCourseLoad.travel_mode || 'car')
    if (!origin && pendingCourseLoad.origin) setOrigin(pendingCourseLoad.origin)
    setPendingCourseLoad(null)
    // origin/setOrigin/setPendingCourseLoad는 안정적인 참조/스토어 상태라 deps에서 뺀다 —
    // pendingCourseLoad가 들어올 때 딱 한 번만 소비하면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCourseLoad])

  const baseRoute = useMemo(() => {
    if (!breadDone || !tourDone) return null
    return buildRoute({ breadResult, tourResult, origin, travelMode: 'car' })
  }, [breadDone, tourDone, breadResult, tourResult, origin])

  // 빵집 목록이 아직 로딩 중일 때 초기화하면 bakeries:[] 인 채로 고정돼버린다(빵집 0곳으로 굳음)
  // → 로딩이 끝난 뒤(bakeriesLoading=false) 딱 한 번만 기본 코스로 채운다.
  // 찜한 코스를 불러온 경우엔(loadedFromSavedRef) 이 자동 채우기를 건너뛴다 — 위 effect가 이미
  // customStops를 채웠는데, 같은 렌더에서 이 effect도 "아직 null"로 보고 덮어쓸 수 있어서다.
  useEffect(() => {
    if (customStops === null && baseRoute && !bakeriesLoading && !loadedFromSavedRef.current) {
      setCustomStops(baseRoute.stops)
    }
  }, [baseRoute, customStops, bakeriesLoading])

  const route = useMemo(() => {
    if (!customStops || !origin) return null
    if (manualOrderIds) {
      const byId = new Map(customStops.map((s) => [s.id, s]))
      const ordered = manualOrderIds.map((id) => byId.get(id)).filter(Boolean)
      if (ordered.length > 0) return summarizeOrder(origin, ordered, travelMode)
    }
    return recalcRoute(origin, customStops, travelMode)
  }, [customStops, manualOrderIds, travelMode, origin])

  const excludeIds = useMemo(() => new Set((customStops || []).map((s) => s.id)), [customStops])

  // CP6-4: route가 정해지면 실API로 정밀 이동시간 + 구간별 실제 경로 좌표를 한 번 더 구한다.
  // 실패/도보 모드면 null 유지 — 그럴 땐 route.totalMinutes(근사치) + 직선 경로를 그대로 쓴다.
  const [preciseMinutes, setPreciseMinutes] = useState(null)
  const [legPaths, setLegPaths] = useState(null)
  useEffect(() => {
    setPreciseMinutes(null)
    setLegPaths(null)
    if (!route || route.stops.length === 0) return
    let alive = true
    estimateActualRoute(origin, route.stops, travelMode).then((result) => {
      if (!alive) return
      setPreciseMinutes(result?.totalMinutes ?? null)
      setLegPaths(result?.legPaths ?? null)
    })
    return () => {
      alive = false
    }
  }, [route, travelMode, origin])

  const removeStop = (id) => {
    setCustomStops((prev) => (prev || []).filter((s) => s.id !== id))
    setManualOrderIds((prev) => (prev ? prev.filter((i) => i !== id) : prev))
  }
  const addStop = (stop) => {
    setCustomStops((prev) => [...(prev || []), stop])
    setManualOrderIds((prev) => (prev ? [...prev, stop.id] : prev))
    setAddOpen(false)
  }

  // 햄버거 핸들을 눌러 드래그 → 리스트 순서를 손으로 바꾼다. 이후엔 그리디 재정렬 대신
  // 이 순서를 그대로 쓴다(route useMemo의 manualOrderIds 분기).
  // 네이티브 HTML5 드래그(draggable)는 모바일 터치에서 대부분 동작하지 않아서(마우스 전용) 안 쓴다 —
  // Pointer Events(마우스·터치·펜 공통)로 직접 구현해 데스크톱/모바일 둘 다 되게 한다.
  // dragOverIndexRef: pointerup이 React state(dragOverIndex)의 클로저를 읽으면, 리렌더가 아직
  // 안 반영된 값을 볼 수 있어(빠른 제스처에서 실제로 재현됨) ref로 항상 최신값을 동기적으로 읽는다.
  // dragOverIndex(state)는 드래그 중인 줄에 하이라이트를 주는 시각 효과에만 쓴다.
  const dragOverIndexRef = useRef(null)
  const handlePointerDown = (index) => (e) => {
    e.preventDefault()
    dragIndexRef.current = index
    dragOverIndexRef.current = index
    setDragOverIndex(index)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e) => {
    if (dragIndexRef.current == null) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const li = el?.closest('.pil-stop')
    if (!li) return
    const index = Number(li.dataset.index)
    if (Number.isFinite(index)) {
      dragOverIndexRef.current = index
      setDragOverIndex(index)
    }
  }
  const handlePointerUp = () => {
    const from = dragIndexRef.current
    const to = dragOverIndexRef.current
    dragIndexRef.current = null
    dragOverIndexRef.current = null
    setDragOverIndex(null)
    if (from == null || to == null || from === to || !route) return
    const ids = route.stops.map((s) => s.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    setManualOrderIds(ids)
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

  if ((!breadDone || !tourDone) && !gateBypassed && !pendingCourseLoad) {
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

  // customStops === null 인 동안만 "로딩 중" — 사용자가 다 지워서 []가 된 것과는 구분해야 한다.
  // 이 구분이 없으면 전부 지웠을 때도 계속 "준비하는 중…"이 떠서 화면이 통째로 날아간 것처럼 보였다.
  if (customStops === null) {
    return <div className="banner">코스를 준비하는 중…</div>
  }

  return (
    <div className="pil-page">
      <div className="pil-panel">
        <div className="pil-title-row">
          <span className="pil-title">대전한바퀴</span>
        </div>

        {route ? (
          <div className="pil-summary">
            <div>
              <b>{formatMinutes(preciseMinutes ?? route.totalMinutes)}</b>
              <span>{preciseMinutes != null ? '예상 소요 (실시간)' : '예상 소요'}</span>
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
        ) : (
          <p className="pil-empty-msg">코스가 비었어요 — 아래 "추가하기"로 빵집·관광지를 넣어보세요.</p>
        )}

        <ol className="pil-stops">
          {(route?.stops || []).map((stop, index) => (
            <li
              key={stop.id}
              data-index={index}
              className={`pil-stop ${stop.type}${dragOverIndex === index ? ' drag-over' : ''}`}
            >
              <span
                className="pil-stop-handle"
                onPointerDown={handlePointerDown(index)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                aria-label={`${stop.name} 순서 바꾸기(드래그)`}
                title="드래그해서 순서 바꾸기"
              >
                ☰
              </span>
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
        <RouteMap origin={origin} stops={route?.stops || []} legPaths={legPaths} />
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
// legPaths가 있으면(CP6-4 실API 응답) 구간마다 실제 도로/경유지 좌표로 그리고, 없으면(도보이거나
// 실API 실패) 직선으로 그린다 — 실선/점선으로 구분해서 "이건 추정치"라는 걸 시각적으로도 알려준다.
function RouteMap({ origin, stops, legPaths }) {
  const { loaded, error } = useKakaoLoader()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const polylinesRef = useRef([])

  // 지도 생성과 핀/경로선 그리기를 하나의 effect로 묶는다 — 따로 두면 "핀을 그릴 stops는
  // 이미 준비됐는데 지도(SDK 로딩)가 아직 안 끝난" 순서로 실행될 때 핀 effect가 조용히
  // 아무것도 안 그리고 끝나버리고, 그 뒤로 stops/origin이 안 바뀌면 다시 안 그려지는 문제가 있었다.
  useEffect(() => {
    if (!loaded || !containerRef.current || !origin) return
    const { kakao } = window

    if (!mapRef.current) {
      mapRef.current = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(origin.lat, origin.lng),
        level: 7,
      })
    }
    const map = mapRef.current

    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
    polylinesRef.current.forEach((p) => p.setMap(null))
    polylinesRef.current = []

    const points = [origin, ...stops]
    const bounds = new kakao.maps.LatLngBounds()

    for (let i = 0; i < points.length - 1; i++) {
      const legPoints = legPaths?.[i]?.length > 0 ? legPaths[i] : [points[i], points[i + 1]]
      const path = legPoints.map((p) => new kakao.maps.LatLng(p.lat, p.lng))
      path.forEach((ll) => bounds.extend(ll))
      polylinesRef.current.push(
        new kakao.maps.Polyline({
          map,
          path,
          strokeWeight: 4,
          strokeColor: '#F2814A',
          strokeOpacity: 0.85,
          // 실제 경로가 있으면 실선(정확한 경로), 없으면 점선(직선 추정)으로 구분.
          strokeStyle: legPaths?.[i]?.length > 0 ? 'solid' : 'shortdash',
        }),
      )
    }

    const originOverlay = new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(origin.lat, origin.lng),
      content: '<div class="pil-pin pil-pin-origin">S</div>',
      yAnchor: 0.5,
    })
    overlaysRef.current.push(originOverlay)
    bounds.extend(new kakao.maps.LatLng(origin.lat, origin.lng))

    stops.forEach((stop, i) => {
      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(stop.lat, stop.lng),
        content: `<div class="pil-pin pil-pin-${stop.type}">${i + 1}</div>`,
        yAnchor: 0.5,
      })
      overlaysRef.current.push(overlay)
      bounds.extend(new kakao.maps.LatLng(stop.lat, stop.lng))
    })

    if (points.length > 0) map.setBounds(bounds)
  }, [loaded, origin, stops, legPaths])

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
