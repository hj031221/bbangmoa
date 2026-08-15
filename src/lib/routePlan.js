// CP6-2 — 관광모아 결과 + 빵모아 결과를 하나의 기본 코스로 합친다.
//   routeInput = { breadResult, tourResult, origin, travelMode }
//     breadResult: pickBreadResult(answers) 결과에 matchBakeries() 결과를 bakeries 로 얹은 것
//     tourResult:  getTourRecommendation(tourAnswers, attractions) 결과
//   routeResult = { stops, totalDistanceKm, totalMinutes, travelMode }
import { haversineKm } from './distance.js'
import { travelMin } from './travelTime.js'

const ATTRACTION_COUNT = 2
const BAKERY_COUNT = 3

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
function summarize(origin, orderedStops, travelMode) {
  let totalDistanceKm = 0
  let totalMinutes = 0
  let prev = origin
  for (const stop of orderedStops) {
    totalDistanceKm += haversineKm(prev, stop)
    totalMinutes += travelMin(prev, stop, travelMode)
    prev = stop
  }
  return { totalDistanceKm: Math.round(totalDistanceKm * 10) / 10, totalMinutes }
}

// 이미 순서가 정해진 stops(사용자가 손으로 드래그해서 바꾼 순서 등)로 합계만 다시 낸다 —
// 그리디로 재정렬하지 않고 주어진 순서를 그대로 존중한다.
export function summarizeOrder(origin, orderedStops, travelMode = 'car') {
  if (!origin || !orderedStops || orderedStops.length === 0) return null
  const stops = orderedStops.map((stop, i) => ({ ...stop, order: i + 1 }))
  const { totalDistanceKm, totalMinutes } = summarize(origin, stops, travelMode)
  return { stops, totalDistanceKm, totalMinutes, travelMode }
}

// origin + 후보 stops(타입 무관, 순서 없는 배열) → 그리디로 순서를 매기고 합계를 낸 routeResult.
// CP6-3의 추가/제거 후 재계산에도 그대로 쓴다(§07).
export function recalcRoute(origin, candidateStops, travelMode = 'car') {
  if (!origin || !candidateStops || candidateStops.length === 0) return null
  const stops = buildGreedyOrder(origin, candidateStops)
  const { totalDistanceKm, totalMinutes } = summarize(origin, stops, travelMode)
  return { stops, totalDistanceKm, totalMinutes, travelMode }
}

// breadResult + tourResult + origin → 기본 코스(관광지 2 + 빵집 3, 후보가 모자라면 있는 만큼만).
export function buildRoute({ breadResult, tourResult, origin, travelMode = 'car' }) {
  if (!breadResult || !tourResult || !origin) return null

  const attractionStops = (tourResult.results || []).slice(0, ATTRACTION_COUNT).map(toAttractionStop)
  const bakeryStops = (breadResult.bakeries || []).slice(0, BAKERY_COUNT).map(toBakeryStop)
  const candidates = [...attractionStops, ...bakeryStops]
  return recalcRoute(origin, candidates, travelMode)
}
