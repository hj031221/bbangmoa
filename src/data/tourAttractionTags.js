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

// 순서 중요: 더 구체적인 테마(history/education/culture)를 nature보다 먼저 검사한다.
// nature 패턴의 '산(?!업)' 토큰은 "둔산", "무형유산" 처럼 실제 산과 무관한 단어에도 걸리는데,
// 그런 이름들은 대개 유적/교육 등 더 구체적인 키워드도 함께 갖고 있으므로 순서만 바꿔도 오분류가 해소된다.
const NAME_THEME_RULES = [
  { theme: 'history', pattern: /현충원|사적|유적|사당|종가|동춘당|기념관|의거|관사촌/ },
  { theme: 'education', pattern: /박물관|과학관|천문대|연구원|교육|도서관|아쿠아리움|수학문화관/ },
  { theme: 'culture', pattern: /미술관|거리|전시관|문화원|예술|국악원|문학관|공연장/ },
  { theme: 'nature', pattern: /공원|산림|수목원|휴양림|생태|저수지|둘레길|숲|계곡|호수|하늘공원|벚꽃길|느티나무|자연마당|명상정원|산(?!업)/ },
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

  // cat 코드가 없고 이름 키워드로도 못 잡히는 '문화시설' 타입(대전예술의전당, 헤레디움 등)은
  // 기타로 흘려보내지 않고 문화 테마로 기본 배정한다. '기타'가 전체의 24%를 차지하는
  // 덤핑 그라운드가 되는 문제(finding #2)를 막기 위함 — 정말 애매한 경우(컨벤션센터 등)만
  // 결과적으로 문화로 배정되는데, 이는 '기타'보다 더 나은 근사치다.
  if (site.type === '문화시설') return 'culture'

  return 'etc'
}

function themesFor(site) {
  const primary = primaryTheme(site)
  const secondary = (SECONDARY_THEME_OVERRIDES[site.name] ?? []).filter((t) => t !== primary)
  return [primary, ...secondary]
}

// 테마별 전형 성향 프로필. nature는 PDF 8절 실제 예시(대전 치유의 숲)를 그대로 사용,
// 나머지는 PDF Q2~Q5의 해당 테마 지배 옵션 태그 패턴에서 역산.
//
// 각 테마마다 "정말로 모든 소속 관광지에 보편적으로 해당하는" 차원 1개 정도만 5(MAX)로
// 고정하고(nature=walk/rest, history=exploration, culture=sightseeing, education=experience),
// 나머지는 3 이하로 낮춰 TRAIT_BOOSTS/CAT_TRAIT_NUDGES가 실제로 값을 움직일 여지(headroom)를
// 남긴다. 이전에는 예를 들어 nature.scenery=5, culture.appreciation=5 처럼 테마의 가장 흔한
// 이름 패턴이 이미 MAX였던 차원을 다시 boost하는 규칙이 있어 Math.min(5, ...) 클램프에 막혀
// 완전한 no-op이 되고, 그 결과 같은 (구, 테마) 풀 안의 관광지들이 통째로 동일한 trait 벡터로
// 수렴하는 문제(finding #1)가 있었다.
const THEME_BASELINE_TRAITS = {
  nature: { walk: 5, rest: 5, scenery: 3, exploration: 3, immersion: 2, appreciation: 2, sightseeing: 3, experience: 2, knowledge: 2, uniqueness: 2, activity: 3 },
  history: { walk: 1, rest: 1, scenery: 1, exploration: 5, immersion: 4, appreciation: 1, sightseeing: 1, experience: 1, knowledge: 3, uniqueness: 2, activity: 1 },
  culture: { walk: 1, rest: 1, scenery: 1, exploration: 1, immersion: 1, appreciation: 3, sightseeing: 5, experience: 1, knowledge: 1, uniqueness: 1, activity: 1 },
  education: { walk: 1, rest: 1, scenery: 1, exploration: 1, immersion: 1, appreciation: 1, sightseeing: 1, experience: 5, knowledge: 3, uniqueness: 1, activity: 2 },
  etc: { walk: 1, rest: 1, scenery: 1, exploration: 2, immersion: 1, appreciation: 1, sightseeing: 3, experience: 1, knowledge: 1, uniqueness: 3, activity: 3 },
}

