// "관광모아" 설문 데이터 — PDF(대전 관광지 추천 트리형+가중치 로직 찐최종본, 2026-08-10) 2~8절을 그대로 데이터화.
// 구조: Q0(행정구, 점수 미반영, 후보군 필터 전용) → Q1(동행자→Branch A~E) → 해당 Branch의 Q2~Q5(테마 가중치+세부 성향 태그)
// id 네이밍은 빵집찾기 surveyConfig.js와 동일하게 브랜치 접두사를 붙인다.
export const Q0_ID = 'q0'
export const Q0 = {
  id: Q0_ID,
  question: '어느 지역의 관광지를 둘러보고 싶으신가요?',
  options: [
    { id: 'q0_dong', label: '동구', district: '동구' },
    { id: 'q0_jung', label: '중구', district: '중구' },
    { id: 'q0_seo', label: '서구', district: '서구' },
    { id: 'q0_yuseong', label: '유성구', district: '유성구' },
    { id: 'q0_daedeok', label: '대덕구', district: '대덕구' },
  ],
}

export const Q1_ID = 'q1'
export const Q1 = {
  id: Q1_ID,
  question: '이번 대전 여행은 누구와 함께하시나요?',
  options: [
    { id: 'q1_solo', label: '혼자', branch: 'A' },
    { id: 'q1_couple', label: '연인', branch: 'B' },
    { id: 'q1_friends', label: '친구', branch: 'C' },
    { id: 'q1_kids', label: '아이 동반 가족', branch: 'D' },
    { id: 'q1_parents', label: '부모님·어르신 가족', branch: 'E' },
  ],
}

export const THEMES = ['nature', 'history', 'culture', 'education', 'etc']
export const TRAIT_TAGS = [
  'walk', 'rest', 'scenery', 'exploration', 'immersion',
  'appreciation', 'sightseeing', 'experience', 'knowledge', 'uniqueness', 'activity',
]

