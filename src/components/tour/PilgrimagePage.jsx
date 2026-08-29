import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { useBakeries } from '../../hooks/useBakeries'
import { useKakaoLoader } from '../../hooks/useKakaoLoader'
import { pickBreadResult, matchBakeries } from '../../lib/breadRecommend'
import { getTourRecommendation, isTourSurveyComplete } from '../../lib/tourRecommend'
import { buildRoute, recalcRoute, summarizeOrder } from '../../lib/routePlan'
import { estimateActualRoute } from '../../lib/travelTime'
import { formatDistance, midpointOf, hasValidCoords } from '../../lib/distance'
import { sanitizeOriginForSave } from '../../lib/originPrivacy'
import { fetchDestinationsMatrix } from '../../api'
import { getRegion } from '../../config/regions'
import { supabase } from '../../lib/supabase'
import { useAttractions } from '../../hooks/useAttractions'
import { useSavedCourses } from '../../hooks/useSavedCourses'
import AddStopModal from './AddStopModal'

const MODES = [
  { id: 'car', label: '🚗 자동차' },
  { id: 'transit', label: '🚌 대중교통' },
  { id: 'walk', label: '🚶 도보' },
]

function CompletionMark() {
  return (
    <svg className="pil-completion-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#E8F1F5" stroke="#5C839A" strokeWidth="1.7" />
      <path
        d="m7.4 12.2 3.05 3.05 6.4-6.55"
        fill="none"
        stroke="#416D86"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// 코스의 "정체성" — 경유지 타입+id를 순서대로 이어붙인 키. 순서가 바뀌면 다른 코스로 본다
// (§CP10-7 — "똑같은 코스 저장 방지" 요청 대응). lat/lng/name/order 등은 무시한다(같은 id면
// 항상 같은 값이라 중복이라 비교할 이유가 없다). origin·이동수단은 여기 포함하지 않는다 —
// 이동수단이 다르면 아래에서 별도로 비교한다(같은 경유지·순서라도 이동수단이 다르면 다른 저장으로
// 허용), origin은 "그때그때 어디서 출발했는지"일 뿐 코스 자체의 정체성은 아니라고 판단했다.
function stopsSignature(stops) {
  return (stops || []).map((s) => `${s.type}:${s.id}`).join('|')
}

// CP12 — 대중교통 구간의 "실제 경로 보기" 링크. 카카오맵이 외부 사이트용으로 공식 제공하는
// 웹 링크(API 키 불필요, PC/모바일 자동 대응, 실 호출 302 확인됨) — 앱 스킴(kakaomap://)은
// by 파라미터가 무시되고 CAR로 열린다는 버그 리포트가 여럿이라 웹 링크를 쓴다. 대중교통 모드는
// 경유지를 지원하지 않아 코스 전체가 아니라 구간별로 건다.
function kakaoTransitLink(from, to) {
  const enc = (v) => encodeURIComponent(v || '')
  return `https://map.kakao.com/link/by/traffic/${enc(from.name)},${from.lat},${from.lng}/${enc(to.name)},${to.lat},${to.lng}`
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
    // 옛 스키마 등으로 좌표가 없는 stop은 여기서 걸러낸다 — customStops에 한 번 들어가면
    // route.stops(hasValidCoords로 필터됨)엔 안 보이는데 excludeIds(customStops 기준)엔 계속
    // 남아서, 사용자 눈엔 안 보이고 지울 수도 없는데 "추가하기"에서 재추가도 막히는 유령 슬롯이
    // 됐다(리뷰 발견). 애초에 customStops에 못 들어오게 막는 게 근본 해결 — 이후 로직들은
    // "customStops 안엔 항상 유효 좌표만 있다"는 전제를 그대로 믿어도 된다.
    const validStops = pendingCourseLoad.stops.filter(hasValidCoords)
    loadedFromSavedRef.current = true
    setGateBypassed(true)
    setCustomStops(validStops)
    setManualOrderIds(validStops.map((s) => s.id))
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

  // CP12 — haversine 그리디(recalcRoute)로 먼저 즉시 렌더한 뒤, 카카오 1:N 목적지 API로
  // origin→각 stop 실주행시간을 한 번에 받아 그 기준으로 다시 정렬한다. "직선으로 가까워
  // 보이지만 실제로는 하천 건너편이라 크게 도는" 사례(대전 갑천·대전천에서 실제로 겪음)를
  // 바로잡는다. 수동으로 순서를 바꾼 뒤(manualOrderIds)엔 안 건드린다. API가 실패하거나 일부
  // stop이 radius(10km) 밖이면 그 stop만 뒤로 밀어 넣고 나머지는 실주행시간 순으로 — 완전
  // 실패하면 realOrderIds가 null로 남아 그리디 순서를 그대로 쓴다(동작 보존).
  const [realOrderIds, setRealOrderIds] = useState(null)
  useEffect(() => {
    setRealOrderIds(null)
    if (!origin || manualOrderIds || !customStops || customStops.length === 0) return
    let alive = true
    fetchDestinationsMatrix(origin, customStops).then((result) => {
      if (!alive || !result || result.length === 0) return
      const byId = new Map(result.map((r) => [r.id, r]))
      const covered = customStops.filter((s) => byId.has(s.id))
      const uncovered = customStops.filter((s) => !byId.has(s.id))
      covered.sort((a, b) => byId.get(a.id).minutes - byId.get(b.id).minutes)
      setRealOrderIds([...covered, ...uncovered].map((s) => s.id))
    })
    return () => {
      alive = false
    }
  }, [origin, customStops, manualOrderIds])

  const route = useMemo(() => {
    if (!customStops || !origin) return null
    const orderIds = manualOrderIds || realOrderIds
    if (orderIds) {
      const byId = new Map(customStops.map((s) => [s.id, s]))
      const ordered = orderIds.map((id) => byId.get(id)).filter(Boolean)
      if (ordered.length > 0) return summarizeOrder(origin, ordered, travelMode)
    }
    return recalcRoute(origin, customStops, travelMode)
  }, [customStops, manualOrderIds, realOrderIds, travelMode, origin])

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
  const [legMinutesEstimated, setLegMinutesEstimated] = useState(null)
  const [legDistanceEstimated, setLegDistanceEstimated] = useState(null)
  const [taxiFare, setTaxiFare] = useState(null) // CP12 — car 모드 다중경유지 성공 시에만 옴
  useEffect(() => {
    setPreciseMinutes(null)
    setPreciseDistanceKm(null)
    setLegPaths(null)
    setLegDistancesKm(null)
    setLegMinutes(null)
    setLegEstimated(null)
    setLegMinutesEstimated(null)
    setLegDistanceEstimated(null)
    setTaxiFare(null)
    if (!route || route.stops.length === 0) return
    let alive = true
    estimateActualRoute(origin, route.stops, travelMode)
      .then((result) => {
        if (!alive) return
        setPreciseMinutes(result?.totalMinutes ?? null)
        setPreciseDistanceKm(result?.totalDistanceKm ?? null)
        setLegPaths(result?.legPaths ?? null)
        setLegDistancesKm(result?.legDistancesKm ?? null)
        setLegMinutes(result?.legMinutes ?? null)
        setLegEstimated(result?.legEstimated ?? null)
        setLegMinutesEstimated(result?.legMinutesEstimated ?? null)
        setLegDistanceEstimated(result?.legDistanceEstimated ?? null)
        setTaxiFare(result?.taxiFare ?? null)
      })
      // 리뷰 발견: estimateActualRoute 내부 어딘가(특히 findNearbyParking)가 던지면 여기 .catch()가
      // 없어 unhandled rejection이 나고, 화면은 아무 에러 표시 없이 preciseMinutes=null(근사치)
      // 상태로 조용히 멈춰 있었다. travelTime.js 쪽에서 이미 흡수하도록 고쳤지만, 이 화면도
      // "실패하면 근사치를 그대로 쓴다"는 기존 원칙대로 방어적으로 한 번 더 잡는다.
      .catch((e) => {
        console.error('[대전한바퀴] 실API 이동시간/거리 계산 실패 — 근사치로 대체', e)
      })
    return () => {
      alive = false
    }
  }, [route, travelMode, origin])

  // CP11-4 — 리스트에서 경유지를 호버/탭하면 지도의 해당 구간(그 경유지로 들어오는 leg)이
  // 강조된다. points=[origin,...stops] 기준으로 stop의 배열 index가 곧 그 stop으로 들어오는
  // leg의 index와 같다(leg i는 points[i]→points[i+1], stop[index]는 points[index+1]).
  // onClick을 토글(같은 곳 다시 클릭하면 null)로 뒀었는데, 터치 기기는 탭할 때 mouseenter→click이
  // 같은 제스처 안에서 순서대로 발생해 mouseenter가 세팅한 값을 click이 바로 도로 지워버려
  // 탭이 항상 무효였다(리뷰 발견) — 그냥 "이 index로 고정"만 하도록 단순화해서 탭도 동작하게 함.
  const [highlightIndex, setHighlightIndex] = useState(null)

  // 리뷰 발견: 경유지를 지우거나(removeStop) 추가하거나(addStop) 드래그로 순서를 바꾸면
  // (handlePointerUp) 배열이 재인덱싱되는데 highlightIndex는 그대로 남아있어서, 조작 이후엔
  // 엉뚱한 구간이 지도에 강조 표시됐다 — 셋 다 하이라이트를 초기화한다.
  const removeStop = (id) => {
    setCustomStops((prev) => (prev || []).filter((s) => s.id !== id))
    setManualOrderIds((prev) => (prev ? prev.filter((i) => i !== id) : prev))
    setHighlightIndex(null)
  }
  const addStop = (stop) => {
    setCustomStops((prev) => [...(prev || []), stop])
    setManualOrderIds((prev) => (prev ? [...prev, stop.id] : prev))
    setAddOpen(false)
    setHighlightIndex(null)
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
    setHighlightIndex(null)
  }

  const handleSave = async () => {
    // savingRef: state(saveState)로 disabled를 걸어도 리렌더가 한 박자 늦어서, 아주 빠른 연속
    // 클릭(더블클릭 등)은 둘 다 disabled 반영 전에 통과해 insert가 두 번 나갈 수 있다 — ref는
    // 동기적으로 바로 반영되니 여기서 즉시 막는다.
    if (!user || !route || savingRef.current || isDuplicateOfSaved || savedCoursesLoading) return
    savingRef.current = true
    setSaveState('saving')
    // #39 — GPS 원본 좌표는 서버로 절대 보내지 않는다(전송 자체만으로 위치정보법 신고
    // 대상이 될 수 있음). 화면(라이브 계산)에는 정밀 GPS를 계속 쓰되, 저장하는 값만
    // 가장 가까운 프리셋으로 치환한다 — preset/pick/search 출처는 그대로 저장된다.
    const safeOrigin = sanitizeOriginForSave(origin, getRegion(regionId))
    const { error } = await supabase.from('saved_courses').insert({
      user_id: user.id,
      title: '대전한바퀴',
      travel_mode: travelMode,
      stops: route.stops,
      origin: safeOrigin,
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
            <b>
              {breadDone && <CompletionMark />}
              {breadDone ? '빵집 찾기 완료' : '빵집 찾기'}
            </b>
            {!breadDone && (
              <button type="button" className="primary-btn" onClick={onStartBreadSurvey}>
                설문하러 가기
              </button>
            )}
          </div>
          <div className={`pil-gate-card${tourDone ? ' done' : ''}`}>
            <b>
              {tourDone && <CompletionMark />}
              {tourDone ? '관광모아 완료' : '관광모아'}
            </b>
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

  // 상단 요약 배지 — "계산 자체가 성공했나"(preciseMinutes/preciseDistanceKm != null)만 보면
  // 구간 5개 중 1개만 추정으로 채워져도(예: 대중교통은 거리가 항상 추정, 자동차도 대체 지점
  // 폴백을 탄 구간이 섞이면) 전체를 "실측"으로 잘못 표시한다(리뷰 발견) — 구간 배열이 하나라도
  // 추정이면 전체도 추정으로 내린다.
  const minutesFullyMeasured =
    preciseMinutes != null && (!legMinutesEstimated || legMinutesEstimated.every((e) => !e))
  const distanceFullyMeasured =
    preciseDistanceKm != null && (!legDistanceEstimated || legDistanceEstimated.every((e) => !e))

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
                예상 소요 <PrecisionTag precise={minutesFullyMeasured} />
              </span>
            </div>
            <div>
              <b>{formatDistance(preciseDistanceKm ?? route.totalDistanceKm)}</b>
              <span>
                이동 거리(편도) <PrecisionTag precise={distanceFullyMeasured} />
              </span>
            </div>
            <div>
              <b>{route.stops.length}곳</b>
              <span>방문 예정</span>
            </div>
            {travelMode === 'car' && Number.isFinite(taxiFare) && (
              <div>
                <b>{taxiFare.toLocaleString()}원</b>
                <span>예상 택시요금</span>
              </div>
            )}
          </div>
        ) : (
          <p className="pil-empty-msg">코스가 비었어요 — 아래 "추가하기"로 빵집·관광지를 넣어보세요.</p>
        )}

        {travelMode === 'transit' && (
          <p className="pil-transit-notice">
            대중교통 시간은 추정치입니다. 정확한 시간표·환승은 각 경유지의 카카오맵 링크에서 확인하세요.
          </p>
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
              {/* 리뷰 발견: 이전엔 마우스 전용 <span>이라 키보드/스크린리더로는 이 화면의 핵심
                  인터랙션(리스트→지도 하이라이트)에 접근할 방법이 자체가 없었다. <button>으로
                  바꾸면 tabIndex/role/Enter·Space 활성화가 전부 브라우저 기본 동작으로 딸려온다
                  (직접 onKeyDown을 짜서 흉내내는 것보다 안전). 클릭은 마우스든 터치든 키보드든
                  전부 이 하나의 onClick으로 들어온다 — 예전에 onClick과 onMouseEnter가 터치에서
                  충돌하던 문제(§CP11-4)도 이 구조에선 재발하지 않는다: 버튼 클릭은 호버 상태와
                  무관하게 항상 같은 index로 고정하는 동작이라 순서가 꼬일 여지가 없다. */}
              <button
                type="button"
                className="pil-stop-info"
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseLeave={() => setHighlightIndex(null)}
                onClick={() => setHighlightIndex(index)}
              >
                <span className="pil-stop-name">{stop.name}</span>
                <span className="pil-stop-type">
                  {stop.type === 'attraction' ? '📍 관광지' : '🥐 빵집'}
                  {legDistancesKm && legMinutes && (
                    <> · 이전 경유지에서 {formatDistance(legDistancesKm[index]) ?? '-'} · {legMinutes[index] ?? '-'}분</>
                  )}
                </span>
              </button>
              {travelMode === 'transit' && (
                <a
                  className="pil-stop-transit-link"
                  href={kakaoTransitLink(
                    index === 0 ? { name: origin.label || '출발지', lat: origin.lat, lng: origin.lng } : route.stops[index - 1],
                    stop,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${stop.name} 카카오맵에서 실제 경로 보기`}
                  title="카카오맵에서 실제 경로 보기"
                >
                  ↗
                </a>
              )}
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
// midpointOf()는 lib/distance.js에 있다(node --test로 유닛테스트하려면 JSX 없는 순수 .js
// 파일에 있어야 해서 — 리뷰 발견: 컴포넌트 파일 안에 있으면 테스트 러너가 못 불러온다).
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
  const overlaysRef = useRef([]) // 출발/경유지 번호 핀만 — 하이라이트 라벨은 별도 ref로 관리
  const polylinesRef = useRef([])
  const highlightOverlayRef = useRef(null)

  // 지도 생성 + 핀/기본 경로선 그리기. highlightIndex는 여기서 안 본다 — 예전엔 이 effect가
  // highlightIndex에도 반응해서, 리스트를 호버할 때마다 전체를 지웠다 다시 그리고
  // map.setBounds()까지 매번 다시 불러 사용자가 확대/이동해둔 뷰가 계속 전체 경로 범위로
  // 튕기고 선이 깜빡이는 버그가 있었다(리뷰 발견). 하이라이트는 아래 두 번째 effect가 이미
  // 그려진 폴리라인 스타일만 바꾸는 방식으로 분리했다.
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
    if (highlightOverlayRef.current) {
      highlightOverlayRef.current.setMap(null)
      highlightOverlayRef.current = null
    }

    const points = [origin, ...stops]
    const bounds = new kakao.maps.LatLngBounds()

    for (let i = 0; i < points.length - 1; i++) {
      const legPoints = legPaths?.[i]?.length > 0 ? legPaths[i] : [points[i], points[i + 1]]
      const path = legPoints.map((p) => new kakao.maps.LatLng(p.lat, p.lng))
      path.forEach((ll) => bounds.extend(ll))
      const isEstimated = legEstimated ? legEstimated[i] : legPaths?.[i]?.length > 0 ? false : true
      polylinesRef.current.push(
        new kakao.maps.Polyline({
          map,
          path,
          strokeWeight: 4,
          strokeColor: '#F2814A',
          strokeOpacity: 0.85,
          // 실API로 구한 구간이면 실선, 보정계수 어림값이면 점선으로 구분.
          strokeStyle: isEstimated ? 'shortdash' : 'solid',
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

    // 리뷰 발견(PLAUSIBLE): 언마운트 시 폴리라인/오버레이를 정리하는 cleanup이 없었다 — 카카오
    // SDK가 map 인스턴스를 어떻게 회수하는지와 별개로, 이 컴포넌트가 만든 오버레이들은 최소한
    // 명시적으로 setMap(null) 해서 정리한다.
    return () => {
      overlaysRef.current.forEach((o) => o.setMap(null))
      polylinesRef.current.forEach((p) => p.setMap(null))
      if (highlightOverlayRef.current) {
        highlightOverlayRef.current.setMap(null)
        highlightOverlayRef.current = null
      }
    }
  }, [loaded, origin, stops, legPaths, legEstimated])

  // 하이라이트 갱신 전용 — 위 effect가 이미 만들어둔 폴리라인의 스타일만 바꾸고, 강조된 구간에만
  // 라벨 오버레이를 추가/제거한다. bounds/핀/기본 선을 다시 안 그려서 사용자가 확대·이동해둔
  // 뷰가 안 튕긴다.
  useEffect(() => {
    if (!mapRef.current || polylinesRef.current.length === 0) return
    const { kakao } = window
    const map = mapRef.current
    const points = [origin, ...stops]

    polylinesRef.current.forEach((polyline, i) => {
      const isHighlighted = i === highlightIndex
      const isEstimated = legEstimated ? legEstimated[i] : false
      polyline.setOptions({
        strokeWeight: isHighlighted ? 7 : 4,
        strokeColor: isHighlighted ? '#D9591A' : '#F2814A',
        strokeStyle: isEstimated ? 'shortdash' : 'solid',
      })
    })

    if (highlightOverlayRef.current) {
      highlightOverlayRef.current.setMap(null)
      highlightOverlayRef.current = null
    }
    if (
      highlightIndex != null &&
      legDistancesKm &&
      legMinutes &&
      points[highlightIndex] &&
      points[highlightIndex + 1]
    ) {
      const legPoints =
        legPaths?.[highlightIndex]?.length > 0
          ? legPaths[highlightIndex]
          : [points[highlightIndex], points[highlightIndex + 1]]
      const mid = midpointOf(legPoints)
      highlightOverlayRef.current = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(mid.lat, mid.lng),
        content: `<div class="pil-leg-label">${formatDistance(legDistancesKm[highlightIndex]) ?? '-'} · ${legMinutes[highlightIndex] ?? '-'}분</div>`,
        yAnchor: 1.4,
      })
    }

    return () => {
      if (highlightOverlayRef.current) {
        highlightOverlayRef.current.setMap(null)
        highlightOverlayRef.current = null
      }
    }
  }, [highlightIndex, origin, stops, legPaths, legDistancesKm, legMinutes, legEstimated])

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
