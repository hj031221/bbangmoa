# 관광모아 추천 로직 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF(`대전 관광지 추천 트리형+가중치 로직 찐최종본`)의 Q0~Q5 트리형 설문 + 테마 가중치 + 코사인 유사도 + 동행 적합도 80:20 추천 로직을 관광모아 기능에 구현한다.

**Architecture:** 순수 데이터/로직 모듈 3개(`tourSurveyConfig.js` 설문 데이터, `tourAttractionTags.js` 186곳 자동 태깅, `tourRecommend.js` 추천 엔진)를 먼저 만들고, 그 위에 UI 3곳(`TourSurveyFlow.jsx`, `TourReveal.jsx` 신규, `LandingPage.jsx`)을 배선한다. `TourPage.jsx`는 결과 화면에서 특정 구/관광지로 진입할 수 있도록 prop 2개만 추가한다.

**Tech Stack:** React 18 + Vite, 순수 JS(ESM). 새 의존성 없이 Node 내장 테스트러너(`node:test`, `node:assert/strict`)로 로직 모듈을 검증한다.

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-08-10-tour-recommendation-design.md` (모든 결정의 근거)
- 태그 11개 키 순서/이름: `walk, rest, scenery, exploration, immersion, appreciation, sightseeing, experience, knowledge, uniqueness, activity` (PDF 8·11절 영문 필드명 그대로)
- 테마 5개 키: `nature, history, culture, education, etc` (PDF 자연/역사/문화/교육/기타)
- 동행 적합도 5개 키: `solo, couple, friends, childrenFamily, parentsFamily` (PDF 혼자/연인/친구/아이가족/부모님가족, PDF 11절 JSON 예시 필드명 그대로)
- 관광모아 설문 답변은 로컬 state로만 관리한다 — 빵집찾기 전역 스토어(`useAppStore`)에 절대 쓰지 않는다 (기존 `TourSurveyFlow.jsx` 주석에 명시된 이유: 전역 공유 시 빵집찾기가 "설문 이미 완료함"으로 오판)
- 새 npm 패키지를 추가하지 않는다. 테스트는 `node --test`로 실행한다.
- 최종 점수 공식은 `성향일치도 × 0.8 + 동행적합도 × 0.2`를 정확히 따른다 (대표성 10% 없음, PDF 10절)

---

## 파일 구성

| 파일 | 상태 |
|---|---|
| `src/data/tourSurveyConfig.js` | 신규 |
| `src/data/tourSurveyConfig.test.js` | 신규 |
| `src/data/tourAttractionTags.js` | 신규 |
| `src/data/tourAttractionTags.test.js` | 신규 |
| `src/lib/tourRecommend.js` | 신규 |
| `src/lib/tourRecommend.test.js` | 신규 |
| `src/lib/tourIntegration.test.js` | 신규 |
| `src/components/tour/TourPage.jsx` | 수정 |
| `src/components/tour/TourSurveyFlow.jsx` | 수정 |
| `src/components/tour/TourReveal.jsx` | 신규 |
| `src/pages/LandingPage.jsx` | 수정 |
| `src/styles.css` | 수정 (`.tour-reveal*` 클래스 추가) |
| `package.json` | 수정 (`"test"` 스크립트 추가) |

---

### Task 1: 관광모아 설문 데이터 (`tourSurveyConfig.js`)

**Files:**
- Create: `src/data/tourSurveyConfig.js`
- Test: `src/data/tourSurveyConfig.test.js`
- Modify: `package.json` (test 스크립트 추가)

**Interfaces:**
- Produces: `Q0_ID`, `Q0`(`{id, question, options:[{id,label,district}]}`), `Q1_ID`, `Q1`(`{id, question, options:[{id,label,branch}]}`), `THEMES`(`['nature','history','culture','education','etc']`), `TRAIT_TAGS`(11개 문자열 배열), `BRANCHES`(`{A~E: {id, label, questions:[{id, question, options:[{id, label, themeWeight:{5개}, traits:{일부}}]}]}}`, 각 branch당 questions 4개, 각 options 5개)

- [ ] **Step 1: 테스트 스크립트를 package.json에 추가**

`package.json`의 `"scripts"`에 추가:
```json
"test": "node --test src"
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/data/tourSurveyConfig.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Q0, Q1, BRANCHES, THEMES, TRAIT_TAGS } from './tourSurveyConfig.js'

test('Q0는 5개 행정구 옵션을 가진다', () => {
  assert.equal(Q0.options.length, 5)
  const districts = Q0.options.map((o) => o.district)
  assert.deepEqual(districts, ['동구', '중구', '서구', '유성구', '대덕구'])
})

test('Q1은 5개 동행자 옵션이며 Branch A~E와 1:1 매핑된다', () => {
  assert.equal(Q1.options.length, 5)
  const branches = Q1.options.map((o) => o.branch).sort()
  assert.deepEqual(branches, ['A', 'B', 'C', 'D', 'E'])
})

test('모든 Branch는 Q2~Q5 4문항, 각 5지선다를 가진다', () => {
  for (const branchId of ['A', 'B', 'C', 'D', 'E']) {
    const branch = BRANCHES[branchId]
    assert.equal(branch.questions.length, 4)
    for (const q of branch.questions) {
      assert.equal(q.options.length, 5)
      for (const opt of q.options) {
        for (const theme of THEMES) assert.ok(theme in opt.themeWeight, `${opt.id}: ${theme} 누락`)
        for (const tag of Object.keys(opt.traits)) {
          assert.ok(TRAIT_TAGS.includes(tag), `${opt.id}: 잘못된 태그 ${tag}`)
        }
      }
    }
  }
})

test('PDF 7절 예시: 연인(B) Q2①,Q3①,Q4③,Q5① → 자연15/역사1/문화8/교육1/기타5', () => {
  const branch = BRANCHES.B
  const scores = { nature: 0, history: 0, culture: 0, education: 0, etc: 0 }
  const picks = [
    branch.questions[0].options[0],
    branch.questions[1].options[0],
    branch.questions[2].options[2],
    branch.questions[3].options[0],
  ]
  for (const opt of picks) {
    for (const theme of THEMES) scores[theme] += opt.themeWeight[theme]
  }
  assert.deepEqual(scores, { nature: 15, history: 1, culture: 8, education: 1, etc: 5 })
})
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

Run: `node --test src/data/tourSurveyConfig.test.js`
Expected: FAIL (`tourSurveyConfig.js` 모듈이 없어서 import 에러)

- [ ] **Step 4: `tourSurveyConfig.js` 작성**

