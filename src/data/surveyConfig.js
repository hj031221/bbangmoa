// "빵집 찾기" 설문 — Branch 기반 가중치 스코어링 구조.
// (2026-08-03, 이슈 #10: 4문항 이진 태그 매칭 방식이던 구 SURVEY 를 전면 교체)
//
// 구조:
//   Q1(분기 질문, 점수 미반영) → 선택지별 branch(A~E) 결정
//   → 해당 Branch 의 Q2~Q5(각 5지선다) 응답 → 후보 빵별 가중 점수 계산
//
// 점수 공식: 최종 점수 = Σ (fitness[breadId] / MAX_FITNESS × WEIGHTS[qKey])  (Q2~Q5 모두 답하면 만점 100)
// fitness 값은 1~5(5=최고 적합) 스케일이며, src/lib/breadRecommend.js 가 이 데이터를 읽어 계산한다.
//
// id 네이밍: 모든 브랜치 질문/선택지 id 에 브랜치 접두사(A_, B_ …)를 붙인다.
// 브랜치 전환(뒤로가기로 Q1 답 변경) 시 이전 브랜치의 잔여 답변이 새 브랜치 id 와 겹치지 않게 하기 위함 —
// 겹치지 않으므로 잔여 답변은 조회 시 그냥 무시된다(안전한 no-op).

export const Q1_ID = 'q1'

export const Q1 = {
  id: Q1_ID,
  question: '오늘 빵을 고르는 가장 큰 이유는 무엇인가요?',
  options: [
    { id: 'q1_meal', label: '든든한 한 끼를 먹고 싶어요.', branch: 'A' },
    { id: 'q1_drink', label: '커피나 음료와 함께 즐기고 싶어요.', branch: 'B' },
    { id: 'q1_dessert', label: '오늘 하루 나를 위한 작은 디저트가 필요해요.', branch: 'C' },
    { id: 'q1_gift', label: '소중한 사람과 함께 먹거나 선물하고 싶어요.', branch: 'D' },
    { id: 'q1_discover', label: '새로운 빵을 발견하고 싶어요.', branch: 'E' },
  ],
}

export const WEIGHTS = { q2: 25, q3: 30, q4: 30, q5: 15 } // 합 100
export const MAX_FITNESS = 5

