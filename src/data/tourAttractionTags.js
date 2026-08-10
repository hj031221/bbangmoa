// daejeonTour.json 186곳(이미지 있는 173곳만 사용)에 규칙 기반으로 themes/traits/companion 을 부여한다.
// 근거: docs/superpowers/specs/2026-08-10-tour-recommendation-design.md 3절.
// 1순위 KTO cat 코드 매핑 → 2순위(cat 없음) 이름 키워드 규칙 → 그래도 안 잡히면 'etc'.
import daejeonTour from './daejeonTour.json' with { type: 'json' }

const CAT_THEME = {
  'A01010400': 'nature', 'A01010500': 'nature', 'A01010600': 'nature',
  'A01010700': 'nature', 'A01011700': 'nature', 'A01011800': 'nature',
  'A02020700': 'nature', // 공원류(뿌리공원, 수변공원 등)
  'A02010400': 'history', 'A02010700': 'history', 'A02010800': 'history',
  'A02010900': 'history', 'A02011000': 'history',
  'A02050200': 'culture', // 건축/조형물
  'A02030100': 'etc', 'A02030400': 'etc', // 체험관광지 기본값(아래 키워드로 education 재분류)
  'A02030600': 'culture', // 문화예술의거리/인쇄거리
  'A02020200': 'etc', 'A02020300': 'etc', // 온천특구
  'A02020600': 'education', // 아쿠아리움
  'A02060100': 'education', // 박물관
  'A02060200': 'history', // 기념관
  'A02060300': 'nature', // 생태관(아래 키워드로 culture 재분류)
  'A02060500': 'culture', // 미술관
  'A02060600': 'culture', // 공연장/문예회관(아래 키워드로 education 재분류)
  'A02060700': 'culture', // 문화원
  'A02060900': 'education', // 도서관
}

const NAME_THEME_OVERRIDES = {
  '유성온천공원': 'etc',
  '대전솔로몬로파크': 'education',
  '대전오월드': 'etc',
  '펫터테인먼트': 'etc',
  "It's 수 홍보관": 'etc',
  '한빛탑': 'etc',
  '엑스포다리': 'etc',
}

const NAME_THEME_RULES = [
  { theme: 'nature', pattern: /공원|산림|수목원|휴양림|생태|저수지|둘레길|숲|계곡|호수|하늘공원|벚꽃길|느티나무|자연마당|명상정원|산(?!업)/ },
  { theme: 'history', pattern: /현충원|사적|유적|사당|종가|동춘당|기념관|의거|관사촌/ },
  { theme: 'education', pattern: /박물관|과학관|천문대|연구원|교육/ },
  { theme: 'culture', pattern: /미술관|거리|전시관/ },
]

const SECONDARY_THEME_OVERRIDES = {
  '국립 대전 현충원': ['nature'],
  '식장산 문화공원(해돋이전망대)': ['culture'],
}

function primaryTheme(site) {
  if (NAME_THEME_OVERRIDES[site.name]) return NAME_THEME_OVERRIDES[site.name]

  if (site.cat && CAT_THEME[site.cat]) {
    let theme = CAT_THEME[site.cat]
    if ((site.cat === 'A02030400' || site.cat === 'A02030100') && /교육|과학|발명|학습/.test(site.name)) {
      theme = 'education'
    }
    if (site.cat === 'A02060300' && site.name.includes('전통')) theme = 'culture'
    if (site.cat === 'A02060600' && site.name.includes('어린이')) theme = 'education'
    return theme
  }

  for (const rule of NAME_THEME_RULES) {
    if (rule.pattern.test(site.name)) return rule.theme
  }
  return 'etc'
}

function themesFor(site) {
  const primary = primaryTheme(site)
  const secondary = (SECONDARY_THEME_OVERRIDES[site.name] ?? []).filter((t) => t !== primary)
  return [primary, ...secondary]
}