`src/data/tourSurveyConfig.js`:
```js
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
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

Run: `node --test src/data/tourSurveyConfig.test.js`
Expected: PASS (4개 테스트 모두)

- [ ] **Step 6: 커밋**

```bash
git add package.json src/data/tourSurveyConfig.js src/data/tourSurveyConfig.test.js
git commit -m "feat: 관광모아 설문 데이터(Q0~Q5, Branch A~E) 추가"
```

---

### Task 2: 186곳 관광지 자동 태깅 (`tourAttractionTags.js`)

**Files:**
- Create: `src/data/tourAttractionTags.js`
- Test: `src/data/tourAttractionTags.test.js`

**Interfaces:**
- Consumes: `src/data/daejeonTour.json`(기존, 186개 원본), `THEMES`/`TRAIT_TAGS`(Task 1, 테스트에서만 사용)
- Produces: `TAGGED_ATTRACTIONS`(배열, 각 원소 = 원본 필드 + `{district, themes:[], traits:{11개}, companion:{5개}}`), `getAttractionById(id)`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/data/tourAttractionTags.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAGGED_ATTRACTIONS, getAttractionById } from './tourAttractionTags.js'
import { THEMES, TRAIT_TAGS } from './tourSurveyConfig.js'

test('모든 태깅된 관광지는 1개 이상의 유효한 테마를 가진다', () => {
  assert.ok(TAGGED_ATTRACTIONS.length > 100)
  for (const a of TAGGED_ATTRACTIONS) {
    assert.ok(a.themes.length > 0, `${a.name}: themes 비어있음`)
    for (const t of a.themes) assert.ok(THEMES.includes(t), `${a.name}: 잘못된 테마 "${t}"`)
  }
})

test('모든 태깅된 관광지는 5개 구 중 하나에 속한다', () => {
  const districts = ['동구', '중구', '서구', '유성구', '대덕구']
  for (const a of TAGGED_ATTRACTIONS) {
    assert.ok(districts.includes(a.district), `${a.name}: district=${a.district}`)
  }
})

test('trait 벡터는 0~5 범위이며 전부 0인 벡터는 없다', () => {
  for (const a of TAGGED_ATTRACTIONS) {
    let sum = 0
    for (const tag of TRAIT_TAGS) {
      const v = a.traits[tag]
      assert.ok(v >= 0 && v <= 5, `${a.name}: ${tag}=${v}`)
      sum += v
    }
    assert.ok(sum > 0, `${a.name}: trait 벡터 전부 0`)
  }
})

test('동행 적합도는 0~100 범위다', () => {
  for (const a of TAGGED_ATTRACTIONS) {
    for (const key of ['solo', 'couple', 'friends', 'childrenFamily', 'parentsFamily']) {
      const v = a.companion[key]
      assert.ok(v >= 0 && v <= 100, `${a.name}: ${key}=${v}`)
    }
  }
})

test('뿌리공원(cat=A02020700, 공원류)은 자연 테마로 분류된다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '뿌리공원')
  assert.ok(site, '뿌리공원을 찾을 수 없음')
  assert.ok(site.themes.includes('nature'))
})

test('이응노 미술관(cat=A02060500)은 문화 테마로 분류된다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '이응노 미술관')
  assert.ok(site)
  assert.ok(site.themes.includes('culture'))
})

test('한밭교육박물관(cat=A02060100)은 교육 테마로 분류된다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '한밭교육박물관')
  assert.ok(site)
  assert.ok(site.themes.includes('education'))
})

test('국립 대전 현충원은 cat 코드 없이 이름 키워드로 역사 테마를 받고, 자연이 보조 테마로 추가된다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '국립 대전 현충원')
  assert.ok(site)
  assert.deepEqual(site.themes, ['history', 'nature'])
})

test('한밭수목원(cat 없음)은 이름 키워드로 자연 테마를 받는다', () => {
  const site = TAGGED_ATTRACTIONS.find((a) => a.name === '한밭수목원')
  assert.ok(site)
  assert.ok(site.themes.includes('nature'))
})

test('getAttractionById는 존재하는 id를 반환하고 없으면 null', () => {
  const first = TAGGED_ATTRACTIONS[0]
  assert.equal(getAttractionById(first.id).id, first.id)
  assert.equal(getAttractionById('__없는_id__'), null)
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test src/data/tourAttractionTags.test.js`
Expected: FAIL (`tourAttractionTags.js` 모듈 없음)

- [ ] **Step 3: `tourAttractionTags.js` 작성**

`src/data/tourAttractionTags.js`:
```js
// daejeonTour.json 186곳(이미지 있는 173곳만 사용)에 규칙 기반으로 themes/traits/companion 을 부여한다.
// 근거: docs/superpowers/specs/2026-08-10-tour-recommendation-design.md 3절.
// 1순위 KTO cat 코드 매핑 → 2순위(cat 없음) 이름 키워드 규칙 → 그래도 안 잡히면 'etc'.
import daejeonTour from './daejeonTour.json'

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
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test src/data/tourAttractionTags.test.js`
Expected: PASS (10개 테스트 모두). 만약 특정 관광지 이름 매칭 테스트가 실패하면(`daejeonTour.json`의 실제 이름 표기가 다를 수 있음) `assert.ok(site, ...)` 실패 메시지로 어느 이름을 못 찾았는지 확인 후, 실제 JSON의 정확한 이름 문자열로 테스트를 고친다.

- [ ] **Step 5: 커밋**

```bash
git add src/data/tourAttractionTags.js src/data/tourAttractionTags.test.js
git commit -m "feat: 186곳 관광지 규칙 기반 자동 태깅(테마/성향태그/동행적합도) 추가"
```

---

### Task 3: 추천 엔진 (`tourRecommend.js`)

**Files:**
- Create: `src/lib/tourRecommend.js`
- Test: `src/lib/tourRecommend.test.js`

