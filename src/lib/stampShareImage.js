import { STAMP_VIEWBOX, DISTRICT_PATHS } from '../components/mypage/daejeonStampPaths.js'

const W = 1080
const H = 1350
// 캔버스 래스터에는 CSS 변수가 안 먹으므로 styles.css 브랜드 색을 리터럴로 고정한다.
const BG = '#fdf6ec'
const INK = '#3d2b1f'
const ACCENT = '#d98a3d'
const BROWN = '#6b4a2b'
const MUTED = '#9a8778'
const TRACK = '#eaddcb'
const FONT =
  "-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif"

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  )

function fillOpacity(pct) {
  return (0.15 + (0.85 * pct) / 100).toFixed(3)
}

export function buildStampCardSvg({ nickname, stamp, targetPerDistrict }) {
  const trimmed = String(nickname ?? '').trim().slice(0, 12)
  const title = trimmed ? `${esc(trimmed)}님의 대전 빵 스탬프` : '내 대전 빵 스탬프'
  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.goalPct]))

  const mapPaths = DISTRICT_PATHS.map(
    ({ name, d }) =>
      `<path d="${d}" fill="${ACCENT}" fill-opacity="${fillOpacity(pctByName[name] ?? 0)}"` +
      ` stroke="${BROWN}" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
  ).join('')

  const mapLabels = DISTRICT_PATHS.map(({ name, cx, cy }) => {
    const dark = (pctByName[name] ?? 0) >= 55
    return (
      `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"` +
      ` font-size="11" font-weight="700" fill="${dark ? '#ffffff' : BROWN}">${esc(name)}</text>`
    )
  }).join('')

  const rows = stamp.perDistrict
    .map((d, i) => {
      const y = 1000 + i * 58
      const barW = Math.round((Math.min(100, d.goalPct) / 100) * 560)
      return (
        `<text x="90" y="${y + 22}" font-size="26" font-weight="700" fill="${INK}">${esc(d.name)}</text>` +
        `<rect x="230" y="${y + 3}" width="560" height="26" rx="13" fill="${TRACK}"/>` +
        (barW > 0
          ? `<rect x="230" y="${y + 3}" width="${barW}" height="26" rx="13" fill="${ACCENT}"/>`
          : '') +
        `<text x="990" y="${y + 22}" text-anchor="end" font-size="24" font-weight="700" fill="${BROWN}">` +
        `${d.completedSlots}/${d.target}</text>`
      )
    })
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"` +
    ` font-family="${FONT}">` +
    `<rect width="${W}" height="${H}" fill="${BG}"/>` +
    `<text x="${W / 2}" y="120" text-anchor="middle" font-size="48" font-weight="800" fill="${INK}">${title}</text>` +
    `<svg x="140" y="170" width="800" height="560" viewBox="${STAMP_VIEWBOX}" preserveAspectRatio="xMidYMid meet">` +
    `${mapPaths}${mapLabels}</svg>` +
    `<text x="${W / 2}" y="830" text-anchor="middle" font-size="72" font-weight="800" fill="${ACCENT}">` +
    `스탬프 ${stamp.completedSlots}/${stamp.totalSlots}</text>` +
    `<text x="${W / 2}" y="892" text-anchor="middle" font-size="36" font-weight="700" fill="${INK}">` +
    `목표 달성률 ${stamp.goalPct}%</text>` +
    `<text x="${W / 2}" y="945" text-anchor="middle" font-size="27" fill="${MUTED}">` +
    `${stamp.completedDistrictCount}/5개 구 목표 완료 · 목표 구마다 ${targetPerDistrict}곳</text>` +
    rows +
    `<text x="${W / 2}" y="${H - 48}" text-anchor="middle" font-size="26" font-weight="700" fill="${MUTED}">` +
    `빵모아 · 대전 빵집 스탬프 투어</text>` +
    `</svg>`
  )
}

// SVG 문자열 → PNG Blob. 외부 리소스가 없어 canvas taint 로 toBlob 이 throw 하지 않는다.
export function rasterizeStampCard(svgString) {
  return new Promise((resolve, reject) => {
    let url
    try {
      url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)))
    } catch (err) {
      reject(err)
      return
    }
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 1080
        canvas.height = 1350
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 1080, 1350)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('toBlob 가 null 을 반환'))),
          'image/png',
        )
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('SVG 이미지 로드 실패'))
    img.src = url
  })
}
