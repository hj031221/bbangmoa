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
import { useAttractions } from '../../hooks/useAttractions'
import { useSavedCourses } from '../../hooks/useSavedCourses'
import AddStopModal from './AddStopModal'

const MODES = [
  { id: 'car', label: '🚗 자동차' },
  { id: 'transit', label: '🚌 대중교통' },
  { id: 'walk', label: '🚶 도보' },
]

// 코스의 "정체성" — 경유지 타입+id를 순서대로 이어붙인 키. 순서가 바뀌면 다른 코스로 본다
// (§CP10-7 — "똑같은 코스 저장 방지" 요청 대응). lat/lng/name/order 등은 무시한다(같은 id면
// 항상 같은 값이라 중복이라 비교할 이유가 없다). origin·이동수단은 여기 포함하지 않는다 —
// 이동수단이 다르면 아래에서 별도로 비교한다(같은 경유지·순서라도 이동수단이 다르면 다른 저장으로
// 허용), origin은 "그때그때 어디서 출발했는지"일 뿐 코스 자체의 정체성은 아니라고 판단했다.
function stopsSignature(stops) {
  return (stops || []).map((s) => `${s.type}:${s.id}`).join('|')
}

function formatMinutes(min) {
  if (!Number.isFinite(min)) return '-'
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

// CP11-4 — 이 값이 실API로 구한 실측인지, 실API가 없어서/실패해서 보정계수로 어림한 값인지를
// 항상 명시한다(전엔 실측일 때만 조용히 "(실시간)"이 붙고 어림값일 땐 아무 표시가 없었다).
function PrecisionTag({ precise }) {
  return (
    <span className={'pil-precision-tag' + (precise ? ' measured' : ' estimated')}>
      {precise ? '실측' : '추정'}
    </span>
  )
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
  // 이미 저장해둔 코스 목록 — "똑같은 코스 저장 방지"(§CP10-7) 중복 판정에 쓴다.
  const { courses: savedCourses, loading: savedCoursesLoading } = useSavedCourses()
  const { tagged: attractions, loading: attractionsLoading } = useAttractions()

  const tourResult = isTourSurveyComplete(tourAnswers)
    ? getTourRecommendation(tourAnswers, attractions)
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
  // useSavedCourses는 마운트 시점 한 번만 조회해서, 이 화면에서 방금 막 저장한 코스는 반영이
  // 안 돼 있다 — 그래서 이번에 저장 성공한 것들만 세션 안에서 따로 기억해둔다(중복판정용).
  const [justSaved, setJustSaved] = useState([])
  const savingRef = useRef(false) // 저장 중 빠른 연타로 두 번 insert되는 것 방지(state는 한 박자 늦게 반영됨)
  const dragIndexRef = useRef(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // 마이페이지 "찜한 코스"에서 불러온 경우엔 설문 미완료여도 게이트를 우회한다(§CP10-3) — 이미
  // 확정된 경유지 목록이 있으니 설문이 필요 없다. pendingCourseLoad는 아래 effect가 한 번 소비하고
  // 비우므로, 그 뒤에도 게이트를 계속 우회하려면 별도 플래그(gateBypassed)로 기억해둬야 한다.
  const [gateBypassed, setGateBypassed] = useState(false)
  const loadedFromSavedRef = useRef(false)

  useEffect(() => {
    if (!pendingCourseLoad) return
    if (!Array.isArray(pendingCourseLoad.stops)) {
      // 형식이 이상한 코스(예: 옛 스키마 잔여 데이터)면 조용히 무시하고 정리한다 — 크래시보다 낫다.
      setPendingCourseLoad(null)
      return
    }
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

  // 빵집·관광지 목록이 아직 로딩 중일 때 초기화하면 그중 하나가 0곳인 채로 고정돼버린다
  // (getTourRecommendation은 attractions=[] 이어도 results:[] 인 truthy 객체를 반환하므로
  // tourDone만으로는 "관광지 데이터가 실제로 도착했는지"를 구분 못 한다 — 반드시 attractionsLoading도
  // 같이 봐야 한다). → 두 로딩이 다 끝난 뒤 딱 한 번만 기본 코스로 채운다.
  // 찜한 코스를 불러온 경우엔(loadedFromSavedRef) 이 자동 채우기를 건너뛴다 — 위 effect가 이미
  // customStops를 채웠는데, 같은 렌더에서 이 effect도 "아직 null"로 보고 덮어쓸 수 있어서다.
  useEffect(() => {
    if (
      customStops === null &&
      baseRoute &&
      !bakeriesLoading &&
      !attractionsLoading &&
      !loadedFromSavedRef.current
    ) {
      setCustomStops(baseRoute.stops)
    }
  }, [baseRoute, customStops, bakeriesLoading, attractionsLoading])

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

  // "추가하기" 모달에서, 설문에서 이미 후보로 나왔는데 지금 코스엔 없는 것들을 상단으로 올려
  // 보여주기 위한 id 집합. excludeIds가 바뀔 때마다(추가/제거) 자동으로 다시 계산된다.
  const suggestedBakeryIds = useMemo(
    () => new Set((breadResult?.bakeries || []).filter((b) => !excludeIds.has(b.id)).map((b) => b.id)),
    [breadResult, excludeIds],
  )
  const suggestedAttractionIds = useMemo(
    () =>
      new Set(
        (tourResult?.results || [])
          .map((r) => r.attraction)
          .filter((a) => !excludeIds.has(a.id))
          .map((a) => a.id),
      ),
    [tourResult, excludeIds],
  )

  // 지금 화면의 코스(경유지+순서+이동수단)가 이미 저장된 것과 같은지 — 같으면 저장 버튼을 막는다
  // (§CP10-7). DB 조회분(savedCourses) + 이 화면에서 방금 저장한 것(justSaved) 둘 다 본다.
  const isDuplicateOfSaved = useMemo(() => {
    if (!route) return false
    const sig = stopsSignature(route.stops)
    const isSameAs = (c) => c.travel_mode === travelMode && stopsSignature(c.stops) === sig
    return savedCourses.some(isSameAs) || justSaved.some(isSameAs)
  }, [route, travelMode, savedCourses, justSaved])

  // 코스 내용이 바뀌면(경유지·순서·이동수단) 이전 저장 상태 표시를 지운다 — 안 그러면 한 번
  // 저장한 뒤 코스를 고쳐도 버튼이 "저장됨 ✓"에 갇혀서 새 버전을 다시 저장할 방법이 없었다.
  useEffect(() => {
    setSaveState('idle')
  }, [route, travelMode])

  // CP6-4/CP11-4: route가 정해지면 실API로 정밀 이동시간·거리 + 구간별 실제 경로 좌표를 한 번 더
  // 구한다. 실패/도보 모드면 null 유지 — 그럴 땐 route.totalMinutes/totalDistanceKm(근사치) +
  // 직선 경로를 그대로 쓴다.
  const [preciseMinutes, setPreciseMinutes] = useState(null)
  const [preciseDistanceKm, setPreciseDistanceKm] = useState(null)
  const [legPaths, setLegPaths] = useState(null)
  const [legDistancesKm, setLegDistancesKm] = useState(null)
  const [legMinutes, setLegMinutes] = useState(null)
  const [legEstimated, setLegEstimated] = useState(null)
  useEffect(() => {
    setPreciseMinutes(null)
    setPreciseDistanceKm(null)
    setLegPaths(null)
    setLegDistancesKm(null)
    setLegMinutes(null)
    setLegEstimated(null)
    if (!route || route.stops.length === 0) return
    let alive = true
    estimateActualRoute(origin, route.stops, travelMode).then((result) => {
      if (!alive) return
      setPreciseMinutes(result?.totalMinutes ?? null)
      setPreciseDistanceKm(result?.totalDistanceKm ?? null)
      setLegPaths(result?.legPaths ?? null)
      setLegDistancesKm(result?.legDistancesKm ?? null)
      setLegMinutes(result?.legMinutes ?? null)
      setLegEstimated(result?.legEstimated ?? null)
    })
    return () => {
      alive = false
    }
  }, [route, travelMode, origin])

  // CP11-4 — 리스트에서 경유지를 호버/탭하면 지도의 해당 구간(그 경유지로 들어오는 leg)이
  // 강조된다. points=[origin,...stops] 기준으로 stop의 배열 index가 곧 그 stop으로 들어오는
  // leg의 index와 같다(leg i는 points[i]→points[i+1], stop[index]는 points[index+1]).
  const [highlightIndex, setHighlightIndex] = useState(null)

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
    // savingRef: state(saveState)로 disabled를 걸어도 리렌더가 한 박자 늦어서, 아주 빠른 연속
    // 클릭(더블클릭 등)은 둘 다 disabled 반영 전에 통과해 insert가 두 번 나갈 수 있다 — ref는
    // 동기적으로 바로 반영되니 여기서 즉시 막는다.
    if (!user || !route || savingRef.current || isDuplicateOfSaved || savedCoursesLoading) return
    savingRef.current = true
    setSaveState('saving')
    const { error } = await supabase.from('saved_courses').insert({
      user_id: user.id,
      title: '대전한바퀴',
      travel_mode: travelMode,
      stops: route.stops,
      origin,
    })
    savingRef.current = false
    if (error) {
      console.error('[대전한바퀴] 코스 저장 실패', error)
      setSaveState('error')
      return
    }
    setJustSaved((prev) => [...prev, { stops: route.stops, travel_mode: travelMode }])
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
              <span>
                예상 소요 <PrecisionTag precise={preciseMinutes != null} />
              </span>
            </div>
            <div>
              <b>{formatDistance(preciseDistanceKm ?? route.totalDistanceKm)}</b>
              <span>
                이동 거리(편도) <PrecisionTag precise={preciseDistanceKm != null} />
              </span>
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
              className={`pil-stop ${stop.type}${dragOverIndex === index ? ' drag-over' : ''}${highlightIndex === index ? ' leg-highlight' : ''}`}
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
              <span
                className="pil-stop-info"
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseLeave={() => setHighlightIndex(null)}
                onClick={() => setHighlightIndex((p) => (p === index ? null : index))}
              >
                <span className="pil-stop-name">{stop.name}</span>
                <span className="pil-stop-type">
                  {stop.type === 'attraction' ? '📍 관광지' : '🥐 빵집'}
                  {legDistancesKm && legMinutes && (
                    <> · 이전 경유지에서 {formatDistance(legDistancesKm[index])} · {legMinutes[index]}분</>
                  )}
                </span>
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
          disabled={
            !user ||
            saveState === 'saving' ||
            saveState === 'saved' ||
            isDuplicateOfSaved ||
            savedCoursesLoading
          }
        >
          {!user
            ? '로그인 후 저장 가능'
            : saveState === 'saving'
              ? '저장 중…'
              : saveState === 'saved'
                ? '저장됨 ✓'
                : isDuplicateOfSaved
                  ? '이미 저장된 코스예요'
                  : saveState === 'error'
                    ? '저장 실패, 다시 시도'
                    : '코스 저장하기'}
        </button>
      </div>

      <div className="pil-map">
        <RouteMap
          origin={origin}
          stops={route?.stops || []}
          legPaths={legPaths}
          legDistancesKm={legDistancesKm}
          legMinutes={legMinutes}
          legEstimated={legEstimated}
          highlightIndex={highlightIndex}
        />
      </div>

      {addOpen && (
        <AddStopModal
          bakeries={allBakeries}
          attractions={attractions}
          excludeIds={excludeIds}
          suggestedBakeryIds={suggestedBakeryIds}
          suggestedAttractionIds={suggestedAttractionIds}
          onAdd={addStop}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}

// origin + 순번 매겨진 stops → 카카오맵에 번호 핀 + 경로선. PilgrimagePage 전용이라 여기에 둔다.
// legEstimated[i]가 false면(CP11-4 실API 응답) 실선, true면(실API 실패로 보정계수 어림값을 쓴
// 구간) 점선으로 그려 "이건 추정치"라는 걸 시각적으로도 알려준다.
// (예전엔 legPaths[i]가 채워져 있는지로 판정했는데, 어림값 구간도 항상 [출발점,도착점] 2점짜리
// 배열을 채워 넣어서 실측처럼 늘 실선으로 보이던 버그가 있었다 — legEstimated로 명시적으로 구분.)
// highlightIndex가 가리키는 구간은 리스트에서 그 경유지를 호버/탭했을 때 굵은 선 + 거리·시간
// 라벨로 강조된다.
function RouteMap({ origin, stops, legPaths, legDistancesKm, legMinutes, legEstimated, highlightIndex }) {
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
      const isHighlighted = i === highlightIndex
      const isEstimated = legEstimated ? legEstimated[i] : legPaths?.[i]?.length > 0 ? false : true
      polylinesRef.current.push(
        new kakao.maps.Polyline({
          map,
          path,
          strokeWeight: isHighlighted ? 7 : 4,
          strokeColor: isHighlighted ? '#D9591A' : '#F2814A',
          strokeOpacity: 0.85,
          // 실API로 구한 구간이면 실선, 보정계수 어림값이면 점선으로 구분.
          strokeStyle: isEstimated ? 'shortdash' : 'solid',
        }),
      )

      if (isHighlighted && legDistancesKm && legMinutes) {
        const mid = legPoints[Math.floor(legPoints.length / 2)]
        overlaysRef.current.push(
          new kakao.maps.CustomOverlay({
            map,
            position: new kakao.maps.LatLng(mid.lat, mid.lng),
            content: `<div class="pil-leg-label">${formatDistance(legDistancesKm[i]) ?? '-'} · ${legMinutes[i]}분</div>`,
            yAnchor: 1.4,
          }),
        )
      }
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
  }, [loaded, origin, stops, legPaths, legDistancesKm, legMinutes, legEstimated, highlightIndex])

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
