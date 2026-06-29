// 취향 태그 정의 (데모용).
// - key: 추천 로직과 설문 가중치가 공유하는 식별자
// - label: 화면 표기
// - keywords: 빵집 이름/카테고리 텍스트에서 이 태그를 유추할 때 쓰는 단서
//
// ⚠️ 데모 단계라 빵집 태깅을 키워드 휴리스틱으로 처리한다.
//    실제 데이터(리뷰/메뉴 등)가 붙으면 deriveTags 만 고도화하면 된다.
export const TASTE_TAGS = {
  dessert: { key: 'dessert', label: '디저트·케이크', keywords: ['케이크', '디저트', '타르트', '마카롱', '쿠키', '파이'] },
  meal: { key: 'meal', label: '식사빵·소금빵', keywords: ['소금빵', '바게트', '치아바타', '식빵', '베이글', '샌드위치'] },
  value: { key: 'value', label: '가성비·푸짐', keywords: ['할인', '대용량', '무한', '가성비'] },
  mood: { key: 'mood', label: '분위기·카페', keywords: ['카페', '베이커리카페', '로스터리', '브런치'] },
  togo: { key: 'togo', label: '포장·선물', keywords: ['선물', '포장', '기프트', '답례'] },
  famous: { key: 'famous', label: '대전 명물·유명', keywords: ['성심당', '명물', '본점', '유명'] },
}

export const TAG_KEYS = Object.keys(TASTE_TAGS)

// 빵집 객체에 태그 배열을 유추해 부여한다 (이름 + 카테고리 텍스트 기반).
export function deriveTags(bakery) {
  const hay = `${bakery.name || ''} ${bakery.category || ''}`
  const tags = []
  for (const t of Object.values(TASTE_TAGS)) {
    if (t.keywords.some((kw) => hay.includes(kw))) tags.push(t.key)
  }
  // 단서가 전혀 없으면 기본적으로 '식사빵'을 약하게 부여 (추천에서 0점 빵집 방지)
  return tags.length ? tags : ['meal']
}