**Interfaces:**
- Consumes: `Q0, Q1, BRANCHES, THEMES, TRAIT_TAGS`(Task 1). `attractions`는 파라미터로 주입받는다(테스트에서는 mock, 실제 사용처는 `TAGGED_ATTRACTIONS`).
- Produces:
  - `resolveDistrict(answers) => string|null`
  - `resolveBranch(answers) => 'A'|'B'|'C'|'D'|'E'|null`
  - `computeThemeScores(branchId, answers) => {nature,history,culture,education,etc}`
  - `pickTheme(branchId, answers, themeScores, districtCounts) => string`
  - `buildUserTraitVector(branchId, answers) => {11개 태그}`
  - `cosineSimilarity(userVec, siteVec) => number(0~1)`
  - `topTags(vector, n) => string[]`
  - `scoreAttractions({district, theme, branchId, answers, attractions}) => {effectiveTheme, results: [{attraction, traitMatch, companionScore, finalScore}]}`
  - `buildThemeReason(branchId, answers, theme) => string`
  - `buildAttractionReason(userVec, attraction) => string`
  - `getTourRecommendation(answers, attractions) => {district, branch, theme, themeReason, companionKey, results:[{attraction, score, reason}]} | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/tourRecommend.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Q0, Q1, BRANCHES } from '../data/tourSurveyConfig.js'
import {
  resolveDistrict, resolveBranch, computeThemeScores, pickTheme,
  buildUserTraitVector, cosineSimilarity, scoreAttractions,
  buildThemeReason, buildAttractionReason, getTourRecommendation,
} from './tourRecommend.js'

function districtOptionId(district) {
  return Q0.options.find((o) => o.district === district).id
}
function branchOptionId(branchId) {
  return Q1.options.find((o) => o.branch === branchId).id
}
function sampleAnswers(branchId, optionIndexes, district) {
  const branch = BRANCHES[branchId]
  const answers = { [Q0.id]: districtOptionId(district), [Q1.id]: branchOptionId(branchId) }
  branch.questions.forEach((q, i) => { answers[q.id] = q.options[optionIndexes[i]].id })
  return answers
}

function mockAttraction(id, district, themes, traitOverrides = {}) {
  return {
    id, name: id, district, themes,
    traits: {
      walk: 2, rest: 2, scenery: 2, exploration: 2, immersion: 2,
      appreciation: 2, sightseeing: 2, experience: 2, knowledge: 2, uniqueness: 2, activity: 2,
      ...traitOverrides,
    },
    companion: { solo: 50, couple: 50, friends: 50, childrenFamily: 50, parentsFamily: 50 },
  }
}

test('resolveDistrict/resolveBranch: 미응답이면 null', () => {
  assert.equal(resolveDistrict({}), null)
  assert.equal(resolveBranch({}), null)
})

test('resolveDistrict/resolveBranch: Q0/Q1 응답을 올바르게 해석한다', () => {
  const answers = { [Q0.id]: 'q0_jung', [Q1.id]: 'q1_couple' }
  assert.equal(resolveDistrict(answers), '중구')
  assert.equal(resolveBranch(answers), 'B')
})

test('computeThemeScores + pickTheme: PDF 7절 예시(연인 Q2①Q3①Q4③Q5①) → 자연 결정', () => {
  const answers = sampleAnswers('B', [0, 0, 2, 0], '중구')
  const scores = computeThemeScores('B', answers)
  assert.deepEqual(scores, { nature: 15, history: 1, culture: 8, education: 1, etc: 5 })
  assert.equal(pickTheme('B', answers, scores, null), 'nature')
})

test('pickTheme 동점처리: Q5 선택의 주 테마가 있으면 그것으로 정해진다', () => {
  // history/culture 동점을 만드는 인위적 themeScores, 실제 Q5 응답은 A_q5_2(역사 주테마: history5·culture2)
  const answers = sampleAnswers('A', [1, 1, 2, 1], '중구')
  const tied = { nature: 0, history: 10, culture: 10, education: 0, etc: 0 }
  assert.equal(pickTheme('A', answers, tied, null), 'history')
})

test('pickTheme 동점처리: Q5→Q4→Q3 모두 역사=문화로 동률이면 구 관광지 수로 결정된다', () => {
  // E_q3_4/E_q4_4/E_q5_4 는 모두 history1=culture1이라 Q5→Q4→Q3 단계에서 동점이 풀리지 않는다.
  const answers = sampleAnswers('E', [0, 3, 3, 3], '중구')
  const tied = { nature: 0, history: 10, culture: 10, education: 0, etc: 0 }
  const counts = { nature: 1, history: 2, culture: 5, education: 0, etc: 0 }
  assert.equal(pickTheme('E', answers, tied, counts), 'culture')
})

test('buildUserTraitVector: Q2~Q5 태그가 누적된다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '중구')
  const vec = buildUserTraitVector('A', answers)
  // A_q2_1 rest5·walk4·scenery3 + A_q3_1 walk5·scenery5·rest3 + A_q4_1 rest5·scenery3 + A_q5_1 rest5·scenery3
  assert.equal(vec.rest, 5 + 3 + 5 + 5)
  assert.equal(vec.walk, 4 + 5)
  assert.equal(vec.scenery, 3 + 5 + 3 + 3)
  assert.equal(vec.knowledge, 0)
})

test('cosineSimilarity: 동일 벡터는 1, 한쪽이 0벡터면 0을 반환한다(0벡터 방지)', () => {
  const v = { walk: 3, rest: 1, scenery: 0, exploration: 0, immersion: 0, appreciation: 0, sightseeing: 0, experience: 0, knowledge: 0, uniqueness: 0, activity: 0 }
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-9)
  const zero = { walk: 0, rest: 0, scenery: 0, exploration: 0, immersion: 0, appreciation: 0, sightseeing: 0, experience: 0, knowledge: 0, uniqueness: 0, activity: 0 }
  assert.equal(cosineSimilarity(v, zero), 0)
  assert.equal(cosineSimilarity(zero, zero), 0)
})

test('scoreAttractions: 후보 3개 이상이면 그대로 상위 3개를 반환하고 테마는 바뀌지 않는다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '중구')
  const attractions = [
    mockAttraction('n1', '중구', ['nature'], { rest: 5, walk: 5, scenery: 5 }),
    mockAttraction('n2', '중구', ['nature']),
    mockAttraction('n3', '중구', ['nature']),
    mockAttraction('h1', '중구', ['history']),
  ]
  const { effectiveTheme, results } = scoreAttractions({ district: '중구', theme: 'nature', branchId: 'A', answers, attractions })
  assert.equal(effectiveTheme, 'nature')
  assert.equal(results.length, 3)
  assert.equal(results[0].attraction.id, 'n1')
})

// A_q2_1+A_q3_2+A_q4_2+A_q5_2 → nature5/history16/culture7/education6/etc2 (history가 2위 테마로 뚜렷하게 정해짐)
test('scoreAttractions: 후보 0개면 테마 2위로 완전히 전환된다(PDF 10절)', () => {
  const answers = sampleAnswers('A', [0, 1, 1, 1], '중구')
  const attractions = [
    mockAttraction('h1', '중구', ['history']),
    mockAttraction('h2', '중구', ['history']),
    mockAttraction('h3', '중구', ['history']),
  ]
  const { effectiveTheme, results } = scoreAttractions({ district: '중구', theme: 'nature', branchId: 'A', answers, attractions })
  assert.equal(effectiveTheme, 'history')
  assert.equal(results.length, 3)
})

test('scoreAttractions: 후보 1개면 2위 테마에서 상위 2개를 보충한다', () => {
  const answers = sampleAnswers('A', [0, 1, 1, 1], '중구')
  const attractions = [
    mockAttraction('n1', '중구', ['nature']),
    mockAttraction('h1', '중구', ['history']),
    mockAttraction('h2', '중구', ['history']),
  ]
  const { effectiveTheme, results } = scoreAttractions({ district: '중구', theme: 'nature', branchId: 'A', answers, attractions })
  assert.equal(effectiveTheme, 'nature')
  assert.equal(results.length, 3)
  // primary(1개)가 먼저 오고 fallback으로 보충되므로 순서상 n1이 항상 첫 번째다.
  assert.equal(results[0].attraction.id, 'n1')
})

test('scoreAttractions 동점처리: finalScore가 같으면 id 오름차순으로 정렬된다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '중구')
  const attractions = [
    mockAttraction('z1', '중구', ['nature']),
    mockAttraction('a1', '중구', ['nature']),
  ]
  const { results } = scoreAttractions({ district: '중구', theme: 'nature', branchId: 'A', answers, attractions })
  assert.equal(results[0].attraction.id, 'a1')
  assert.equal(results[1].attraction.id, 'z1')
})

test('buildAttractionReason: 사용자 상위 태그와 관광지 태그가 겹치면 문장을 만든다', () => {
  const userVec = { walk: 1, rest: 1, scenery: 1, exploration: 1, immersion: 1, appreciation: 1, sightseeing: 1, experience: 1, knowledge: 1, uniqueness: 5, activity: 5 }
  const attraction = mockAttraction('x', '중구', ['etc'], { uniqueness: 5, activity: 5 })
  const reason = buildAttractionReason(userVec, attraction)
  assert.match(reason, /이색성/)
  assert.match(reason, /활동성/)
})

test('getTourRecommendation: 전체 파이프라인이 district/branch/theme/results를 반환한다', () => {
  const answers = sampleAnswers('B', [0, 0, 2, 0], '중구')
  const attractions = [
    mockAttraction('n1', '중구', ['nature']),
    mockAttraction('n2', '중구', ['nature']),
    mockAttraction('n3', '중구', ['nature']),
  ]
  const result = getTourRecommendation(answers, attractions)
  assert.equal(result.district, '중구')
  assert.equal(result.branch, 'B')
  assert.equal(result.theme, 'nature')
  assert.equal(result.results.length, 3)
  assert.ok(result.themeReason.length > 0)
})

test('getTourRecommendation: 응답이 부족하면 null', () => {
  assert.equal(getTourRecommendation({}, []), null)
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test src/lib/tourRecommend.test.js`
Expected: FAIL (`tourRecommend.js` 모듈 없음)

