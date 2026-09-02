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

// 대부분의 구는 투영된 bbox 중심이 라벨 자리로 충분하다.
// 동구·대덕구는 L자에 가까운 오목한 형태라 bbox 중심이 변 쪽으로 치우쳐 어색해서,
// 이 두 구만 면적 무게중심(폴리곤 centroid)을 쓴다 — "가장 중앙"에 가깝다.
const CENTROID_DISTRICTS = new Set(['동구', '대덕구'])

// 시각적 중심 보정. 중구는 오른쪽 경계가 길게 뻗어 bbox 중심보다 글자가 살짝
// 오른쪽으로 보여서, 모든 스탬프 지도에서 약 2~4px 왼쪽으로 보이도록 이동한다.
const LABEL_OFFSETS = Object.freeze({
  중구: [-3, 0],
})

function ringBboxCenter(pts) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

function ringCentroid(pts) {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const f = x0 * y1 - x1 * y0
    area += f
    cx += (x0 + x1) * f
    cy += (y0 + y1) * f
  }
  area *= 0.5
  return [cx / (6 * area), cy / (6 * area)]
}

function ringLabelAnchor(name, ring) {
  const pts = ring.map((pt) => projectPoint(pt).split(' ').map(Number))
  const [x, y] = CENTROID_DISTRICTS.has(name) ? ringCentroid(pts) : ringBboxCenter(pts)
  const [offsetX = 0, offsetY = 0] = LABEL_OFFSETS[name] ?? []
  return { cx: round2(x + offsetX), cy: round2(y + offsetY) }
}

export const STAMP_VIEWBOX = `0 0 ${WIDTH} ${HEIGHT}`

export const DISTRICT_PATHS = Object.freeze(
  Object.entries(DISTRICT_RINGS).map(([name, ring]) => ({
    name,
    d: projectRing(ring),
    ...ringLabelAnchor(name, ring),
  })),
)
