// 설문 문항.
// ⚠️ 아래는 VS(빵 MBTI) 초안을 "반영만" 해둔 상태 — 대기 중. 최종 문항/설계는 사용자가 결정.
//    이 배열만 교체하면 화면/추천이 그대로 동작한다.
//
// 각 옵션의 tags 는 "이 답을 고른 사람이 선호하는 취향 태그 + 가중치".
// tags 의 key 는 src/data/tasteTags.js 의 key 와 일치해야 한다.
//
// [초안 설계 의도 — 4축 직교 binary]
//  Q1 맛  : 달달 ↔ 짭짤      (오프너, 이탈 적음)
//  Q2 탐험: 명물 ↔ 동네      (관광객 ↔ 현지인, 정보이득 큼)
//  Q3 상황: 혼자 ↔ 함께
//  Q4 형태: 바로먹기 ↔ 선물
export const SURVEY = [
  {
    id: 'taste',
    question: '오늘은 어떤 빵이 먹고 싶나요?',
    options: [
      { id: 'sweet', label: '🍰 달달한 빵', tags: { dessert: 3 } },
      { id: 'salty', label: '🥖 짭짤한 빵', tags: { meal: 3 } },
    ],
  },
  {
    id: 'explore',
    question: '어떤 빵집을 찾고 있나요?',
    options: [
      { id: 'famous', label: '⭐ 대전 하면 떠오르는 명물', tags: { famous: 3 } },
      { id: 'local', label: '🔍 숨은 동네 빵집', tags: { value: 2, meal: 1 } },
    ],
  },
  {
    id: 'situation',
    question: '오늘 빵집은 누구와?',
    options: [
      { id: 'solo', label: '🚶 혼자 / 빠르게', tags: { value: 1, meal: 1 } },
      { id: 'together', label: '☕ 함께 분위기 즐기며', tags: { mood: 3, dessert: 1 } },
    ],
  },
  {
    id: 'form',
    question: '빵은 어떻게 즐길 건가요?',
    options: [
      { id: 'here', label: '🍽️ 지금 바로 먹기', tags: { mood: 1 } },
      { id: 'gift', label: '🎁 포장 · 선물용', tags: { togo: 3, famous: 1 } },
    ],
  },
]