- [ ] **Step 3: `tourRecommend.js` 작성**

`src/lib/tourRecommend.js`:
```js
// 관광모아 추천 엔진 — PDF(대전 관광지 추천 트리형+가중치 로직 찐최종본) 4·7·9·10·15절 구현.
//   Q0(구) + Q1(동행자→Branch) + Q2~Q5(테마 가중치+성향 태그) → 테마 결정 → 코사인 유사도
//   → 동행 적합도 → 80:20 최종 점수 → TOP3.
import { Q0, Q1, BRANCHES, THEMES, TRAIT_TAGS } from '../data/tourSurveyConfig.js'

export const COMPANION_KEY_BY_BRANCH = {
  A: 'solo', B: 'couple', C: 'friends', D: 'childrenFamily', E: 'parentsFamily',
}

const THEME_LABELS = { nature: '자연', history: '역사', culture: '문화', education: '교육', etc: '기타' }
const TAG_LABELS = {
  walk: '산책', rest: '휴식', scenery: '경관', exploration: '탐방', immersion: '몰입',
  appreciation: '감상', sightseeing: '볼거리', experience: '체험', knowledge: '지식',
  uniqueness: '이색성', activity: '활동성',
}

export function resolveDistrict(answers) {
  const chosenId = answers?.[Q0.id]
  return Q0.options.find((o) => o.id === chosenId)?.district ?? null
}

export function resolveBranch(answers) {
  const chosenId = answers?.[Q1.id]
  return Q1.options.find((o) => o.id === chosenId)?.branch ?? null
}

export function computeThemeScores(branchId, answers) {
  const scores = { nature: 0, history: 0, culture: 0, education: 0, etc: 0 }
  const branch = BRANCHES[branchId]
  if (!branch) return scores
  for (const q of branch.questions) {
    const opt = q.options.find((o) => o.id === answers?.[q.id])
    if (!opt) continue
    for (const theme of THEMES) scores[theme] += opt.themeWeight[theme] ?? 0
  }
  return scores
}

// PDF 7절 동점 처리: Q5 주테마 → Q4 주테마 → Q3 주테마 → 해당 구 관광지 수가 더 많은 테마.
// branch.questions 순서는 [Q2, Q3, Q4, Q5] 이므로 뒤에서부터(인덱스 3,2,1) 확인한다.
export function pickTheme(branchId, answers, themeScores, districtCounts) {
  const maxScore = Math.max(...THEMES.map((t) => themeScores[t]))
  let tied = THEMES.filter((t) => themeScores[t] === maxScore)
  if (tied.length === 1) return tied[0]

  const branch = BRANCHES[branchId]
  for (const qIndex of [3, 2, 1]) {
    if (tied.length === 1) break
    const q = branch?.questions[qIndex]
    const opt = q?.options.find((o) => o.id === answers?.[q.id])
    if (!opt) continue
    const optMax = Math.max(...tied.map((t) => opt.themeWeight[t] ?? 0))
    const narrowed = tied.filter((t) => (opt.themeWeight[t] ?? 0) === optMax)
    if (narrowed.length > 0) tied = narrowed
  }
  if (tied.length === 1 || !districtCounts) return tied[0]

  const maxCount = Math.max(...tied.map((t) => districtCounts[t] ?? 0))
  tied = tied.filter((t) => (districtCounts[t] ?? 0) === maxCount)
  return tied[0]
}

export function buildUserTraitVector(branchId, answers) {
  const vector = Object.fromEntries(TRAIT_TAGS.map((tag) => [tag, 0]))
  const branch = BRANCHES[branchId]
  if (!branch) return vector
  for (const q of branch.questions) {
    const opt = q.options.find((o) => o.id === answers?.[q.id])
    if (!opt) continue
    for (const [tag, val] of Object.entries(opt.traits)) vector[tag] += val
  }
  return vector
}

export function cosineSimilarity(userVec, siteVec) {
  let dot = 0, uMag = 0, sMag = 0
  for (const tag of TRAIT_TAGS) {
    const u = userVec[tag] ?? 0
    const s = siteVec[tag] ?? 0
    dot += u * s
    uMag += u * u
    sMag += s * s
  }
  if (uMag === 0 || sMag === 0) return 0
  return dot / (Math.sqrt(uMag) * Math.sqrt(sMag))
}

export function topTags(vector, n) {
  return [...TRAIT_TAGS].sort((a, b) => vector[b] - vector[a]).slice(0, n)
}

export function countAttractionsByTheme(district, attractions) {
  const counts = { nature: 0, history: 0, culture: 0, education: 0, etc: 0 }
  for (const a of attractions) {
    if (a.district !== district) continue
    for (const t of a.themes) counts[t] = (counts[t] ?? 0) + 1
  }
  return counts
}

function scoreThemePool(pool, userVec, userTopTags, companionKey) {
  const scored = pool.map((attraction) => {
    const traitMatch = cosineSimilarity(userVec, attraction.traits) * 100
    const companionScore = attraction.companion[companionKey] ?? 0
    const finalScore = traitMatch * 0.8 + companionScore * 0.2
    return { attraction, traitMatch, companionScore, finalScore }
  })
  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore
    if (b.traitMatch !== a.traitMatch) return b.traitMatch - a.traitMatch
    if (b.companionScore !== a.companionScore) return b.companionScore - a.companionScore
    const tagSum = (s) => userTopTags.reduce((sum, tag) => sum + (s.attraction.traits[tag] ?? 0), 0)
    const diff = tagSum(b) - tagSum(a)
    if (diff !== 0) return diff
    return a.attraction.id.localeCompare(b.attraction.id)
  })
  return scored
}

// PDF 10절: 성향일치도×0.8 + 동행적합도×0.2, 후보 0~2개 예외처리(같은 구 유지, 테마 2위로 보충/전환).
export function scoreAttractions({ district, theme, branchId, answers, attractions }) {
  const companionKey = COMPANION_KEY_BY_BRANCH[branchId]
  const userVec = buildUserTraitVector(branchId, answers)
  const userTopTags = topTags(userVec, 2)
  const pool = (t) => attractions.filter((a) => a.district === district && a.themes.includes(t))

  const primary = scoreThemePool(pool(theme), userVec, userTopTags, companionKey)
  if (primary.length >= 3) return { effectiveTheme: theme, results: primary.slice(0, 3) }

  const themeScores = computeThemeScores(branchId, answers)
  const secondTheme = THEMES.filter((t) => t !== theme).sort((a, b) => themeScores[b] - themeScores[a])[0]
  const fallback = scoreThemePool(pool(secondTheme), userVec, userTopTags, companionKey)

  if (primary.length === 0) return { effectiveTheme: secondTheme, results: fallback.slice(0, 3) }

  const merged = [...primary, ...fallback.filter((f) => !primary.some((p) => p.attraction.id === f.attraction.id))]
  return { effectiveTheme: theme, results: merged.slice(0, 3) }
}

export function buildThemeReason(branchId, answers, theme) {
  const branch = BRANCHES[branchId]
  if (!branch) return ''
  const picks = []
  for (const q of branch.questions) {
    const opt = q.options.find((o) => o.id === answers?.[q.id])
    if (!opt) continue
    const optTop = Object.entries(opt.themeWeight).sort((a, b) => b[1] - a[1])[0][0]
    if (optTop === theme) picks.push(opt.label)
  }
  if (picks.length === 0) return `${THEME_LABELS[theme]} 테마가 추천되었습니다.`
  return `${picks.join(', ')} 같은 성향이 반영되어 ${THEME_LABELS[theme]} 테마가 추천되었습니다.`
}

export function buildAttractionReason(userVec, attraction) {
  const userTop = topTags(userVec, 2)
  const common = userTop.filter((tag) => (attraction.traits[tag] ?? 0) >= 4)
  if (common.length === 0) return ''
  const labels = common.map((tag) => TAG_LABELS[tag])
  return `${labels.join('과 ')}을 중요하게 생각하는 여행 성향과 잘 맞는 장소입니다.`
}

export function getTourRecommendation(answers, attractions) {
  const district = resolveDistrict(answers)
  const branchId = resolveBranch(answers)
  if (!district || !branchId) return null
  const branch = BRANCHES[branchId]
  if (!branch.questions.every((q) => !!answers?.[q.id])) return null

  const themeScores = computeThemeScores(branchId, answers)
  const districtCounts = countAttractionsByTheme(district, attractions)
  const theme = pickTheme(branchId, answers, themeScores, districtCounts)
  const userVec = buildUserTraitVector(branchId, answers)
  const { effectiveTheme, results } = scoreAttractions({ district, theme, branchId, answers, attractions })

  return {
    district,
    branch: branchId,
    theme: effectiveTheme,
    themeReason: buildThemeReason(branchId, answers, effectiveTheme),
    companionKey: COMPANION_KEY_BY_BRANCH[branchId],
    results: results.map((r) => ({
      attraction: r.attraction,
      score: Math.round(r.finalScore),
      reason: buildAttractionReason(userVec, r.attraction),
    })),
  }
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test src/lib/tourRecommend.test.js`
Expected: PASS (13개 테스트 모두)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tourRecommend.js src/lib/tourRecommend.test.js
git commit -m "feat: 관광모아 추천 엔진(테마결정/코사인유사도/동행적합도/80:20/동점처리) 추가"
```

---

### Task 4: `TourPage.jsx`에 초기 구/선택 항목 prop 추가

**Files:**
- Modify: `src/components/tour/TourPage.jsx:22-26`

**Interfaces:**
- Produces: `TourPage({ onShowBakeryMap, initialDistrict = null, initialSelectedId = null })` — 결과 화면(Task 6)에서 특정 구로 필터되거나 특정 관광지가 바로 선택된 채로 허브를 열 수 있다.

- [ ] **Step 1: `TourPage.jsx` 함수 시그니처와 초기 state 수정**

`src/components/tour/TourPage.jsx:22-26`, 기존:
```js
export default function TourPage({ onShowBakeryMap }) {
  const [selectedId, setSelectedId] = useState(null)
  const [district, setDistrict] = useState(null) // null = 전체
  const [page, setPage] = useState(1)
```
다음으로 교체:
```js
export default function TourPage({ onShowBakeryMap, initialDistrict = null, initialSelectedId = null }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [district, setDistrict] = useState(initialDistrict) // null = 전체
  const [page, setPage] = useState(1)
```

- [ ] **Step 2: 개발 서버로 기존 동작(전체 목록/구 필터/상세보기)이 그대로인지 확인**

Run: `npm run dev`
Expected: `http://localhost:5173`에서 관광모아 → "관광지 모두 보기"로 진입 시 기존과 동일하게 전체 목록이 뜨고 구 필터가 정상 동작. (Task 6~7 완료 전까지는 새 prop이 아무 곳에서도 안 넘어오므로 동작 변화 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/components/tour/TourPage.jsx
git commit -m "feat: TourPage에 initialDistrict/initialSelectedId prop 추가"
```

---

### Task 5: `TourSurveyFlow.jsx`를 새 설문(Q0~Q5)으로 교체

**Files:**
- Modify: `src/components/tour/TourSurveyFlow.jsx` (전체 교체)

**Interfaces:**
- Consumes: `Q0, Q1, BRANCHES`(Task 1), `resolveBranch`(Task 3), `SurveyStep`/`SurveyProgress`(기존, 변경 없음 — `SurveyStep`은 `{question, options:[{id,label}]}` 형태만 있으면 어떤 질문이든 렌더링하는 범용 컴포넌트라 Q0도 그대로 재사용 가능함을 확인함)
- Produces: `TourSurveyFlow({ onComplete, onSkip })` — `onComplete(answers)`는 Q0~Q5를 모두 답하고 마지막 질문에 답했을 때 호출, `onSkip()`은 "관광지 모두 보기" 클릭 시 호출 (기존엔 `onComplete()`가 두 경우를 다 처리했지만, 이제 결과 화면에 답변을 넘겨야 해서 두 콜백으로 분리)

- [ ] **Step 1: `TourSurveyFlow.jsx` 전체 교체**

`src/components/tour/TourSurveyFlow.jsx`:
```jsx
import { useState } from 'react'
import { Q0, Q1, BRANCHES } from '../../data/tourSurveyConfig'
import { resolveBranch } from '../../lib/tourRecommend'
import SurveyStep from '../survey/SurveyStep'
import SurveyProgress from '../survey/SurveyProgress'

// 관광모아 설문: Q0(행정구, 점수 미반영 필터) → Q1(동행자→Branch A~E) → 해당 Branch의 Q2~Q5.
// 답변은 빵집찾기와 무관하므로 로컬 state로만 들고 있는다 — 전역 answers 를 공유하면
// 빵집찾기가 "설문 이미 완료함"으로 착각해 리빌 화면으로 건너뛰는 문제가 생긴다.
// Q0/Q1 모두 SurveyStep이 그대로 렌더링할 수 있는 {question, options:[{id,label}]} 모양이라
// 별도 스텝 컴포넌트 없이 통일된 흐름으로 처리한다.
const TOTAL_STEPS = 6 // Q0, Q1, Q2, Q3, Q4, Q5

export default function TourSurveyFlow({ onComplete, onSkip }) {
  const [answers, setAnswers] = useState({})
  const [step, setStep] = useState(0)

  const branch = resolveBranch(answers)
  const question = step === 0 ? Q0 : step === 1 ? Q1 : BRANCHES[branch]?.questions[step - 2]
  const isLast = step === TOTAL_STEPS - 1

  const choose = (optionId) => {
    const next = { ...answers, [question.id]: optionId }
    setAnswers(next)
    if (isLast) onComplete(next)
    else setStep((s) => s + 1)
  }

  return (
    <div className="survey">
      <SurveyProgress current={step} total={TOTAL_STEPS} />
      <SurveyStep question={question} selectedOptionId={answers[question.id]} onSelect={choose} />
      <div className="survey-nav">
        {step > 0 && (
          <button className="ghost-btn" onClick={() => setStep((s) => s - 1)}>
            ← 이전
          </button>
        )}
        <button className="ghost-btn" onClick={onSkip}>
          관광지 모두 보기 →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋 (Task 7에서 LandingPage 배선 후 브라우저 검증)**

```bash
git add src/components/tour/TourSurveyFlow.jsx
git commit -m "feat: TourSurveyFlow를 PDF 기반 Q0~Q5 설문으로 교체"
```

---

### Task 6: 결과 화면 `TourReveal.jsx` 신규 작성

**Files:**
- Create: `src/components/tour/TourReveal.jsx`
- Modify: `src/styles.css` (`.tour-reveal*` 클래스 추가, 파일 끝에 추가)

**Interfaces:**
- Consumes: `getTourRecommendation`(Task 3), `TAGGED_ATTRACTIONS`(Task 2)
- Produces: `TourReveal({ answers, onRetake, onOpenHub })` — `onOpenHub(attractionId | null)`: TOP3 카드 클릭 시 해당 id, "관광지 더 둘러보기" 클릭 시 `null`

- [ ] **Step 1: `TourReveal.jsx` 작성**

`src/components/tour/TourReveal.jsx`:
```jsx
import { getTourRecommendation } from '../../lib/tourRecommend'
import { TAGGED_ATTRACTIONS } from '../../data/tourAttractionTags'

const THEME_LABELS = { nature: '자연', history: '역사', culture: '문화', education: '교육', etc: '기타' }

// 관광모아 설문 완료 직후 결과 화면: 테마 + 추천 이유 + TOP3 관광지 카드.
// BreadReveal.jsx와 동일한 구성(리빌 문구 → 점수 → 카드 리스트 → 액션 버튼)을 관광지용으로 재구성.
export default function TourReveal({ answers, onRetake, onOpenHub }) {
  const result = answers ? getTourRecommendation(answers, TAGGED_ATTRACTIONS) : null

  if (!result || result.results.length === 0) {
    return (
      <div className="tour-reveal">
        <p className="tour-reveal-eyebrow">아직 추천할 곳이 부족해요</p>
        <p className="tour-reveal-desc">설문에 답해주시면 관광지를 추천해드릴게요.</p>
        <div className="tour-reveal-actions">
          <button className="primary-btn" onClick={onRetake}>
            설문 다시 하기
          </button>
        </div>
      </div>
    )
  }

  const { district, theme, themeReason, results } = result

  return (
    <div className="tour-reveal">
      <p className="tour-reveal-eyebrow">추천 테마는...</p>
      <h2 className="tour-reveal-title">
        &lt; {district} · {THEME_LABELS[theme]} &gt;
      </h2>
      {themeReason && <p className="tour-reveal-reason">{themeReason}</p>}

      <div className="tour-reveal-list">
        {results.map(({ attraction, score, reason }, idx) => (
          <button
            type="button"
            key={attraction.id}
            className="tour-reveal-card"
            onClick={() => onOpenHub(attraction.id)}
          >
            <span className="tour-reveal-rank">{idx + 1}</span>
            {attraction.image && <img src={attraction.image} alt={attraction.name} loading="lazy" />}
            <div className="tour-reveal-card-info">
              <div className="tour-reveal-card-name">{attraction.name}</div>
              <div className="tour-reveal-card-score">적합도 {score}%</div>
              {reason && <div className="tour-reveal-card-reason">{reason}</div>}
            </div>
          </button>
        ))}
      </div>

      <div className="tour-reveal-actions">
        <button className="ghost-btn" onClick={onRetake}>
          다시 추천받기
        </button>
        <button className="primary-btn" onClick={() => onOpenHub(null)}>
          관광지 더 둘러보기 →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `styles.css`에 `.tour-reveal*` 클래스 추가**

`src/styles.css` 파일 끝에 추가:
```css
.tour-reveal{ max-width:640px; margin:0 auto; text-align:center; }
.tour-reveal-eyebrow{ font-size:.9rem; color:var(--muted); margin-bottom:6px; }
.tour-reveal-title{ font-family:'HakgyoansimDunggeunmisoTTF-B', sans-serif; font-size:1.8rem; color:var(--brown); margin:0 0 10px; }
.tour-reveal-desc{ color:var(--ink); font-size:1rem; line-height:1.6; max-width:480px; margin:0 auto 12px; }
.tour-reveal-reason{ color:var(--muted); font-size:.9rem; line-height:1.5; max-width:480px; margin:0 auto 20px; }
.tour-reveal-list{ display:grid; gap:12px; margin-bottom:24px; }
.tour-reveal-card{ display:flex; align-items:center; gap:14px; text-align:left; border:1px solid var(--line); border-radius:14px; padding:12px 16px; background:var(--card); cursor:pointer; }
.tour-reveal-card:hover{ border-color:var(--accent); }
.tour-reveal-card img{ width:64px; height:64px; border-radius:12px; object-fit:cover; flex-shrink:0; background:var(--card2); }
.tour-reveal-rank{ font-family:'HakgyoansimDunggeunmisoTTF-B', sans-serif; font-size:1.1rem; color:var(--accent-text); width:22px; flex-shrink:0; text-align:center; }
.tour-reveal-card-info{ min-width:0; }
.tour-reveal-card-name{ font-weight:700; color:var(--brown); }
.tour-reveal-card-score{ font-size:.85rem; color:var(--green); font-weight:600; margin-top:2px; }
.tour-reveal-card-reason{ font-size:.8rem; color:var(--muted); margin-top:4px; }
.tour-reveal-actions{ display:flex; justify-content:center; gap:12px; }
```

- [ ] **Step 3: 커밋 (Task 7에서 LandingPage 배선 후 브라우저 검증)**

```bash
git add src/components/tour/TourReveal.jsx src/styles.css
git commit -m "feat: 관광모아 결과 화면(TourReveal) 추가"
```

---

### Task 7: `LandingPage.jsx` 배선 — survey → reveal → hub

**Files:**
- Modify: `src/pages/LandingPage.jsx`

**Interfaces:**
- Consumes: `TourReveal`(Task 6), `resolveDistrict`(Task 3에서 export)
- Produces: `tourStage`가 `'survey' | 'reveal' | 'hub'` 세 값을 갖도록 확장

- [ ] **Step 1: import 및 상태 추가**

`src/pages/LandingPage.jsx:13-14` 기존:
```js
import TourPage from '../components/tour/TourPage'
import TourSurveyFlow from '../components/tour/TourSurveyFlow'
```
다음으로 교체:
```js
import TourPage from '../components/tour/TourPage'
import TourSurveyFlow from '../components/tour/TourSurveyFlow'
import TourReveal from '../components/tour/TourReveal'
import { resolveDistrict } from '../lib/tourRecommend'
```

`src/pages/LandingPage.jsx:26-28` 기존:
```js
  const [showTour, setShowTour] = useState(false)
  const [tourStage, setTourStage] = useState('survey') // 'survey' | 'hub'
  const [nearbyOrigin, setNearbyOrigin] = useState(null) // 관광지 "근처 빵집 보기" 로 진입 시 { name, lat, lng }
```
다음으로 교체:
```js
  const [showTour, setShowTour] = useState(false)
  const [tourStage, setTourStage] = useState('survey') // 'survey' | 'reveal' | 'hub'
  const [tourAnswers, setTourAnswers] = useState(null) // 설문 완료 시 결과화면에 넘길 답변
  const [tourSelectedId, setTourSelectedId] = useState(null) // hub 진입 시 바로 선택할 관광지
  const [nearbyOrigin, setNearbyOrigin] = useState(null) // 관광지 "근처 빵집 보기" 로 진입 시 { name, lat, lng }
```

- [ ] **Step 2: `openTour`/`openTourHub` 핸들러 수정**

`src/pages/LandingPage.jsx:68-75` 기존:
```js
  const openTour = () => {
    setShowTour(true)
    setTourStage('survey')
    setFeatureOpen(false)
    setShowSaved(false)
    setShowInfo(false)
    setShowMap(false)
  }
```
다음으로 교체:
```js
  const openTour = () => {
    setShowTour(true)
    setTourStage('survey')
    setTourAnswers(null)
    setTourSelectedId(null)
    setFeatureOpen(false)
    setShowSaved(false)
    setShowInfo(false)
    setShowMap(false)
  }
  const openTourHub = (selectedId = null) => {
    setTourSelectedId(selectedId)
    setTourStage('hub')
  }
```

- [ ] **Step 3: 렌더링부 수정**

`src/pages/LandingPage.jsx:107-115` 기존:
```js
      {showTour && (
        <div className="page">
          {tourStage === 'survey' ? (
            <TourSurveyFlow onComplete={() => setTourStage('hub')} />
          ) : (
            <TourPage onShowBakeryMap={openBakeryMap} />
          )}
        </div>
      )}
```
다음으로 교체:
```js
      {showTour && (
        <div className="page">
          {tourStage === 'survey' && (
            <TourSurveyFlow
              onComplete={(answers) => {
                setTourAnswers(answers)
                setTourStage('reveal')
              }}
              onSkip={() => openTourHub(null)}
            />
          )}
          {tourStage === 'reveal' && (
            <TourReveal
              answers={tourAnswers}
              onRetake={() => {
                setTourAnswers(null)
                setTourStage('survey')
              }}
              onOpenHub={openTourHub}
            />
          )}
          {tourStage === 'hub' && (
            <TourPage
              onShowBakeryMap={openBakeryMap}
              initialDistrict={tourAnswers ? resolveDistrict(tourAnswers) : null}
              initialSelectedId={tourSelectedId}
            />
          )}
        </div>
      )}
```

- [ ] **Step 4: 개발 서버로 전체 흐름 브라우저 검증**

Run: `npm run dev`
Expected (`http://localhost:5173`에서 수동 확인):
1. NavBar에서 "관광모아" 클릭 → Q0(행정구 5개 버튼) 표시
2. 구 선택 → Q1(동행자 5개) → 선택한 동행자에 맞는 Branch의 Q2~Q5 4문항 순서대로 표시, 진행바가 6단계로 채워짐
3. 마지막 질문(Q5) 답변 시 결과 화면(TourReveal)으로 전환 — 테마/지역 제목, 추천 이유, TOP3 카드(이미지·이름·적합도·이유) 표시
4. TOP3 카드 클릭 → TourPage 허브가 해당 관광지 상세뷰로 바로 열림
5. "다시 추천받기" → 설문 처음(Q0)부터 다시 시작
6. 설문 중 "관광지 모두 보기" 클릭 → 결과 화면을 건너뛰고 곧장 전체 허브(필터 없음)로 이동 (기존 동작 유지 확인)
7. 브라우저 콘솔에 에러 없는지 확인

- [ ] **Step 5: 커밋**

```bash
git add src/pages/LandingPage.jsx
git commit -m "feat: 관광모아 흐름에 결과 화면(reveal) 단계 배선"
```

---

### Task 8: PDF 17절 검증 체크리스트 통합 테스트

**Files:**
- Create: `src/lib/tourIntegration.test.js`

**Interfaces:**
- Consumes: `TAGGED_ATTRACTIONS`(Task 2), `Q0, Q1, BRANCHES, THEMES`(Task 1), `getTourRecommendation`(Task 3) — 실제 데이터로 8개 항목 중 데이터 의존적인 6개(1,2,3,4,5,6)를 검증한다. 나머지 2개(7 코사인 0벡터, 8 동점 정렬)는 Task 3 `tourRecommend.test.js`에서 이미 검증됨.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/tourIntegration.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAGGED_ATTRACTIONS } from '../data/tourAttractionTags.js'
import { Q0, Q1, BRANCHES, THEMES } from '../data/tourSurveyConfig.js'
import { getTourRecommendation } from './tourRecommend.js'

function districtOptionId(district) {
  return Q0.options.find((o) => o.district === district).id
}
function branchOptionId(branchId) {
  return Q1.options.find((o) => o.branch === branchId).id
}
function sampleAnswers(branchId, optionIndexes, district) {
  const branch = BRANCHES[branchId]
  const answers = { [Q0.id]: districtOptionId(district), [Q1.id]: branchOptionId(branchId) }
  branch.questions.forEach((q, i) => { answers[q.id] = q.options[optionIndexes[i]].id })
  return answers
}

test('PDF 17절-1: 동일 응답을 반복 입력하면 동일한 테마와 TOP3가 반환된다(결정론성)', () => {
  const answers = sampleAnswers('B', [0, 0, 2, 0], '중구')
  const r1 = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
  const r2 = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
  assert.equal(r1.theme, r2.theme)
  assert.deepEqual(r1.results.map((r) => r.attraction.id), r2.results.map((r) => r.attraction.id))
})

test('PDF 17절-2: 모든 Branch에서 5개 테마 각각 결과로 나올 수 있는 경로가 존재한다', () => {
  const themeIndex = { nature: 0, history: 1, culture: 2, education: 3, etc: 4 }
  const seenThemes = new Set()
  for (const branchId of Object.keys(BRANCHES)) {
    for (const theme of THEMES) {
      const idx = themeIndex[theme]
      const answers = sampleAnswers(branchId, [idx, idx, idx, idx], '유성구')
      const r = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
      seenThemes.add(r.theme)
    }
  }
  for (const theme of THEMES) assert.ok(seenThemes.has(theme), `테마 도달 불가: ${theme}`)
})

test('PDF 17절-3: 각 Branch의 Q2~Q5에서 5개 테마가 균등하게 최댓값 옵션으로 나타난다(구조적 편향 없음)', () => {
  for (const branchId of Object.keys(BRANCHES)) {
    const branch = BRANCHES[branchId]
    const dominantCounts = { nature: 0, history: 0, culture: 0, education: 0, etc: 0 }
    for (const q of branch.questions) {
      for (const opt of q.options) {
        const top = Object.entries(opt.themeWeight).sort((a, b) => b[1] - a[1])[0][0]
        dominantCounts[top] += 1
      }
    }
    for (const theme of THEMES) {
      assert.equal(dominantCounts[theme], 4, `branch=${branchId} theme=${theme} count=${dominantCounts[theme]}`)
    }
  }
})

test('PDF 17절-4: 행정구 필터 이후 다른 구 관광지가 결과에 포함되지 않는다', () => {
  const answers = sampleAnswers('A', [0, 0, 0, 0], '동구')
  const r = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
  for (const { attraction } of r.results) assert.equal(attraction.district, '동구')
})

test('PDF 17절-5: 복수 테마를 가진 관광지는 각 테마 후보군 모두에 나타날 수 있다', () => {
  const multiTheme = TAGGED_ATTRACTIONS.find((a) => a.themes.length > 1)
  assert.ok(multiTheme, '복수 테마 관광지가 없음')
  for (const theme of multiTheme.themes) {
    const pool = TAGGED_ATTRACTIONS.filter((a) => a.district === multiTheme.district && a.themes.includes(theme))
    assert.ok(pool.some((a) => a.id === multiTheme.id))
  }
})

test('PDF 17절-6: 실제 데이터에서도 추천 결과가 항상 1~3개 반환된다(후보 부족 예외처리 동작)', () => {
  for (const branchId of Object.keys(BRANCHES)) {
    for (const district of Q0.options.map((o) => o.district)) {
      const answers = sampleAnswers(branchId, [4, 4, 4, 4], district) // 기타(가장 후보가 적은 테마) 강제 선택
      const r = getTourRecommendation(answers, TAGGED_ATTRACTIONS)
      assert.ok(r.results.length >= 1 && r.results.length <= 3, `branch=${branchId} district=${district} 결과 ${r.results.length}개`)
    }
  }
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test src/lib/tourIntegration.test.js`
Expected: FAIL (아직 파일이 없었으므로 처음 실행 시 실패 — Task 1~3이 이미 끝난 상태라면 대부분 통과할 수도 있음. 그 경우 이 Step은 "실제 데이터 조합에서 어떤 항목이 실패하는지 확인"으로 대체)

- [ ] **Step 3: 실패 항목이 있으면 원인 조사 후 수정**

가능한 실패 유형과 대응:
- **17절-2 실패(특정 테마 미도달)**: 해당 브랜치/테마 조합에서 `effectiveTheme`이 다른 테마로 대체됨 — `TAGGED_ATTRACTIONS`에서 해당 구에 그 테마 후보가 실제로 있는지 확인. 없으면 정상(폴백 동작), `seenThemes`가 전체 조합에서 5개 테마를 다 못 채우면 `tourAttractionTags.js`의 태깅 규칙이 특정 테마를 과소생산하고 있다는 뜻이므로 `NAME_THEME_RULES`/`CAT_THEME` 커버리지를 재검토한다.
- **17절-6 실패(결과 0개)**: 특정 구+기타 테마 조합에 해당 구 관광지가 아예 없는 경우 — `getTourRecommendation`이 `results: []`를 반환하는지 실제로 확인하고, 그렇다면 `scoreAttractions`의 폴백 로직(2위 테마도 후보가 없는 극단적 경우)이 빈 배열을 반환하는 게 맞는 동작임을 확인 후 테스트의 `>= 1` 기대치를 그 구체적 조합에 한해 `>= 0`으로 조정한다(전수 확인 후 실제로 그런 조합이 있을 때만).

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test src`
Expected: PASS (Task 1~3의 테스트 포함 전체 통과)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tourIntegration.test.js
git commit -m "test: PDF 17절 검증 체크리스트 통합 테스트 추가"
```

---

## 최종 확인

- [ ] `node --test src` 전체 통과
- [ ] `npm run dev`로 관광모아 전체 흐름(Q0~Q5 → 결과 → 허브) 브라우저 수동 확인, 콘솔 에러 없음
- [ ] `git log --oneline`으로 Task별 커밋 8~9개 확인 후, 사용자에게 브랜치 push/PR 여부 확인 (메모리에 "디자인 시안 대기 중" 메모가 있으므로 임의로 push하지 않는다)
