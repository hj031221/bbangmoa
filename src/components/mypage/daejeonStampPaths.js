import { DISTRICT_RINGS } from '../../data/daejeonDistricts.js'

// DISTRICT_RINGS([lat,lng] 링)를 로드 시 한 번 SVG 좌표계로 투영한다.
// 5개 구 전체의 bbox 를 공유해 지도가 서로 맞물리게 하고, 위도에 따른 경도 축소
// (cos(lat))를 보정해 형태 왜곡을 줄인다. y 는 북이 위로 오도록 뒤집는다.
const WIDTH = 320
const PAD = 8

const rings = Object.values(DISTRICT_RINGS)
let minLat = Infinity
let maxLat = -Infinity
let minLng = Infinity
let maxLng = -Infinity
for (const ring of rings) {
  for (const [lat, lng] of ring) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
}

const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) // 경도 1도의 가로 실제 비율
const spanX = (maxLng - minLng) * kx
const spanY = maxLat - minLat
const scale = (WIDTH - 2 * PAD) / spanX
const HEIGHT = Math.round(spanY * scale + 2 * PAD)

const round2 = (n) => Math.round(n * 100) / 100

function projectPoint([lat, lng]) {
  const x = PAD + (lng - minLng) * kx * scale
  const y = PAD + (maxLat - lat) * scale // 북이 위
  return `${round2(x)} ${round2(y)}`
}

export function projectRing(ring) {
  return (
    'M' +
    ring.map((pt, i) => `${i === 0 ? '' : 'L'}${projectPoint(pt)}`).join(' ') +
    ' Z'
  )
}

function pointInPolygon(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// 라벨 앵커 = "접근 불가능 극점" — 폴리곤 내부에서 모든 변으로부터 가장 먼 점.
// bbox 중심·꼭짓점 평균은 오목하거나 L자형인 구(동구·대덕구)에서 라벨이 변에 붙어
// 어색해진다. 격자 탐색으로 가장 살집 두꺼운 지점을 찾는다(모듈 로드 시 5회).
function ringLabelAnchor(ring) {
  const pts = ring.map((pt) => projectPoint(pt).split(' ').map(Number))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)

  let best = [(x0 + x1) / 2, (y0 + y1) / 2]
  let bestDist = -1
  const STEPS = 64
  for (let i = 1; i < STEPS; i++) {
    for (let j = 1; j < STEPS; j++) {
      const x = x0 + ((x1 - x0) * i) / STEPS
      const y = y0 + ((y1 - y0) * j) / STEPS
      if (!pointInPolygon(x, y, pts)) continue
      let minEdge = Infinity
      for (let k = 0, m = pts.length - 1; k < pts.length; m = k++) {
        const dEdge = distToSegment(x, y, pts[m][0], pts[m][1], pts[k][0], pts[k][1])
        if (dEdge < minEdge) minEdge = dEdge
      }
      if (minEdge > bestDist) {
        bestDist = minEdge
        best = [x, y]
      }
    }
  }
  return { cx: round2(best[0]), cy: round2(best[1]) }
}

export const STAMP_VIEWBOX = `0 0 ${WIDTH} ${HEIGHT}`

export const DISTRICT_PATHS = Object.freeze(
  Object.entries(DISTRICT_RINGS).map(([name, ring]) => ({
    name,
    d: projectRing(ring),
    ...ringLabelAnchor(ring),
  })),
)
