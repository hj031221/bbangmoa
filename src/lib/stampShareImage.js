import { STAMP_VIEWBOX, DISTRICT_PATHS } from '../components/mypage/daejeonStampPaths.js'

const W = 1080
const H = 1350

// 사이트(styles.css)의 실제 브랜드 토큰. 공유 이미지는 독립 SVG로 래스터화되므로
// CSS 변수 대신 같은 값을 고정하고, 아래 loadStampCardFontCss()에서 사이트 폰트도 내장한다.
const COLORS = Object.freeze({
  paper: '#FFF8E9',
  paperDeep: '#FCEFD2',
  panel: '#F6DBA8',
  ink: '#4C310D',
  brown: '#705945',
  muted: '#A98561',
  line: '#E2C1A3',
  accent: '#F97658',
  accentDeep: '#D9603D',
  white: '#FFFFFF',
})

const FONT_REGULAR_URL =
  'https://fastly.jsdelivr.net/gh/projectnoonnu/2408-5@1.0/HakgyoansimDunggeunmisoTTF-R.woff2'
const FONT_BOLD_URL =
  'https://fastly.jsdelivr.net/gh/projectnoonnu/2408-5@1.0/HakgyoansimDunggeunmisoTTF-B.woff2'
const LOGO_ASSET_URL = new URL('../assets/logo-typeA-full.png', import.meta.url).href
const FONT_FAMILY = "'BbangMoa Round', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"

let fontCssPromise
let logoDataUrlPromise

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  )

function clampPct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0
}

function truncateGraphemes(value, maxLength) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segments = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)]
    return segments.slice(0, maxLength).map(({ segment }) => segment).join('')
  }
  return Array.from(text).slice(0, maxLength).join('')
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

async function fetchFontData(url) {
  const response = await fetch(url, { mode: 'cors', cache: 'force-cache' })
  if (!response.ok) throw new Error(`공유 이미지 폰트 로드 실패 (${response.status})`)
  return arrayBufferToBase64(await response.arrayBuffer())
}

async function fetchImageDataUrl(url) {
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`공유 이미지 로고 로드 실패 (${response.status})`)
  const mime = response.headers.get('content-type') || 'image/png'
  return `data:${mime};base64,${arrayBufferToBase64(await response.arrayBuffer())}`
}

// data URL SVG 안에서도 사이트 폰트가 그대로 렌더되도록 WOFF2를 SVG에 직접 내장한다.
// 성공 결과는 모듈 수명 동안 재사용한다.
export function loadStampCardFontCss() {
  if (!fontCssPromise) {
    fontCssPromise = Promise.all([
      fetchFontData(FONT_REGULAR_URL),
      fetchFontData(FONT_BOLD_URL),
    ]).then(
      ([regular, bold]) =>
        `<style>` +
        `@font-face{font-family:'BbangMoa Round';src:url(data:font/woff2;base64,${regular}) format('woff2');font-weight:400}` +
        `@font-face{font-family:'BbangMoa Round';src:url(data:font/woff2;base64,${bold}) format('woff2');font-weight:700 900}` +
        `text{font-family:${FONT_FAMILY}}</style>`,
    )
  }
  return fontCssPromise
}

// canvas 변환 시에도 실제 로고가 남도록 앱 번들에 포함된 PNG를 data URL로 바꾼다.
export function loadStampCardLogoDataUrl() {
  if (!logoDataUrlPromise) logoDataUrlPromise = fetchImageDataUrl(LOGO_ASSET_URL)
  return logoDataUrlPromise
}

export function getStampGoalMessage(goalPct) {
  const pct = clampPct(goalPct)
  if (pct >= 100) return '대전 5개 구를 모두 채웠어요'
  if (pct >= 75) return '다섯 구 완주가 눈앞이에요'
  if (pct >= 50) return '어느새 절반 넘게 채웠어요'
  if (pct >= 25) return '빵집을 차근차근 알아가는 중'
  if (pct > 0) return '한 곳씩 빵집을 발견하는 중'
  return '첫 스탬프부터 시작해 볼까요?'
}

function breadMark(x, y, scale = 1) {
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${COLORS.accent}" stroke-width="5" stroke-linecap="round">` +
    `<path d="M3 28C3 13 15 3 31 3h22c16 0 28 10 28 25v25H3Z" fill="${COLORS.paperDeep}"/>` +
    `<path d="M24 14l-7 12M43 12l-7 14M61 14l-7 12"/>` +
    `</g>`
  )
}

