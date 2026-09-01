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

export const STAMP_VIEWBOX = `0 0 ${WIDTH} ${HEIGHT}`

export const DISTRICT_PATHS = Object.freeze(
  Object.entries(DISTRICT_RINGS).map(([name, ring]) => ({ name, d: projectRing(ring) })),
)