export const BRANCHES = {
  A: {
    id: 'A',
    label: '든든한 한 끼',
    candidateIds: ['breadLoaf', 'baguette', 'ciabatta', 'bagel', 'campagne', 'friedBread', 'focaccia', 'saltBread'],
    questions: [
      {
        id: 'A_q2',
        weightKey: 'q2',
        question: '어떤 식사 스타일을 원하시나요?',
        options: [
          { id: 'A_q2_1', label: '가볍게 먹고 싶어요', fitness: { breadLoaf: 3, baguette: 2, ciabatta: 4, bagel: 5, campagne: 2, friedBread: 1, focaccia: 3, saltBread: 3 } },
          { id: 'A_q2_2', label: '든든하게 배를 채우고 싶어요', fitness: { breadLoaf: 5, baguette: 3, ciabatta: 2, bagel: 2, campagne: 4, friedBread: 4, focaccia: 3, saltBread: 1 } },
          { id: 'A_q2_3', label: '건강한 느낌이 좋아요', fitness: { breadLoaf: 3, baguette: 3, ciabatta: 4, bagel: 3, campagne: 5, friedBread: 1, focaccia: 2, saltBread: 2 } },
          { id: 'A_q2_4', label: '짭짤한 간식처럼 먹고 싶어요', fitness: { breadLoaf: 1, baguette: 2, ciabatta: 3, bagel: 2, campagne: 1, friedBread: 4, focaccia: 4, saltBread: 5 } },
          { id: 'A_q2_5', label: '이동하면서 간편하게 먹고 싶어요', fitness: { breadLoaf: 1, baguette: 2, ciabatta: 5, bagel: 4, campagne: 1, friedBread: 3, focaccia: 3, saltBread: 4 } },
        ],
      },
      {
        id: 'A_q3',
        weightKey: 'q3',
        question: '어떤 식감이 좋으신가요?',
        options: [
          { id: 'A_q3_1', label: '폭신폭신한 식감', fitness: { breadLoaf: 5, baguette: 1, ciabatta: 2, bagel: 2, campagne: 1, friedBread: 3, focaccia: 4, saltBread: 3 } },
          { id: 'A_q3_2', label: '쫄깃쫄깃한 식감', fitness: { breadLoaf: 2, baguette: 2, ciabatta: 4, bagel: 5, campagne: 2, friedBread: 2, focaccia: 2, saltBread: 3 } },
          { id: 'A_q3_3', label: '바삭바삭한 식감', fitness: { breadLoaf: 1, baguette: 5, ciabatta: 3, bagel: 2, campagne: 2, friedBread: 3, focaccia: 3, saltBread: 4 } },
          { id: 'A_q3_4', label: '묵직하고 씹는 맛', fitness: { breadLoaf: 2, baguette: 3, ciabatta: 3, bagel: 3, campagne: 5, friedBread: 3, focaccia: 2, saltBread: 1 } },
          { id: 'A_q3_5', label: '촉촉하고 부드러운 식감', fitness: { breadLoaf: 4, baguette: 1, ciabatta: 2, bagel: 2, campagne: 2, friedBread: 4, focaccia: 5, saltBread: 3 } },
        ],
      },
      {
        id: 'A_q4',
        weightKey: 'q4',
        question: '어떤 맛을 원하시나요?',
        options: [
          { id: 'A_q4_1', label: '담백한 맛', fitness: { breadLoaf: 3, baguette: 4, ciabatta: 5, bagel: 3, campagne: 3, friedBread: 2, focaccia: 2, saltBread: 2 } },
          { id: 'A_q4_2', label: '짭짤한 맛', fitness: { breadLoaf: 1, baguette: 2, ciabatta: 2, bagel: 2, campagne: 2, friedBread: 4, focaccia: 3, saltBread: 5 } },
          { id: 'A_q4_3', label: '고소한 맛', fitness: { breadLoaf: 3, baguette: 2, ciabatta: 2, bagel: 3, campagne: 3, friedBread: 5, focaccia: 3, saltBread: 3 } },
          { id: 'A_q4_4', label: '버터 풍미', fitness: { breadLoaf: 3, baguette: 2, ciabatta: 2, bagel: 2, campagne: 2, friedBread: 2, focaccia: 5, saltBread: 4 } },
          { id: 'A_q4_5', label: '살짝 달콤한 맛', fitness: { breadLoaf: 4, baguette: 2, ciabatta: 2, bagel: 3, campagne: 2, friedBread: 2, focaccia: 3, saltBread: 2 } },
        ],
      },
      {
        id: 'A_q5',
        weightKey: 'q5',
        question: '오늘 가장 중요한 기준은 무엇인가요?',
        options: [
          { id: 'A_q5_1', label: '포만감', fitness: { breadLoaf: 5, baguette: 3, ciabatta: 2, bagel: 3, campagne: 4, friedBread: 4, focaccia: 2, saltBread: 1 } },
          { id: 'A_q5_2', label: '건강한 느낌', fitness: { breadLoaf: 3, baguette: 3, ciabatta: 3, bagel: 3, campagne: 5, friedBread: 1, focaccia: 2, saltBread: 2 } },
          { id: 'A_q5_3', label: '부담 없는 맛', fitness: { breadLoaf: 3, baguette: 3, ciabatta: 4, bagel: 5, campagne: 2, friedBread: 2, focaccia: 3, saltBread: 3 } },
          { id: 'A_q5_4', label: '인기 있는 메뉴', fitness: { breadLoaf: 4, baguette: 2, ciabatta: 2, bagel: 3, campagne: 2, friedBread: 2, focaccia: 2, saltBread: 5 } },
          { id: 'A_q5_5', label: '새로운 메뉴 경험', fitness: { breadLoaf: 1, baguette: 2, ciabatta: 3, bagel: 2, campagne: 2, friedBread: 4, focaccia: 5, saltBread: 3 } },
        ],
      },
    ],
  },

  B: {
    id: 'B',
    label: '커피나 음료와 함께',
    candidateIds: ['croissant', 'danish', 'kouignAmann', 'eggTart', 'cake', 'donut', 'madeleine', 'scone'],
    questions: [
      {
        id: 'B_q2',
        weightKey: 'q2',
        question: '어떤 분위기를 원하시나요?',
        options: [
          { id: 'B_q2_1', label: '달콤한 디저트 느낌', fitness: { croissant: 2, danish: 3, kouignAmann: 3, eggTart: 3, cake: 5, donut: 4, madeleine: 3, scone: 2 } },
          { id: 'B_q2_2', label: '버터 향이 진한 빵', fitness: { croissant: 5, danish: 3, kouignAmann: 4, eggTart: 2, cake: 2, donut: 1, madeleine: 2, scone: 3 } },
          { id: 'B_q2_3', label: '가볍고 담백한 빵', fitness: { croissant: 3, danish: 2, kouignAmann: 2, eggTart: 2, cake: 1, donut: 2, madeleine: 3, scone: 5 } },
          { id: 'B_q2_4', label: '사진이 예쁜 디저트', fitness: { croissant: 2, danish: 5, kouignAmann: 3, eggTart: 4, cake: 4, donut: 3, madeleine: 3, scone: 2 } },
          { id: 'B_q2_5', label: '음료와 천천히 먹기 좋은 빵', fitness: { croissant: 2, danish: 3, kouignAmann: 5, eggTart: 2, cake: 2, donut: 2, madeleine: 4, scone: 3 } },
        ],
      },
      {
        id: 'B_q3',
        weightKey: 'q3',
        question: '어떤 식감이 좋으신가요?',
        options: [
          { id: 'B_q3_1', label: '바삭바삭한 식감', fitness: { croissant: 5, danish: 3, kouignAmann: 3, eggTart: 3, cake: 1, donut: 2, madeleine: 2, scone: 4 } },
          { id: 'B_q3_2', label: '촉촉한 식감', fitness: { croissant: 1, danish: 2, kouignAmann: 2, eggTart: 3, cake: 4, donut: 3, madeleine: 5, scone: 2 } },
          { id: 'B_q3_3', label: '결이 살아있는 식감', fitness: { croissant: 4, danish: 5, kouignAmann: 4, eggTart: 2, cake: 1, donut: 2, madeleine: 1, scone: 3 } },
          { id: 'B_q3_4', label: '부드러운 식감', fitness: { croissant: 2, danish: 2, kouignAmann: 2, eggTart: 5, cake: 4, donut: 3, madeleine: 3, scone: 2 } },
          { id: 'B_q3_5', label: '쫀득한 식감', fitness: { croissant: 2, danish: 3, kouignAmann: 5, eggTart: 2, cake: 2, donut: 4, madeleine: 2, scone: 2 } },
        ],
      },
      {
        id: 'B_q4',
        weightKey: 'q4',
        question: '어떤 맛을 원하시나요?',
        options: [
          { id: 'B_q4_1', label: '버터 풍미', fitness: { croissant: 5, danish: 3, kouignAmann: 4, eggTart: 2, cake: 2, donut: 1, madeleine: 2, scone: 3 } },
          { id: 'B_q4_2', label: '초콜릿 계열', fitness: { croissant: 1, danish: 2, kouignAmann: 1, eggTart: 1, cake: 4, donut: 5, madeleine: 2, scone: 1 } },
          { id: 'B_q4_3', label: '과일 계열', fitness: { croissant: 2, danish: 5, kouignAmann: 2, eggTart: 3, cake: 3, donut: 2, madeleine: 3, scone: 2 } },
          { id: 'B_q4_4', label: '담백한 맛', fitness: { croissant: 3, danish: 2, kouignAmann: 2, eggTart: 3, cake: 1, donut: 2, madeleine: 2, scone: 5 } },
          { id: 'B_q4_5', label: '달콤한 맛', fitness: { croissant: 1, danish: 3, kouignAmann: 3, eggTart: 3, cake: 5, donut: 4, madeleine: 3, scone: 2 } },
        ],
      },
      {
        id: 'B_q5',
        weightKey: 'q5',
        question: '어떤 추천을 받고 싶나요?',
        options: [
          { id: 'B_q5_1', label: '가장 유명한 메뉴', fitness: { croissant: 5, danish: 2, kouignAmann: 3, eggTart: 2, cake: 4, donut: 3, madeleine: 2, scone: 2 } },
          { id: 'B_q5_2', label: '숨은 인기 메뉴', fitness: { croissant: 2, danish: 2, kouignAmann: 3, eggTart: 3, cake: 2, donut: 2, madeleine: 4, scone: 5 } },
          { id: 'B_q5_3', label: '사진이 예쁜 메뉴', fitness: { croissant: 2, danish: 5, kouignAmann: 2, eggTart: 3, cake: 4, donut: 2, madeleine: 3, scone: 2 } },
          { id: 'B_q5_4', label: '고급스러운 메뉴', fitness: { croissant: 3, danish: 3, kouignAmann: 5, eggTart: 4, cake: 3, donut: 1, madeleine: 2, scone: 2 } },
          { id: 'B_q5_5', label: '새로운 조합', fitness: { croissant: 2, danish: 2, kouignAmann: 2, eggTart: 4, cake: 2, donut: 3, madeleine: 5, scone: 2 } },
        ],
      },
    ],
  },

  C: {
    id: 'C',
    label: '작은 디저트',
    candidateIds: ['cake', 'donut', 'creamBread', 'redBeanBread', 'anBread', 'eggTart', 'kouignAmann', 'danish', 'madeleine'],
    questions: [
      {
        id: 'C_q2',
        weightKey: 'q2',
        question: '오늘 기분은 어떤가요?',
        options: [
          { id: 'C_q2_1', label: '기분 전환이 필요해요', fitness: { cake: 2, donut: 5, creamBread: 2, redBeanBread: 1, anBread: 2, eggTart: 3, kouignAmann: 3, danish: 3, madeleine: 3 } },
          { id: 'C_q2_2', label: '스트레스를 풀고 싶어요', fitness: { cake: 5, donut: 4, creamBread: 3, redBeanBread: 2, anBread: 3, eggTart: 2, kouignAmann: 2, danish: 2, madeleine: 2 } },
          { id: 'C_q2_3', label: '달콤한 위로가 필요해요', fitness: { cake: 4, donut: 3, creamBread: 5, redBeanBread: 3, anBread: 3, eggTart: 2, kouignAmann: 2, danish: 2, madeleine: 2 } },
          { id: 'C_q2_4', label: '특별한 하루처럼 느끼고 싶어요', fitness: { cake: 4, donut: 2, creamBread: 1, redBeanBread: 1, anBread: 1, eggTart: 3, kouignAmann: 5, danish: 3, madeleine: 3 } },
          { id: 'C_q2_5', label: '편안하게 쉬고 싶어요', fitness: { cake: 2, donut: 2, creamBread: 3, redBeanBread: 5, anBread: 4, eggTart: 2, kouignAmann: 2, danish: 2, madeleine: 3 } },
        ],
      },
      {
        id: 'C_q3',
        weightKey: 'q3',
        question: '어떤 식감이 좋으신가요?',
        options: [
          { id: 'C_q3_1', label: '바삭한 식감', fitness: { cake: 1, donut: 2, creamBread: 1, redBeanBread: 1, anBread: 1, eggTart: 3, kouignAmann: 5, danish: 4, madeleine: 2 } },
          { id: 'C_q3_2', label: '촉촉한 식감', fitness: { cake: 4, donut: 3, creamBread: 3, redBeanBread: 2, anBread: 2, eggTart: 3, kouignAmann: 2, danish: 2, madeleine: 5 } },
          { id: 'C_q3_3', label: '폭신한 식감', fitness: { cake: 2, donut: 3, creamBread: 4, redBeanBread: 3, anBread: 5, eggTart: 1, kouignAmann: 1, danish: 2, madeleine: 2 } },
          { id: 'C_q3_4', label: '꾸덕한 느낌', fitness: { cake: 5, donut: 2, creamBread: 3, redBeanBread: 2, anBread: 2, eggTart: 3, kouignAmann: 2, danish: 2, madeleine: 1 } },
          { id: 'C_q3_5', label: '부드러운 식감', fitness: { cake: 3, donut: 2, creamBread: 4, redBeanBread: 2, anBread: 3, eggTart: 5, kouignAmann: 2, danish: 2, madeleine: 3 } },
        ],
      },
      {
        id: 'C_q4',
        weightKey: 'q4',
        question: '어떤 맛을 원하시나요?',
        options: [
          { id: 'C_q4_1', label: '달콤한 맛', fitness: { cake: 4, donut: 5, creamBread: 3, redBeanBread: 3, anBread: 3, eggTart: 2, kouignAmann: 2, danish: 2, madeleine: 2 } },
          { id: 'C_q4_2', label: '버터 풍미', fitness: { cake: 2, donut: 1, creamBread: 2, redBeanBread: 1, anBread: 1, eggTart: 2, kouignAmann: 5, danish: 4, madeleine: 3 } },
          { id: 'C_q4_3', label: '고소한 맛', fitness: { cake: 2, donut: 2, creamBread: 2, redBeanBread: 5, anBread: 4, eggTart: 2, kouignAmann: 2, danish: 2, madeleine: 2 } },
          { id: 'C_q4_4', label: '초콜릿 계열', fitness: { cake: 4, donut: 3, creamBread: 5, redBeanBread: 1, anBread: 1, eggTart: 1, kouignAmann: 1, danish: 1, madeleine: 2 } },
          { id: 'C_q4_5', label: '과일 계열', fitness: { cake: 2, donut: 2, creamBread: 2, redBeanBread: 1, anBread: 1, eggTart: 4, kouignAmann: 2, danish: 5, madeleine: 3 } },
        ],
      },
      {
        id: 'C_q5',
        weightKey: 'q5',
        question: '오늘 가장 원하는 것은 무엇인가요?',
        options: [
          { id: 'C_q5_1', label: '행복한 기분', fitness: { cake: 5, donut: 4, creamBread: 3, redBeanBread: 3, anBread: 2, eggTart: 2, kouignAmann: 2, danish: 2, madeleine: 2 } },
          { id: 'C_q5_2', label: '특별한 맛', fitness: { cake: 2, donut: 2, creamBread: 2, redBeanBread: 1, anBread: 1, eggTart: 5, kouignAmann: 4, danish: 3, madeleine: 3 } },
          { id: 'C_q5_3', label: '사진이 잘 나오는 메뉴', fitness: { cake: 3, donut: 2, creamBread: 2, redBeanBread: 1, anBread: 1, eggTart: 4, kouignAmann: 2, danish: 5, madeleine: 3 } },
          { id: 'C_q5_4', label: '인기 있는 메뉴', fitness: { cake: 4, donut: 3, creamBread: 3, redBeanBread: 5, anBread: 2, eggTart: 2, kouignAmann: 2, danish: 2, madeleine: 2 } },
          { id: 'C_q5_5', label: '새로운 경험', fitness: { cake: 1, donut: 2, creamBread: 2, redBeanBread: 1, anBread: 5, eggTart: 3, kouignAmann: 3, danish: 2, madeleine: 4 } },
        ],
      },
    ],
  },

  D: {
    id: 'D',
    label: '함께 먹거나 선물',
    candidateIds: ['cake', 'eggTart', 'donut', 'anBread', 'redBeanBread', 'creamBread', 'danish', 'kouignAmann', 'madeleine'],
    questions: [
      {
        id: 'D_q2',
        weightKey: 'q2',
        question: '누구와 함께하시나요?',
        options: [
          { id: 'D_q2_1', label: '가족', fitness: { cake: 3, eggTart: 2, donut: 2, anBread: 3, redBeanBread: 5, creamBread: 4, danish: 2, kouignAmann: 1, madeleine: 2 } },
          { id: 'D_q2_2', label: '친구', fitness: { cake: 3, eggTart: 2, donut: 5, anBread: 2, redBeanBread: 2, creamBread: 3, danish: 2, kouignAmann: 2, madeleine: 2 } },
          { id: 'D_q2_3', label: '연인', fitness: { cake: 5, eggTart: 4, donut: 1, anBread: 1, redBeanBread: 1, creamBread: 2, danish: 3, kouignAmann: 3, madeleine: 2 } },
          { id: 'D_q2_4', label: '직장 동료', fitness: { cake: 2, eggTart: 3, donut: 3, anBread: 2, redBeanBread: 2, creamBread: 2, danish: 3, kouignAmann: 3, madeleine: 5 } },
          { id: 'D_q2_5', label: '혼자 먹을 예정', fitness: { cake: 1, eggTart: 5, donut: 2, anBread: 2, redBeanBread: 2, creamBread: 2, danish: 4, kouignAmann: 3, madeleine: 2 } },
        ],
      },
      {
        id: 'D_q3',
        weightKey: 'q3',
        question: '어떤 분위기를 원하시나요?',
        options: [
          { id: 'D_q3_1', label: '고급스러운 느낌', fitness: { cake: 3, eggTart: 4, donut: 1, anBread: 1, redBeanBread: 1, creamBread: 1, danish: 3, kouignAmann: 5, madeleine: 2 } },
          { id: 'D_q3_2', label: '귀여운 느낌', fitness: { cake: 3, eggTart: 2, donut: 5, anBread: 2, redBeanBread: 2, creamBread: 2, danish: 2, kouignAmann: 1, madeleine: 4 } },
          { id: 'D_q3_3', label: '무난하고 실패 없는 느낌', fitness: { cake: 2, eggTart: 2, donut: 3, anBread: 3, redBeanBread: 5, creamBread: 4, danish: 2, kouignAmann: 1, madeleine: 2 } },
          { id: 'D_q3_4', label: '특별한 느낌', fitness: { cake: 5, eggTart: 4, donut: 2, anBread: 1, redBeanBread: 1, creamBread: 2, danish: 3, kouignAmann: 4, madeleine: 2 } },
          { id: 'D_q3_5', label: '따뜻한 느낌', fitness: { cake: 2, eggTart: 1, donut: 2, anBread: 4, redBeanBread: 3, creamBread: 5, danish: 2, kouignAmann: 1, madeleine: 2 } },
        ],
      },
      {
        id: 'D_q4',
        weightKey: 'q4',
        question: '어떤 구성을 원하시나요?',
        options: [
          { id: 'D_q4_1', label: '하나만 있어도 충분한 메뉴', fitness: { cake: 4, eggTart: 3, donut: 2, anBread: 1, redBeanBread: 1, creamBread: 2, danish: 2, kouignAmann: 5, madeleine: 2 } },
          { id: 'D_q4_2', label: '두세 개 정도 고르기 좋은 메뉴', fitness: { cake: 2, eggTart: 5, donut: 3, anBread: 2, redBeanBread: 2, creamBread: 2, danish: 3, kouignAmann: 3, madeleine: 4 } },
          { id: 'D_q4_3', label: '여러 명이 나눠 먹기 좋은 메뉴', fitness: { cake: 4, eggTart: 2, donut: 5, anBread: 3, redBeanBread: 3, creamBread: 3, danish: 2, kouignAmann: 2, madeleine: 2 } },
          { id: 'D_q4_4', label: '케이크 형태', fitness: { cake: 5, eggTart: 2, donut: 1, anBread: 1, redBeanBread: 1, creamBread: 1, danish: 1, kouignAmann: 1, madeleine: 1 } },
          { id: 'D_q4_5', label: '다양하게 담기 좋은 메뉴', fitness: { cake: 2, eggTart: 2, donut: 2, anBread: 5, redBeanBread: 2, creamBread: 2, danish: 3, kouignAmann: 2, madeleine: 3 } },
        ],
      },
      {
        id: 'D_q5',
        weightKey: 'q5',
        question: '가장 중요한 것은 무엇인가요?',
        options: [
          { id: 'D_q5_1', label: '맛', fitness: { cake: 4, eggTart: 2, donut: 2, anBread: 3, redBeanBread: 5, creamBread: 3, danish: 2, kouignAmann: 2, madeleine: 2 } },
          { id: 'D_q5_2', label: '비주얼', fitness: { cake: 4, eggTart: 4, donut: 2, anBread: 1, redBeanBread: 1, creamBread: 2, danish: 5, kouignAmann: 3, madeleine: 3 } },
          { id: 'D_q5_3', label: '유명한 빵집의 대표 메뉴', fitness: { cake: 5, eggTart: 3, donut: 3, anBread: 2, redBeanBread: 2, creamBread: 2, danish: 2, kouignAmann: 3, madeleine: 2 } },
          { id: 'D_q5_4', label: '가격 부담이 적은 메뉴', fitness: { cake: 1, eggTart: 1, donut: 5, anBread: 3, redBeanBread: 4, creamBread: 3, danish: 1, kouignAmann: 1, madeleine: 2 } },
          { id: 'D_q5_5', label: '특별함', fitness: { cake: 2, eggTart: 4, donut: 1, anBread: 1, redBeanBread: 1, creamBread: 2, danish: 3, kouignAmann: 5, madeleine: 3 } },
        ],
      },
    ],
  },

  E: {
    id: 'E',
    label: '새로운 빵 발견',
    candidateIds: ['kouignAmann', 'campagne', 'ciabatta', 'pretzel', 'focaccia', 'danish', 'eggTart', 'scone', 'madeleine'],
    questions: [
      {
        id: 'E_q2',
        weightKey: 'q2',
        question: '평소 어떤 스타일을 좋아하시나요?',
        options: [
          { id: 'E_q2_1', label: '담백한 스타일', fitness: { kouignAmann: 2, campagne: 3, ciabatta: 5, pretzel: 2, focaccia: 3, danish: 2, eggTart: 2, scone: 4, madeleine: 1 } },
          { id: 'E_q2_2', label: '달콤한 스타일', fitness: { kouignAmann: 3, campagne: 1, ciabatta: 1, pretzel: 1, focaccia: 1, danish: 3, eggTart: 4, scone: 2, madeleine: 5 } },
          { id: 'E_q2_3', label: '짭짤한 스타일', fitness: { kouignAmann: 1, campagne: 2, ciabatta: 2, pretzel: 5, focaccia: 4, danish: 1, eggTart: 1, scone: 2, madeleine: 1 } },
          { id: 'E_q2_4', label: '버터 풍미가 강한 스타일', fitness: { kouignAmann: 5, campagne: 1, ciabatta: 1, pretzel: 1, focaccia: 2, danish: 4, eggTart: 2, scone: 3, madeleine: 2 } },
          { id: 'E_q2_5', label: '상관없고 새로운 게 좋아요', fitness: { kouignAmann: 2, campagne: 2, ciabatta: 3, pretzel: 4, focaccia: 5, danish: 2, eggTart: 2, scone: 2, madeleine: 2 } },
        ],
      },
      {
        id: 'E_q3',
        weightKey: 'q3',
        question: '새로운 도전을 한다면 어떤 방향이 좋나요?',
        options: [
          { id: 'E_q3_1', label: '해외 스타일', fitness: { kouignAmann: 3, campagne: 2, ciabatta: 4, pretzel: 5, focaccia: 4, danish: 2, eggTart: 2, scone: 2, madeleine: 1 } },
          { id: 'E_q3_2', label: '건강한 스타일', fitness: { kouignAmann: 1, campagne: 5, ciabatta: 4, pretzel: 2, focaccia: 3, danish: 2, eggTart: 2, scone: 2, madeleine: 1 } },
          { id: 'E_q3_3', label: '독특한 재료', fitness: { kouignAmann: 3, campagne: 2, ciabatta: 2, pretzel: 2, focaccia: 2, danish: 5, eggTart: 4, scone: 2, madeleine: 2 } },
          { id: 'E_q3_4', label: '베이커리 시그니처', fitness: { kouignAmann: 5, campagne: 2, ciabatta: 2, pretzel: 2, focaccia: 2, danish: 4, eggTart: 3, scone: 2, madeleine: 2 } },
          { id: 'E_q3_5', label: '시즌 한정 느낌', fitness: { kouignAmann: 2, campagne: 2, ciabatta: 2, pretzel: 2, focaccia: 2, danish: 3, eggTart: 5, scone: 2, madeleine: 4 } },
        ],
      },
      {
        id: 'E_q4',
        weightKey: 'q4',
        question: '오늘 원하는 경험은 무엇인가요?',
        options: [
          { id: 'E_q4_1', label: '익숙하지만 새로운 맛', fitness: { kouignAmann: 2, campagne: 3, ciabatta: 4, pretzel: 2, focaccia: 3, danish: 2, eggTart: 2, scone: 5, madeleine: 2 } },
          { id: 'E_q4_2', label: '처음 먹어보는 맛', fitness: { kouignAmann: 2, campagne: 2, ciabatta: 3, pretzel: 4, focaccia: 5, danish: 2, eggTart: 2, scone: 2, madeleine: 2 } },
          { id: 'E_q4_3', label: '유명한 메뉴', fitness: { kouignAmann: 4, campagne: 2, ciabatta: 2, pretzel: 2, focaccia: 2, danish: 3, eggTart: 2, scone: 2, madeleine: 5 } },
          { id: 'E_q4_4', label: '숨은 맛집 메뉴', fitness: { kouignAmann: 2, campagne: 5, ciabatta: 2, pretzel: 2, focaccia: 2, danish: 3, eggTart: 4, scone: 2, madeleine: 2 } },
          { id: 'E_q4_5', label: '셰프 추천 느낌', fitness: { kouignAmann: 4, campagne: 2, ciabatta: 2, pretzel: 2, focaccia: 2, danish: 5, eggTart: 3, scone: 2, madeleine: 2 } },
        ],
      },
      {
        id: 'E_q5',
        weightKey: 'q5',
        question: '추천 기준은 무엇인가요?',
        options: [
          { id: 'E_q5_1', label: '가장 독특한 빵', fitness: { kouignAmann: 2, campagne: 2, ciabatta: 5, pretzel: 4, focaccia: 3, danish: 2, eggTart: 2, scone: 2, madeleine: 2 } },
          { id: 'E_q5_2', label: '재방문이 많은 빵', fitness: { kouignAmann: 5, campagne: 2, ciabatta: 2, pretzel: 2, focaccia: 2, danish: 3, eggTart: 3, scone: 2, madeleine: 2 } },
          { id: 'E_q5_3', label: '현지인이 추천하는 빵', fitness: { kouignAmann: 2, campagne: 5, ciabatta: 3, pretzel: 2, focaccia: 4, danish: 2, eggTart: 2, scone: 2, madeleine: 2 } },
          { id: 'E_q5_4', label: '베이커리 대표 메뉴', fitness: { kouignAmann: 4, campagne: 2, ciabatta: 2, pretzel: 2, focaccia: 2, danish: 3, eggTart: 5, scone: 2, madeleine: 2 } },
          { id: 'E_q5_5', label: '완전히 랜덤한 추천', fitness: { kouignAmann: 2, campagne: 2, ciabatta: 2, pretzel: 2, focaccia: 2, danish: 2, eggTart: 3, scone: 5, madeleine: 4 } },
        ],
      },
    ],
  },
}