function brandMark(logoDataUrl) {
  if (!logoDataUrl) return breadMark(72, 54, 0.58)

  // 원본은 심볼 아래에 워드마크가 붙은 세로형 로고다. 좌측 상단에서는 심볼만
  // 또렷하게 보이도록 원본 상단을 viewBox로 잘라 쓰고 옆의 텍스트와 조합한다.
  return (
    `<svg x="68" y="36" width="62" height="69" viewBox="0 0 338 375" overflow="hidden"` +
    ` preserveAspectRatio="xMidYMid meet">` +
    `<image href="${esc(logoDataUrl)}" width="338" height="457"/>` +
    `</svg>`
  )
}

export function buildStampCardSvg({
  nickname,
  stamp,
  targetPerDistrict,
  fontCss = '',
  logoDataUrl = '',
}) {
  const displayName = truncateGraphemes(nickname, 12)
  const safeName = esc(displayName)
  const ownerLabel = displayName ? `${safeName}님의` : '내'
  const perDistrict = Array.isArray(stamp?.perDistrict) ? stamp.perDistrict : []
  const pctByName = Object.fromEntries(
    perDistrict.map((district) => [district.name, clampPct(district.goalPct)]),
  )
  const target = Number.isFinite(Number(targetPerDistrict)) ? Number(targetPerDistrict) : 3
  const goalPct = clampPct(stamp?.goalPct)
  const goalMessage = getStampGoalMessage(goalPct)

  const mapPaths = DISTRICT_PATHS.map(({ name, d }) => {
    const pct = pctByName[name] ?? 0
    const opacity = (0.18 + (0.82 * pct) / 100).toFixed(3)
    return (
      `<path d="${d}" fill="${COLORS.accent}" fill-opacity="${opacity}"` +
      ` stroke="${COLORS.ink}" stroke-opacity="0.72" stroke-width="1.35"/>`
    )
  }).join('')

  const mapLabels = DISTRICT_PATHS.map(({ name, cx, cy }) => {
    const dark = (pctByName[name] ?? 0) >= 55
    return (
      `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"` +
      ` font-size="14" font-weight="700" fill="${dark ? COLORS.white : COLORS.ink}"` +
      ` stroke="${dark ? COLORS.brown : COLORS.white}" stroke-opacity="0.45" stroke-width="2" paint-order="stroke">${esc(name)}</text>`
    )
  }).join('')

  const rows = perDistrict
    .map((district, index) => {
      const y = 940 + index * 58
      const pct = clampPct(district.goalPct)
      const barWidth = Math.round((pct / 100) * 610)
      const completed = district.completed === true
      return (
        `<g>` +
        `<text x="72" y="${y + 25}" font-size="25" font-weight="700" fill="${COLORS.ink}">${esc(district.name)}</text>` +
        `<rect x="210" y="${y + 7}" width="610" height="20" rx="10" fill="${COLORS.panel}"/>` +
        (barWidth > 0
          ? `<rect x="210" y="${y + 7}" width="${barWidth}" height="20" rx="10" fill="${COLORS.accent}"/>`
          : '') +
        `<text x="925" y="${y + 25}" text-anchor="end" font-size="24" font-weight="700" fill="${COLORS.brown}" font-variant-numeric="tabular-nums">` +
        `${Number(district.completedSlots) || 0}<tspan fill="${COLORS.muted}"> / ${Number(district.target) || target}</tspan></text>` +
        `<rect x="956" y="${y + 3}" width="38" height="32" rx="10" fill="${completed ? COLORS.accent : COLORS.paperDeep}"/>` +
        `<text x="975" y="${y + 25}" text-anchor="middle" font-size="19" font-weight="700" fill="${completed ? COLORS.white : COLORS.line}">${completed ? '✓' : '·'}</text>` +
        `</g>`
      )
    })
    .join('')

  const completedSlots = Number(stamp?.completedSlots) || 0
  const totalSlots = Number(stamp?.totalSlots) || target * 5
  const completedDistrictCount = Number(stamp?.completedDistrictCount) || 0
  const visitedBakeryCount = Number(stamp?.visitedBakeryCount) || 0

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"` +
    ` font-family="${FONT_FAMILY}">` +
    `<title>${ownerLabel} 대전 빵 스탬프 · 스탬프 ${completedSlots}/${totalSlots} · 목표 달성률 ${goalPct}%</title>` +
    `<desc>대전 5개 구 인증 방문 스탬프 진행도</desc>` +
    `<defs>` +
    fontCss +
    `<pattern id="crumbs" width="46" height="46" patternUnits="userSpaceOnUse">` +
    `<circle cx="8" cy="9" r="2.2" fill="${COLORS.line}" opacity="0.36"/>` +
    `<path d="M28 30l5 3" stroke="${COLORS.line}" stroke-width="2.2" stroke-linecap="round" opacity="0.28"/>` +
    `</pattern>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="${COLORS.paper}"/>` +
    `<rect width="${W}" height="${H}" fill="url(#crumbs)"/>` +
    `<rect width="${W}" height="18" fill="${COLORS.accent}"/>` +
    brandMark(logoDataUrl) +
    `<text x="146" y="89" font-size="29" font-weight="700" fill="${COLORS.ink}" letter-spacing="0.5">빵모아</text>` +
    `<text x="1008" y="86" text-anchor="end" font-size="18" font-weight="700" fill="${COLORS.muted}">${goalMessage}</text>` +
    `<text x="72" y="172" font-size="27" font-weight="700" fill="${COLORS.accentDeep}">${ownerLabel}</text>` +
    `<text x="72" y="232" font-size="56" font-weight="700" fill="${COLORS.ink}" letter-spacing="-1.6">대전 빵 스탬프</text>` +
    `<line x1="72" y1="274" x2="1008" y2="274" stroke="${COLORS.line}" stroke-width="2"/>` +
    `<text x="72" y="350" font-size="22" font-weight="700" fill="${COLORS.muted}" letter-spacing="1.2">목표 달성률</text>` +
    `<text x="64" y="508" font-size="164" font-weight="700" fill="${COLORS.accent}" letter-spacing="-8" font-variant-numeric="tabular-nums">${goalPct}</text>` +
    `<text x="326" y="500" font-size="52" font-weight="700" fill="${COLORS.accentDeep}">%</text>` +
    `<line x1="72" y1="548" x2="366" y2="548" stroke="${COLORS.line}" stroke-width="2"/>` +
    `<text x="72" y="590" font-size="24" fill="${COLORS.muted}">채운 스탬프</text>` +
    `<text x="72" y="650" font-size="48" font-weight="700" fill="${COLORS.ink}" font-variant-numeric="tabular-nums">${completedSlots}<tspan font-size="28" fill="${COLORS.muted}"> / ${totalSlots}</tspan></text>` +
    `<text x="72" y="716" font-size="24" fill="${COLORS.muted}">완료한 구</text>` +
    `<text x="72" y="776" font-size="48" font-weight="700" fill="${COLORS.ink}" font-variant-numeric="tabular-nums">${completedDistrictCount}<tspan font-size="28" fill="${COLORS.muted}"> / 5</tspan></text>` +
    `<rect x="412" y="312" width="596" height="494" rx="46" fill="${COLORS.panel}"/>` +
    `<path d="M970 312h38v38" fill="none" stroke="${COLORS.accent}" stroke-width="12" stroke-linecap="round"/>` +
    `<svg x="500" y="344" width="420" height="414" viewBox="${STAMP_VIEWBOX}" preserveAspectRatio="xMidYMid meet">` +
    `${mapPaths}${mapLabels}</svg>` +
    `<text x="958" y="770" text-anchor="end" font-size="18" font-weight="700" fill="${COLORS.brown}">인증 방문 ${visitedBakeryCount}곳</text>` +
    `<line x1="72" y1="852" x2="1008" y2="852" stroke="${COLORS.ink}" stroke-width="3"/>` +
    `<text x="72" y="905" font-size="30" font-weight="700" fill="${COLORS.ink}">구별 스탬프</text>` +
    `<text x="1008" y="903" text-anchor="end" font-size="20" font-weight="700" fill="${COLORS.muted}">구마다 ${target}곳이 목표</text>` +
    rows +
    `<line x1="72" y1="1260" x2="1008" y2="1260" stroke="${COLORS.line}" stroke-width="2"/>` +
    `<text x="72" y="1310" font-size="21" font-weight="700" fill="${COLORS.brown}">빵집을 방문하고, 기록하고, 대전을 채워요.</text>` +
    `<text x="1008" y="1310" text-anchor="end" font-size="20" font-weight="700" fill="${COLORS.accentDeep}">BBANGMOA</text>` +
    `</svg>`
  )
}

// SVG 문자열 → PNG Blob. Blob URL을 사용해 유니코드 닉네임을 안전하게 처리하고,
// 폰트는 SVG 내부 data URL이라 canvas가 외부 리소스로 오염되지 않는다.
export function rasterizeStampCard(svgString) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()

    const cleanup = () => URL.revokeObjectURL(url)
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas 2D context를 만들지 못했어요.')
        ctx.drawImage(img, 0, 0, W, H)
        canvas.toBlob((blob) => {
          cleanup()
          if (blob) resolve(blob)
          else reject(new Error('toBlob가 빈 결과를 반환했어요.'))
        }, 'image/png')
      } catch (error) {
        cleanup()
        reject(error)
      }
    }
    img.onerror = () => {
      cleanup()
      reject(new Error('SVG 이미지 로드에 실패했어요.'))
    }
    img.src = url
  })
}
