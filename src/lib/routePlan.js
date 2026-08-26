// CP6-2 — 관광모아 결과 + 빵모아 결과를 하나의 기본 코스로 합친다.
//   routeInput = { breadResult, tourResult, origin, travelMode }
//     breadResult: pickBreadResult(answers) 결과에 matchBakeries() 결과를 bakeries 로 얹은 것
//     tourResult:  getTourRecommendation(tourAnswers, attractions) 결과
//   routeResult = { stops, totalDistanceKm, totalMinutes, travelMode }
import { haversineKm } from './distance.js'
import { travelMin, estimateKm } from './travelTime.js'

const ATTRACTION_COUNT = 2
const BAKERY_COUNT = 3

// 좌표가 유효한지(NaN/null/undefined 아닌지). "찜한 코스 불러오기"(옛 스키마 잔여 데이터 등)로
// lat/lng가 없는 stop이 들어올 수 있어, haversineKm에 그대로 넘기기 전에 걸러야 한다 — 안 그러면
// null이 산술 연산에서 0으로 강제 형변환되며 적도/그리니치 기준 수천km짜리 거리로 조용히
// 틀어진다(다른 좌표 소비처인 bakeryDistance.js, AddStopModal.jsx는 이미 이렇게 검증한다).
function hasValidCoords(p) {
  return Number.isFinite(p?.lat) && Number.isFinite(p?.lng)
}

function toAttractionStop({ attraction }) {
  return { type: 'attraction', id: attraction.id, name: attraction.name, lat: attraction.lat, lng: attraction.lng }
}

function toBakeryStop(bakery) {
  return { type: 'bakery', id: bakery.id, name: bakery.name, lat: bakery.lat, lng: bakery.lng }
}

// origin에서 시작해 미방문 노드 중 최근접을 반복 선택(그리디). 관광지/빵집 타입 구분 없이 섞는다.
export function buildGreedyOrder(origin, stops) {
  const remaining = [...stops]
  const ordered = []
  let cur = origin
  while (remaining.length > 0) {
    remaining.sort((a, b) => haversineKm(cur, a) - haversineKm(cur, b))
    const next = remaining.shift()
    ordered.push(next)
    cur = next
  }
  return ordered.map((stop, i) => ({ ...stop, order: i + 1 }))
}

// origin → 순서대로 stops를 지날 때의 총 이동거리(km)/총 이동시간(분).
// 실API 응답 전 최초 렌더용 근사치라 DETOUR 보정을 적용한다(travelMin과 짝) — 순수 직선거리를
// 그대로 쓰면 실측(카카오모빌리티 실API로 확인됨)보다 1.6~2.7배 작게 나온다.
function summarize(origin, orderedStops, travelMode) {
  let totalDistanceKm = 0
  let totalMinutes = 0
  let prev = origin
  for (const stop of orderedStops) {
    totalDistanceKm += estimateKm(prev, stop)
    totalMinutes += travelMin(prev, stop, travelMode)
    prev = stop
  }
  return { totalDistanceKm: Math.round(totalDistanceKm * 10) / 10, totalMinutes }
}

// 이미 순서가 정해진 stops(사용자가 손으로 드래그해서 바꾼 순서 등)로 합계만 다시 낸다 —
// 그리디로 재정렬하지 않고 주어진 순서를 그대로 존중한다.
export function summarizeOrder(origin, orderedStops, travelMode = 'car') {
  if (!origin || !orderedStops || orderedStops.length === 0) return null
  const valid = orderedStops.filter(hasValidCoords)
  if (valid.length === 0) return null
  const stops = valid.map((stop, i) => ({ ...stop, order: i + 1 }))
  const { totalDistanceKm, totalMinutes } = summarize(origin, stops, travelMode)
  return { stops, totalDistanceKm, totalMinutes, travelMode }
}

// origin + 후보 stops(타입 무관, 순서 없는 배열) → 그리디로 순서를 매기고 합계를 낸 routeResult.
// CP6-3의 추가/제거 후 재계산에도 그대로 쓴다(§07).
export function recalcRoute(origin, candidateStops, travelMode = 'car') {
  if (!origin || !candidateStops || candidateStops.length === 0) return null
  const valid = candidateStops.filter(hasValidCoords)
  if (valid.length === 0) return null
  const stops = buildGreedyOrder(origin, valid)
  const { totalDistanceKm, totalMinutes } = summarize(origin, stops, travelMode)
  return { stops, totalDistanceKm, totalMinutes, travelMode }
}

// breadResult + tourResult + origin → 기본 코스(관광지 2 + 빵집 3, 후보가 모자라면 있는 만큼만).
export function buildRoute({ breadResult, tourResult, origin, travelMode = 'car' }) {
  if (!breadResult || !tourResult || !origin) return null

  // 관광모아는 "고른 구(행정구) 안에서"만 테마 적합도로 TOP3(1~3개)를 뽑는다 — origin과의
  // 거리는 안 본다. 구는 도심부터 외곽까지 넓어서(예: 같은 구에 대전역도, 대청호도 있음) 같은
  // 구 안이라는 이유만으로 출발지에서 아주 먼 후보가 섞여 나올 수 있다. 여기 경로 결합 단계에서만
  // origin에 더 가까운 순으로 다시 골라 "적당히" 먼 후보를 제외한다 — 관광모아 자체 로직(테마
  // 점수·동점처리 등)은 안 건드린다.
  const attractionCandidates = [...(tourResult.results || [])].sort(
    (a, b) => haversineKm(origin, a.attraction) - haversineKm(origin, b.attraction),
  )
  const attractionStops = attractionCandidates.slice(0, ATTRACTION_COUNT).map(toAttractionStop)
  const bakeryStops = (breadResult.bakeries || []).slice(0, BAKERY_COUNT).map(toBakeryStop)
  const candidates = [...attractionStops, ...bakeryStops]
  return recalcRoute(origin, candidates, travelMode)
}