// cat 코드 단위 성향 미세조정. 같은 테마라도 KTO 세부 분류(cat)가 다르면 실제 성격도 다르다
// (예: 같은 nature라도 A01010600 자연휴양림과 A02020700 평범한 공원류는 다름). 방문 빈도 상위
// cat 코드를 우선 커버했다(finding #1의 2번 항목). 값은 THEME_BASELINE_TRAITS와 마찬가지로
// TRAIT_BOOSTS 적용 전에 더해지고 최종적으로 0~5로 clamp된다.
const CAT_TRAIT_NUDGES = {
  'A01010600': { uniqueness: 2 }, // 자연휴양림/산림욕장 — 특색있는 숲 체험
  'A01010500': { knowledge: 2, scenery: 1 }, // 생태공원/습지 — 생태교육 성격
  'A01011700': { scenery: 2 }, // 대청호 수변
  'A01011800': { scenery: 2, activity: 1 }, // 하천(갑천 등)
  'A02020700': { activity: 1, scenery: 1 }, // 공원류 — 평범한 공원은 산책보다 활동/조망 쪽으로
  'A02060300': { knowledge: 2, experience: 1 }, // 생태관/전통나래관 등 자연 전시관
  'A02010700': { knowledge: 2, immersion: 1 }, // 서원/사당/재실 등 유교 유산
  'A02010800': { appreciation: 2, immersion: 1 }, // 사찰
  'A02030100': { experience: 2, uniqueness: 1 }, // 체험마을
  'A02030400': { experience: 1, uniqueness: 1 }, // 체험관광지
  'A02030600': { sightseeing: 1, appreciation: 1 }, // 문화예술의거리/인쇄거리
  'A02060100': { knowledge: 1, appreciation: 1 }, // 박물관
  'A02060200': { knowledge: 1, immersion: 1 }, // 기념관
  'A02060500': { appreciation: 2, sightseeing: 1 }, // 미술관
  'A02060600': { sightseeing: 1, experience: 1 }, // 공연장/문예회관
  'A02060700': { knowledge: 1, sightseeing: 1 }, // 문화원
  'A02060900': { knowledge: 2 }, // 도서관
  'A02020300': { activity: 1, uniqueness: 2 }, // 온천특구
  'A02020200': { activity: 2, uniqueness: 2 }, // 관광특구
}

const TRAIT_BOOSTS = [
  { pattern: /체험/, boost: { experience: 2, uniqueness: 1 } },
  { pattern: /전시|미술관/, boost: { appreciation: 2, sightseeing: 1 } },
  { pattern: /박물관|과학관|과학공원/, boost: { knowledge: 2, experience: 1 } },
  { pattern: /수목원|식물원|학습원/, boost: { knowledge: 2, experience: 2 } }, // 교육적 자연 체험
  { pattern: /공원|산림|숲|수목원/, boost: { walk: 1, rest: 1 } },
  { pattern: /사적|유적|서원|사찰|향교/, boost: { exploration: 1, immersion: 1 } },
  { pattern: /전망대|정상|고개/, boost: { scenery: 2 } },
  { pattern: /온천|테마파크|랜드마크|특구/, boost: { uniqueness: 2, activity: 1 } },
  { pattern: /저수지|호수|댐|강변|금강|갑천|유등천|수변|하늘공원/, boost: { scenery: 2 } }, // 수변/하천/호수 조망
  { pattern: /벚꽃|단풍|꽃길|꽃/, boost: { scenery: 2, uniqueness: 1 } },
  { pattern: /유원지|둘레길/, boost: { activity: 2 } },
  { pattern: /명상|치유의\s?숲/, boost: { immersion: 2, knowledge: 1 } },
  { pattern: /군락지/, boost: { scenery: 2 } },
  { pattern: /노고산|구봉산|보문산|식장산|계족산/, boost: { scenery: 2, activity: 2 } }, // 실제 산 이름(둔산·무형유산처럼 '산'이 산이란 뜻이 아닌 단어와는 구분)
  { pattern: /봉소루|사교루|취백정|제월당|옥오재|옥류각|삼매당|남간정사/, boost: { scenery: 2, immersion: 1 } }, // 정자·누각류
  { pattern: /사당|종가|정려각|묘소일원|숭절사/, boost: { immersion: 2 } },
  { pattern: /마애여래좌상|불상|석불/, boost: { appreciation: 2 } },
  { pattern: /석장승/, boost: { uniqueness: 2 } },
  { pattern: /기념관|의거/, boost: { knowledge: 2, appreciation: 1 } },
  { pattern: /뿌리공원/, boost: { uniqueness: 2 } },
  { pattern: /벽화마을/, boost: { uniqueness: 2, appreciation: 1 } },
  { pattern: /소제동/, boost: { uniqueness: 2 } },
]

function traitsFor(site, themes) {
  const vector = { ...THEME_BASELINE_TRAITS[themes[0]] }
  const catNudge = site.cat && CAT_TRAIT_NUDGES[site.cat]
  if (catNudge) {
    for (const [tag, delta] of Object.entries(catNudge)) {
      vector[tag] = Math.min(5, (vector[tag] ?? 0) + delta)
    }
  }
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