export const BRANCHES = {
  A: {
    id: 'A',
    label: '혼자 여행',
    questions: [
      {
        id: 'A_q2',
        question: '이번 혼자 여행에서 가장 원하는 시간은?',
        options: [
          { id: 'A_q2_1', label: '조용한 곳에서 여유롭게 쉬는 시간', themeWeight: { nature: 5, history: 1, culture: 1, education: 0, etc: 1 }, traits: { rest: 5, walk: 4, scenery: 3 } },
          { id: 'A_q2_2', label: '새로운 장소를 천천히 알아가는 시간', themeWeight: { nature: 1, history: 5, culture: 1, education: 2, etc: 1 }, traits: { exploration: 5, knowledge: 3, immersion: 4 } },
          { id: 'A_q2_3', label: '전시나 공연 등을 감상하는 시간', themeWeight: { nature: 0, history: 1, culture: 5, education: 1, etc: 2 }, traits: { appreciation: 5, sightseeing: 4 } },
          { id: 'A_q2_4', label: '새로운 것을 배우고 체험하는 시간', themeWeight: { nature: 1, history: 1, culture: 1, education: 5, etc: 2 }, traits: { experience: 5, knowledge: 5 } },
          { id: 'A_q2_5', label: '유명하거나 독특한 장소를 찾아다니는 시간', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, exploration: 4, sightseeing: 3 } },
        ],
      },
      {
        id: 'A_q3',
        question: '혼자 걷다가 가장 들어가 보고 싶은 곳은?',
        options: [
          { id: 'A_q3_1', label: '풍경이 좋고 산책하기 좋은 곳', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { walk: 5, scenery: 5, rest: 3 } },
          { id: 'A_q3_2', label: '오래된 건물이나 이야기가 있는 곳', themeWeight: { nature: 0, history: 5, culture: 2, education: 1, etc: 0 }, traits: { exploration: 5, knowledge: 4, immersion: 4 } },
          { id: 'A_q3_3', label: '전시·공연·예술을 즐길 수 있는 곳', themeWeight: { nature: 0, history: 1, culture: 5, education: 1, etc: 2 }, traits: { appreciation: 5, sightseeing: 5 } },
          { id: 'A_q3_4', label: '과학이나 지식을 직접 경험할 수 있는 곳', themeWeight: { nature: 0, history: 0, culture: 1, education: 5, etc: 2 }, traits: { experience: 5, knowledge: 5 } },
          { id: 'A_q3_5', label: '대전을 대표하거나 특색 있는 장소', themeWeight: { nature: 1, history: 2, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, sightseeing: 4 } },
        ],
      },
      {
        id: 'A_q4',
        question: '관광지에서 가장 중요하게 생각하는 것은?',
        options: [
          { id: 'A_q4_1', label: '편안하게 머물 수 있는 분위기', themeWeight: { nature: 5, history: 1, culture: 1, education: 0, etc: 1 }, traits: { rest: 5, scenery: 3 } },
          { id: 'A_q4_2', label: '장소가 가진 이야기와 의미', themeWeight: { nature: 0, history: 5, culture: 2, education: 2, etc: 0 }, traits: { immersion: 5, knowledge: 4, exploration: 3 } },
          { id: 'A_q4_3', label: '볼거리와 감상할 거리', themeWeight: { nature: 1, history: 1, culture: 5, education: 1, etc: 2 }, traits: { sightseeing: 5, appreciation: 5 } },
          { id: 'A_q4_4', label: '새롭게 알게 되는 정보', themeWeight: { nature: 0, history: 2, culture: 1, education: 5, etc: 1 }, traits: { knowledge: 5, experience: 3 } },
          { id: 'A_q4_5', label: '다른 곳에서는 보기 힘든 특별함', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, exploration: 4 } },
        ],
      },
      {
        id: 'A_q5',
        question: '여행을 마친 뒤 어떤 기억이 남았으면 좋겠나요?',
        options: [
          { id: 'A_q5_1', label: '제대로 힐링했다', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { rest: 5, scenery: 3 } },
          { id: 'A_q5_2', label: '대전에 대해 더 잘 알게 됐다', themeWeight: { nature: 0, history: 5, culture: 2, education: 3, etc: 1 }, traits: { knowledge: 5, exploration: 4 } },
          { id: 'A_q5_3', label: '볼거리가 많아서 좋았다', themeWeight: { nature: 1, history: 1, culture: 5, education: 1, etc: 3 }, traits: { sightseeing: 5, appreciation: 4 } },
          { id: 'A_q5_4', label: '새로운 걸 많이 배웠다', themeWeight: { nature: 0, history: 2, culture: 1, education: 5, etc: 1 }, traits: { knowledge: 5, experience: 4 } },
          { id: 'A_q5_5', label: '이런 곳이 대전에 있는 줄 몰랐다', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, sightseeing: 3 } },
        ],
      },
    ],
  },

  B: {
    id: 'B',
    label: '연인 여행',
    questions: [
      {
        id: 'B_q2',
        question: '둘이 보내고 싶은 데이트에 가장 가까운 것은?',
        options: [
          { id: 'B_q2_1', label: '풍경을 보며 여유롭게 걷기', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { walk: 5, rest: 5, scenery: 5 } },
          { id: 'B_q2_2', label: '오래된 장소의 이야기를 함께 찾아보기', themeWeight: { nature: 1, history: 5, culture: 2, education: 1, etc: 1 }, traits: { exploration: 5, immersion: 4, knowledge: 3 } },
          { id: 'B_q2_3', label: '전시·공연 등 볼거리 즐기기', themeWeight: { nature: 0, history: 1, culture: 5, education: 1, etc: 2 }, traits: { appreciation: 5, sightseeing: 5 } },
          { id: 'B_q2_4', label: '새로운 것을 함께 체험해 보기', themeWeight: { nature: 1, history: 0, culture: 2, education: 5, etc: 3 }, traits: { experience: 5, activity: 4 } },
          { id: 'B_q2_5', label: '평소와 다른 이색적인 장소 가보기', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, sightseeing: 4 } },
        ],
      },
      {
        id: 'B_q3',
        question: '둘이 관광지를 고를 때 가장 끌리는 요소는?',
        options: [
          { id: 'B_q3_1', label: '예쁜 풍경과 산책하기 좋은 환경', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { scenery: 5, walk: 5, rest: 3 } },
          { id: 'B_q3_2', label: '장소에 얽힌 특별한 이야기', themeWeight: { nature: 0, history: 5, culture: 2, education: 1, etc: 1 }, traits: { immersion: 5, exploration: 4 } },
          { id: 'B_q3_3', label: '사진 찍거나 구경할 것이 많은 공간', themeWeight: { nature: 1, history: 1, culture: 5, education: 0, etc: 3 }, traits: { sightseeing: 5, appreciation: 4, scenery: 3 } },
          { id: 'B_q3_4', label: '직접 보고 배우거나 체험할 수 있는 요소', themeWeight: { nature: 0, history: 1, culture: 1, education: 5, etc: 3 }, traits: { experience: 5, knowledge: 4 } },
          { id: 'B_q3_5', label: '대전에서만 경험할 수 있는 독특함', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, sightseeing: 3 } },
        ],
      },
      {
        id: 'B_q4',
        question: '데이트 중 시간이 가장 빨리 갈 것 같은 순간은?',
        options: [
          { id: 'B_q4_1', label: '공원이나 숲길을 함께 걸을 때', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { walk: 5, rest: 4 } },
          { id: 'B_q4_2', label: '오래된 장소를 둘러보며 이야기를 나눌 때', themeWeight: { nature: 1, history: 5, culture: 2, education: 1, etc: 0 }, traits: { exploration: 5, immersion: 5 } },
          { id: 'B_q4_3', label: '전시나 공연을 함께 볼 때', themeWeight: { nature: 0, history: 1, culture: 5, education: 1, etc: 2 }, traits: { appreciation: 5, sightseeing: 5 } },
          { id: 'B_q4_4', label: '흥미로운 시설을 직접 체험할 때', themeWeight: { nature: 0, history: 0, culture: 2, education: 5, etc: 3 }, traits: { experience: 5, activity: 4 } },
          { id: 'B_q4_5', label: '예상하지 못한 독특한 장소를 발견했을 때', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, exploration: 3 } },
        ],
      },
      {
        id: 'B_q5',
        question: '이번 데이트에서 가장 남기고 싶은 것은?',
        options: [
          { id: 'B_q5_1', label: '편안하고 여유로운 추억', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { rest: 5, scenery: 4 } },
          { id: 'B_q5_2', label: '의미 있는 장소에서의 추억', themeWeight: { nature: 0, history: 5, culture: 2, education: 1, etc: 1 }, traits: { immersion: 5, exploration: 4 } },
          { id: 'B_q5_3', label: '사진과 볼거리가 가득한 추억', themeWeight: { nature: 1, history: 1, culture: 5, education: 0, etc: 3 }, traits: { sightseeing: 5, appreciation: 4 } },
          { id: 'B_q5_4', label: '함께 새로운 것을 경험한 추억', themeWeight: { nature: 0, history: 0, culture: 2, education: 5, etc: 3 }, traits: { experience: 5, activity: 4 } },
          { id: 'B_q5_5', label: '평범하지 않은 특별한 추억', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5 } },
        ],
      },
    ],
  },

  C: {
    id: 'C',
    label: '친구 여행',
    questions: [
      {
        id: 'C_q2',
        question: '친구들과 여행할 때 가장 중요한 것은?',
        options: [
          { id: 'C_q2_1', label: '여유롭게 돌아다니며 쉬는 것', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { rest: 5, walk: 4 } },
          { id: 'C_q2_2', label: '유명한 장소의 이야기를 알아보는 것', themeWeight: { nature: 0, history: 5, culture: 2, education: 2, etc: 1 }, traits: { exploration: 5, knowledge: 4 } },
          { id: 'C_q2_3', label: '볼거리 많은 곳을 구경하는 것', themeWeight: { nature: 1, history: 1, culture: 5, education: 0, etc: 3 }, traits: { sightseeing: 5, appreciation: 4 } },
          { id: 'C_q2_4', label: '함께 새로운 것을 체험하는 것', themeWeight: { nature: 0, history: 0, culture: 2, education: 5, etc: 3 }, traits: { experience: 5, activity: 5 } },
          { id: 'C_q2_5', label: '평소 가보기 힘든 곳을 가보는 것', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, exploration: 4 } },
        ],
      },
      {
        id: 'C_q3',
        question: '친구가 "다음 어디 갈까?"라고 물으면?',
        options: [
          { id: 'C_q3_1', label: '경치 좋은 곳 가서 좀 걷자', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { walk: 5, scenery: 5 } },
          { id: 'C_q3_2', label: '대전의 유명한 옛 장소 가보자', themeWeight: { nature: 0, history: 5, culture: 2, education: 1, etc: 0 }, traits: { exploration: 5, immersion: 4 } },
          { id: 'C_q3_3', label: '전시나 공연 볼 수 있는 곳 가자', themeWeight: { nature: 0, history: 1, culture: 5, education: 1, etc: 2 }, traits: { appreciation: 5, sightseeing: 5 } },
          { id: 'C_q3_4', label: '직접 체험할 수 있는 곳 가자', themeWeight: { nature: 0, history: 0, culture: 2, education: 5, etc: 3 }, traits: { experience: 5, activity: 5 } },
          { id: 'C_q3_5', label: '특이하고 재밌는 곳 찾아보자', themeWeight: { nature: 1, history: 0, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, activity: 4 } },
        ],
      },
      {
        id: 'C_q4',
        question: '단체 사진을 남긴다면 어떤 배경이 가장 좋나요?',
        options: [
          { id: 'C_q4_1', label: '탁 트인 풍경이나 자연', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { scenery: 5, walk: 3 } },
          { id: 'C_q4_2', label: '오래된 건축물이나 유적', themeWeight: { nature: 0, history: 5, culture: 2, education: 1, etc: 0 }, traits: { exploration: 5, immersion: 4 } },
          { id: 'C_q4_3', label: '개성 있는 전시·예술 공간', themeWeight: { nature: 0, history: 1, culture: 5, education: 1, etc: 2 }, traits: { appreciation: 5, sightseeing: 5 } },
          { id: 'C_q4_4', label: '과학·교육 시설이나 체험 공간', themeWeight: { nature: 0, history: 0, culture: 1, education: 5, etc: 2 }, traits: { experience: 5, knowledge: 4 } },
          { id: 'C_q4_5', label: '대전을 상징하는 독특한 장소', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, sightseeing: 4 } },
        ],
      },
      {
        id: 'C_q5',
        question: '친구들에게 이번 여행을 어떻게 기억시키고 싶나요?',
        options: [
          { id: 'C_q5_1', label: '편하게 놀다 온 여행', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { rest: 4, activity: 3 } },
          { id: 'C_q5_2', label: '대전다운 장소를 제대로 본 여행', themeWeight: { nature: 0, history: 5, culture: 2, education: 1, etc: 2 }, traits: { exploration: 5, immersion: 4 } },
          { id: 'C_q5_3', label: '볼거리와 사진이 많았던 여행', themeWeight: { nature: 1, history: 0, culture: 5, education: 0, etc: 3 }, traits: { sightseeing: 5, appreciation: 4 } },
          { id: 'C_q5_4', label: '직접 해본 것이 많았던 여행', themeWeight: { nature: 0, history: 0, culture: 2, education: 5, etc: 3 }, traits: { experience: 5, activity: 5 } },
          { id: 'C_q5_5', label: '예상보다 훨씬 색다르고 재밌었던 여행', themeWeight: { nature: 1, history: 0, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, activity: 4 } },
        ],
      },
    ],
  },

  D: {
    id: 'D',
    label: '아이 동반 가족',
    questions: [
      {
        id: 'D_q2',
        question: '아이가 여행 중 가장 즐거워했으면 하는 순간은?',
        options: [
          { id: 'D_q2_1', label: '넓은 공간에서 뛰어놀 때', themeWeight: { nature: 5, history: 0, culture: 1, education: 1, etc: 2 }, traits: { activity: 5, walk: 4 } },
          { id: 'D_q2_2', label: '옛날 이야기를 흥미롭게 들을 때', themeWeight: { nature: 0, history: 5, culture: 2, education: 3, etc: 1 }, traits: { knowledge: 4, immersion: 4 } },
          { id: 'D_q2_3', label: '다양한 전시와 볼거리를 구경할 때', themeWeight: { nature: 1, history: 1, culture: 5, education: 2, etc: 2 }, traits: { sightseeing: 5, appreciation: 4 } },
          { id: 'D_q2_4', label: '직접 만지고 관찰하며 배울 때', themeWeight: { nature: 1, history: 1, culture: 1, education: 5, etc: 3 }, traits: { experience: 5, knowledge: 5 } },
          { id: 'D_q2_5', label: '처음 보는 신기한 장소를 발견할 때', themeWeight: { nature: 1, history: 1, culture: 2, education: 2, etc: 5 }, traits: { uniqueness: 5, experience: 3 } },
        ],
      },
      {
        id: 'D_q3',
        question: '부모 입장에서 이번 여행에 가장 기대하는 것은?',
        options: [
          { id: 'D_q3_1', label: '아이와 편안한 시간을 보내는 것', themeWeight: { nature: 5, history: 0, culture: 1, education: 1, etc: 1 }, traits: { rest: 5, walk: 3 } },
          { id: 'D_q3_2', label: '자연스럽게 지역의 이야기를 알려주는 것', themeWeight: { nature: 0, history: 5, culture: 2, education: 3, etc: 0 }, traits: { knowledge: 5, exploration: 4 } },
          { id: 'D_q3_3', label: '가족이 함께 볼거리를 즐기는 것', themeWeight: { nature: 1, history: 1, culture: 5, education: 2, etc: 2 }, traits: { sightseeing: 5, appreciation: 4 } },
          { id: 'D_q3_4', label: '놀면서 새로운 것을 배우는 것', themeWeight: { nature: 1, history: 0, culture: 1, education: 5, etc: 3 }, traits: { experience: 5, knowledge: 5 } },
          { id: 'D_q3_5', label: '평소 접하기 힘든 경험을 시켜주는 것', themeWeight: { nature: 0, history: 1, culture: 2, education: 3, etc: 5 }, traits: { uniqueness: 5, experience: 4 } },
        ],
      },
      {
        id: 'D_q4',
        question: '아이가 "여기 또 오고 싶어!"라고 한다면 어떤 곳일까요?',
        options: [
          { id: 'D_q4_1', label: '마음껏 움직이고 자연을 즐긴 곳', themeWeight: { nature: 5, history: 0, culture: 1, education: 1, etc: 2 }, traits: { activity: 5, walk: 4 } },
          { id: 'D_q4_2', label: '재미있는 옛날 이야기가 있었던 곳', themeWeight: { nature: 0, history: 5, culture: 2, education: 3, etc: 1 }, traits: { immersion: 5, knowledge: 4 } },
          { id: 'D_q4_3', label: '신기한 볼거리가 많았던 곳', themeWeight: { nature: 1, history: 1, culture: 5, education: 2, etc: 3 }, traits: { sightseeing: 5, appreciation: 4 } },
          { id: 'D_q4_4', label: '직접 해보고 배울 것이 많았던 곳', themeWeight: { nature: 0, history: 1, culture: 1, education: 5, etc: 3 }, traits: { experience: 5, knowledge: 5 } },
          { id: 'D_q4_5', label: '다른 곳과 확실히 달랐던 곳', themeWeight: { nature: 1, history: 1, culture: 2, education: 2, etc: 5 }, traits: { uniqueness: 5 } },
        ],
      },
      {
        id: 'D_q5',
        question: '가족 여행 후 아이에게 가장 듣고 싶은 말은?',
        options: [
          { id: 'D_q5_1', label: '밖에서 놀아서 좋았어!', themeWeight: { nature: 5, history: 0, culture: 1, education: 1, etc: 2 }, traits: { activity: 5, walk: 4 } },
          { id: 'D_q5_2', label: '옛날 이야기가 신기했어!', themeWeight: { nature: 0, history: 5, culture: 2, education: 3, etc: 1 }, traits: { immersion: 4, knowledge: 4 } },
          { id: 'D_q5_3', label: '구경할 게 진짜 많았어!', themeWeight: { nature: 1, history: 1, culture: 5, education: 2, etc: 3 }, traits: { sightseeing: 5 } },
          { id: 'D_q5_4', label: '새로운 걸 알게 됐어!', themeWeight: { nature: 0, history: 1, culture: 1, education: 5, etc: 2 }, traits: { knowledge: 5, experience: 4 } },
          { id: 'D_q5_5', label: '거기 진짜 신기했어!', themeWeight: { nature: 1, history: 1, culture: 2, education: 2, etc: 5 }, traits: { uniqueness: 5 } },
        ],
      },
    ],
  },

  E: {
    id: 'E',
    label: '부모님·어르신 동반 가족',
    questions: [
      {
        id: 'E_q2',
        question: '가족과 어떤 시간을 보내고 싶으신가요?',
        options: [
          { id: 'E_q2_1', label: '좋은 풍경을 보며 여유롭게 걷기', themeWeight: { nature: 5, history: 1, culture: 1, education: 0, etc: 1 }, traits: { walk: 5, rest: 5, scenery: 5 } },
          { id: 'E_q2_2', label: '대전의 오래된 장소와 이야기를 둘러보기', themeWeight: { nature: 0, history: 5, culture: 2, education: 1, etc: 1 }, traits: { exploration: 5, immersion: 4 } },
          { id: 'E_q2_3', label: '전시·공연 등 다양한 볼거리 감상하기', themeWeight: { nature: 0, history: 1, culture: 5, education: 1, etc: 2 }, traits: { appreciation: 5, sightseeing: 5 } },
          { id: 'E_q2_4', label: '새로운 정보와 지식을 함께 알아보기', themeWeight: { nature: 0, history: 2, culture: 1, education: 5, etc: 1 }, traits: { knowledge: 5, experience: 2 } },
          { id: 'E_q2_5', label: '대전을 대표하는 특별한 장소 둘러보기', themeWeight: { nature: 1, history: 2, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, exploration: 3 } },
        ],
      },
      {
        id: 'E_q3',
        question: '부모님께 한 곳을 추천한다면 가장 중요하게 볼 것은?',
        options: [
          { id: 'E_q3_1', label: '편안하고 경치가 좋은지', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { rest: 5, scenery: 5, walk: 3 } },
          { id: 'E_q3_2', label: '역사적 의미가 있는지', themeWeight: { nature: 0, history: 5, culture: 2, education: 1, etc: 1 }, traits: { immersion: 5, exploration: 4 } },
          { id: 'E_q3_3', label: '볼거리가 풍부한지', themeWeight: { nature: 1, history: 1, culture: 5, education: 1, etc: 2 }, traits: { sightseeing: 5, appreciation: 4 } },
          { id: 'E_q3_4', label: '흥미롭게 알아볼 것이 있는지', themeWeight: { nature: 0, history: 1, culture: 1, education: 5, etc: 2 }, traits: { knowledge: 5 } },
          { id: 'E_q3_5', label: '대전을 대표할 만한 곳인지', themeWeight: { nature: 1, history: 2, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, exploration: 3 } },
        ],
      },
      {
        id: 'E_q4',
        question: '가족끼리 이야기를 나누기 좋은 여행은?',
        options: [
          { id: 'E_q4_1', label: '자연 속에서 여유를 즐기는 여행', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { rest: 5, walk: 4 } },
          { id: 'E_q4_2', label: '옛날 이야기와 추억을 나누는 여행', themeWeight: { nature: 0, history: 5, culture: 2, education: 1, etc: 1 }, traits: { immersion: 5, exploration: 4 } },
          { id: 'E_q4_3', label: '다양한 볼거리를 함께 감상하는 여행', themeWeight: { nature: 1, history: 1, culture: 5, education: 1, etc: 2 }, traits: { appreciation: 5, sightseeing: 5 } },
          { id: 'E_q4_4', label: '새로운 것을 함께 알아가는 여행', themeWeight: { nature: 0, history: 1, culture: 1, education: 5, etc: 2 }, traits: { knowledge: 5 } },
          { id: 'E_q4_5', label: '대전의 색다른 모습을 발견하는 여행', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, exploration: 3 } },
        ],
      },
      {
        id: 'E_q5',
        question: '부모님과의 대전 여행을 한마디로 남긴다면?',
        options: [
          { id: 'E_q5_1', label: '편안하게 잘 쉬었다', themeWeight: { nature: 5, history: 0, culture: 1, education: 0, etc: 1 }, traits: { rest: 5, scenery: 3 } },
          { id: 'E_q5_2', label: '의미 있는 곳을 많이 봤다', themeWeight: { nature: 0, history: 5, culture: 2, education: 2, etc: 1 }, traits: { immersion: 5, exploration: 4 } },
          { id: 'E_q5_3', label: '구경할 게 많아서 좋았다', themeWeight: { nature: 1, history: 1, culture: 5, education: 1, etc: 2 }, traits: { sightseeing: 5, appreciation: 4 } },
          { id: 'E_q5_4', label: '새롭게 알게 된 게 많았다', themeWeight: { nature: 0, history: 1, culture: 1, education: 5, etc: 1 }, traits: { knowledge: 5 } },
          { id: 'E_q5_5', label: '대전만의 특별한 곳을 잘 둘러봤다', themeWeight: { nature: 1, history: 1, culture: 2, education: 1, etc: 5 }, traits: { uniqueness: 5, exploration: 4 } },
        ],
      },
    ],
  },
}