// 테마별 전형 성향 프로필. nature는 PDF 8절 실제 예시(대전 치유의 숲)를 그대로 사용,
// 나머지는 PDF Q2~Q5의 해당 테마 지배 옵션 태그 패턴에서 역산.
const THEME_BASELINE_TRAITS = {
  nature: { walk: 5, rest: 5, scenery: 5, exploration: 3, immersion: 2, appreciation: 2, sightseeing: 3, experience: 2, knowledge: 2, uniqueness: 2, activity: 3 },
  history: { walk: 1, rest: 1, scenery: 1, exploration: 5, immersion: 4, appreciation: 1, sightseeing: 1, experience: 1, knowledge: 3, uniqueness: 2, activity: 1 },
  culture: { walk: 1, rest: 1, scenery: 1, exploration: 1, immersion: 1, appreciation: 5, sightseeing: 5, experience: 1, knowledge: 1, uniqueness: 1, activity: 1 },
  education: { walk: 1, rest: 1, scenery: 1, exploration: 1, immersion: 1, appreciation: 1, sightseeing: 1, experience: 5, knowledge: 5, uniqueness: 1, activity: 2 },
  etc: { walk: 1, rest: 1, scenery: 1, exploration: 2, immersion: 1, appreciation: 1, sightseeing: 3, experience: 1, knowledge: 1, uniqueness: 5, activity: 3 },
}

const TRAIT_BOOSTS = [
  { pattern: /체험/, boost: { experience: 2, uniqueness: 1 } },
  { pattern: /전시|미술관/, boost: { appreciation: 2, sightseeing: 1 } },
  { pattern: /박물관|과학관/, boost: { knowledge: 2, experience: 1 } },
  { pattern: /공원|산림|숲|수목원/, boost: { walk: 1, rest: 1 } },
  { pattern: /사적|유적|서원|사찰|향교/, boost: { exploration: 1, immersion: 1 } },
  { pattern: /전망대|정상|고개/, boost: { scenery: 2 } },
  { pattern: /온천|테마파크|랜드마크|특구/, boost: { uniqueness: 2, activity: 1 } },
]

function traitsFor(site, themes) {
  const vector = { ...THEME_BASELINE_TRAITS[themes[0]] }
  for (const { pattern, boost } of TRAIT_BOOSTS) {
    if (!pattern.test(site.name)) continue
    for (const [tag, delta] of Object.entries(boost)) {
      vector[tag] = Math.min(5, (vector[tag] ?? 0) + delta)
    }
  }
  return vector
}

// PDF 각 Branch "해석 포인트" 문장에서 도출한 동행유형별 태그 가중치.
const COMPANION_WEIGHTS = {
  solo: { rest: 6, immersion: 6 },
  couple: { scenery: 4, walk: 3, appreciation: 3, experience: 3, uniqueness: 3 },
  friends: { activity: 5, sightseeing: 3, experience: 3, uniqueness: 3 },
  childrenFamily: { activity: 4, experience: 4, knowledge: 3, uniqueness: 3 },
  parentsFamily: { rest: 4, scenery: 3, immersion: 3, appreciation: 2, knowledge: 2, uniqueness: 2 },
}

function companionFor(traits) {
  const result = {}
  for (const [key, weights] of Object.entries(COMPANION_WEIGHTS)) {
    let score = 50
    for (const [tag, w] of Object.entries(weights)) score += w * ((traits[tag] ?? 0) - 2.5)
    result[key] = Math.max(0, Math.min(100, Math.round(score)))
  }
  return result
}

function districtOf(addr) {
  const match = (addr || '').match(/대전광역시\s*(\S+구)/)
  return match ? match[1] : null
}

function tagSite(site) {
  const themes = themesFor(site)
  const traits = traitsFor(site, themes)
  return {
    ...site,
    district: districtOf(site.addr),
    themes,
    traits,
    companion: companionFor(traits),
  }
}

export const TAGGED_ATTRACTIONS = daejeonTour.filter((s) => s.image).map(tagSite)

export function getAttractionById(id) {
  return TAGGED_ATTRACTIONS.find((a) => a.id === id) ?? null
}
