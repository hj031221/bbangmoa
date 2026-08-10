# 관광모아 추천 로직 설계 (이슈 #14 후속)

원본 스펙: `대전 관광지 추천 트리형+가중치 로직 찐최종본.pdf` (기획팀 전달, 2026-08-10)

## 배경

현재 `TourSurveyFlow.jsx`는 빵집찾기 설문(`Q1`+`BRANCHES`, 빵 취향 로직)을 그대로 복사한 임시 버전이다. 코드 주석에 명시된 대로 "기획팀의 관광지 취향 로직이 오기 전까지"의 자리채움이었고, 이번 PDF로 그 로직이 도착했다. `daejeonTour.json`(186곳, 이미지 있는 173곳만 실제 사용)에는 추천에 필요한 `themes`/`traits`/`companion` 필드가 전혀 없어 새로 생성해야 한다.

## 1. 아키텍처

| 파일 | 상태 | 역할 |
|---|---|---|
| `src/data/tourSurveyConfig.js` | 신규 | Q0(행정구, 점수 미반영) + Q1(동행자→Branch A~E) + Branch별 Q2~Q5(테마 가중치+11태그), PDF 2~8절 원문 이식 |
| `src/data/tourAttractionTags.js` | 신규 | `daejeonTour.json` 186곳에 규칙 기반으로 `themes[]`/`traits{11}`/`companion{5}` 부여, 모듈 로드 시 1회 계산 |
| `src/lib/tourRecommend.js` | 신규 | 테마 결정, 코사인 유사도, 동행 적합도, 80:20 최종점수, 동점처리, 후보부족 폴백, 추천이유 생성 (PDF 4·7·9·10·15절) |
| `src/components/tour/TourSurveyFlow.jsx` | 수정 | `LocationStep`(GPS 출발지, 관광 기능에서 실제 미사용) → Q0(행정구 선택) 스텝으로 교체 |
| `src/components/tour/TourReveal.jsx` | 신규 | `BreadReveal.jsx`를 본뜬 결과 화면: 테마+추천이유+TOP3 카드 |
| `src/pages/LandingPage.jsx` | 수정 | `tourStage`에 `'reveal'` 추가: `survey → reveal → hub` |

답변 저장은 기존과 동일하게 로컬 state (빵집찾기 전역 스토어와 분리 원칙 유지, `TourSurveyFlow.jsx` 상단 주석 참고).

## 2. 설문 구조 (`tourSurveyConfig.js`)

PDF 3~8절을 그대로 데이터화한다:
- `Q0`: 행정구 5지선다(동/중/서/유성/대덕구) — 점수 미반영, 후보군 필터 전용
- `Q1`: 동행자 5지선다 → `branch: 'A'|'B'|'C'|'D'|'E'` (혼자/연인/친구/아이가족/부모님가족)
- `BRANCHES[branch].questions`: Q2~Q5 각 5지선다, 옵션마다 `themeWeight: {자연,역사,문화,교육,기타}` + `traits: {11개 태그 중 언급된 것만, 0~5}`

빵집찾기 `surveyConfig.js`와 동일한 형태(id 네이밍에 브랜치 접두사)를 따르되, 필드명이 `fitness`(빵 후보별 적합도) 대신 `themeWeight`+`traits`인 점이 다르다 — 관광지 후보군이 구+테마로 정해지기 전까지는 특정 후보를 알 수 없기 때문에, 빵집찾기처럼 "후보별 점수표"가 아니라 "테마 점수 + 사용자 태그 벡터"를 먼저 만드는 구조다.

## 3. 데이터 자동 태깅 (`tourAttractionTags.js`)

### 3.1 테마 매핑
1순위: KTO `cat` 코드(186곳 중 106곳에 존재, 실제 데이터 조사로 27종 코드 확인) → 테마 매핑 테이블
   - `A01*`(자연관광지 전체), `A0202*`(공원류) → 자연
   - `A0201*`(사적·서원·사찰·향교·현충원둘레길) → 역사
   - `A0203*`(체험관광지) → 기본 기타, 이름에 교육/과학/발명/학습 포함 시 교육로 재분류
   - `A0206*`(문화시설) 세부 코드별: 박물관·도서관→교육, 기념관·문화원→역사/문화, 미술관·공연장→문화(이름에 "어린이" 포함 시 교육)
   - `A02050200`(건축/조형물) → 문화

2순위: `cat` 없는 71곳(전부 "관광지" type) → 이름 키워드 우선순위 규칙
   - 공원/산/수목원/휴양림/생태/저수지/둘레길 → 자연
   - 사적/유적/사당/종가/현충원 → 역사
   - 미술관/거리/전시 → 문화
   - 박물관/과학관/천문대/연구원 → 교육
   - 그 외(온천·랜드마크·테마파크·이색체험류, 예: 한빛탑·엑스포다리·펫터테인먼트·유성온천공원) → 이름별 예외 테이블로 명시 처리 (10곳 미만 예상)

`themes`는 배열이며 복수 허용(PDF 6·11절). 기본은 단일 테마이되, 공원+기념물처럼 이름에 두 신호가 뚜렷한 경우(예: 국립대전현충원 → 자연+역사)만 예외 테이블로 두 번째 테마를 추가한다. 전수 조합 추론은 하지 않는다.

### 3.2 세부 성향 태그 (11개, 0~5)
PDF Q2~Q5 옵션의 테마별 태그 패턴에서 "테마 전형 프로필"을 역산해 baseline으로 삼는다. PDF 8절에 제공된 실제 예시(대전 치유의 숲, 자연테마)를 자연 baseline으로 그대로 채택:

```
walk:5, rest:5, scenery:5, exploration:3, immersion:2,
appreciation:2, sightseeing:3, experience:2, knowledge:2,
uniqueness:2, activity:3
```

나머지 4개 테마는 PDF 각 Branch의 해당 옵션 패턴(예: 역사=탐방5·몰입4·지식3-4 반복)에서 동일한 방식으로 도출:
- 역사: exploration5, immersion4, knowledge3, 나머지 1
- 문화: appreciation5, sightseeing5, 나머지 1
- 교육: experience5, knowledge5, activity2, 나머지 1
- 기타: uniqueness5, sightseeing3, exploration2, activity3, 나머지 1

이름 키워드로 ±1~2 보정(예: "체험" 포함→experience/uniqueness↑, "전시" 포함→appreciation/sightseeing↑) 후 0~5로 clamp. 태그 전부 0인 벡터는 baseline 최소치 때문에 발생하지 않는다(체크리스트 7번 대응).

### 3.3 동행 적합도 (5개, 0~100)
별도로 손으로 매기지 않고, 이미 계산된 11차원 태그 벡터에서 산출한다. PDF의 각 Branch "해석 포인트" 문장을 그대로 가중치 근거로 사용:
- solo(혼자): rest·immersion 가중 (PDF: "휴식·몰입·개인 관심사")
- couple(연인): scenery·walk·appreciation·experience·uniqueness 가중 (PDF: "경관·산책·감상·체험·이색성")
- friends(친구): activity·sightseeing·experience·uniqueness 가중 (PDF: "활동성·볼거리·체험·이색성")
- childrenFamily(아이가족): activity·experience·knowledge·uniqueness 가중
- parentsFamily(부모님가족): rest·scenery·immersion·appreciation·knowledge·uniqueness 가중 (PDF: "편안함과 경관뿐 아니라 역사적 의미·문화 감상·지식·대전 고유성")

공식 형태: `companion[c] = clamp(round(50 + Σ weight[c][tag] × (traitValue[tag] - 2.5)), 0, 100)`. 정확한 계수는 구현 단계에서 실제 186곳 분포를 보며 0~100 범위가 고르게 나오도록 튜닝한다.

## 4. 추천 엔진 (`tourRecommend.js`)

PDF 4·7·9·10·15절을 그대로 함수화한다:

- `resolveBranch(answers)` — Q1 → Branch id
- `computeThemeScores(branchId, answers)` — Q2~Q5 `themeWeight` 합산 → 5개 테마 점수
- `pickTheme(themeScores, branchId, answers, district)` — 최고점, 동점 시 Q5→Q4→Q3 선택의 주 테마 우선, 그래도 같으면 해당 구 관광지 수가 더 많은 테마 (PDF 7절 동점 처리 순서)
- `buildUserTraitVector(branchId, answers)` — Q2~Q5 `traits` 누적, 11차원
- `cosineSimilarity(userVec, siteVec)` — 성향 일치도 × 100
- `scoreAttractions(district, theme, branchId, answers)`:
  1. 구+테마로 후보 필터 (`themes` 배열에 포함되면 후보, 중복 제거 없음)
  2. `FinalScore = 성향일치도×0.8 + 동행적합도×0.2`
  3. 정렬 + 동점처리(성향일치도 → 동행적합도 → 사용자 최고 세부태그 일치 → contentId)
  4. 후보 0~2개 예외처리 (PDF 10절 표 그대로: 2개→테마 2위에서 같은 구 최고점 1개 보충 / 1개→2개 보충 / 0개→테마 2위로 전환, 구는 유지)
- `buildThemeReason` / `buildAttractionReason` — PDF 15절 문장 생성 규칙 (사용자 상위 태그 2개 ∩ 관광지 상위 태그)

## 5. UI 흐름

```
TourSurveyFlow (Q0 행정구 → Q1 동행자 → Q2~Q5)
  → onComplete → tourStage='reveal'
TourReveal (테마 + 추천이유 + TOP3 카드; 카드 클릭 시 TourPage 상세뷰로 이동)
  → "관광지 더 둘러보기" 버튼 → tourStage='hub' → TourPage (해당 구로 필터된 채 시작)
```

"관광지 모두 보기"(설문 스킵) 버튼은 기존과 동일하게 곧장 hub로 이동(전체, 필터 없음) — 이 동작은 변경하지 않는다.

## 6. 검증

PDF 17절 체크리스트 8개 항목을 `tourRecommend.js`의 단위 테스트로 구현:
1. 동일 응답 → 동일 결과 (결정론성)
2. 모든 Branch에서 5개 테마 모두 도달 가능
3. 특정 테마 과대표 여부 (질문 구조상 편향 없는지)
4. 행정구 필터 정확성
5. 복수 테마 관광지가 각 테마 후보군에 정상 포함
6. 후보 0~2개 예외처리 동작
7. 코사인 유사도 0벡터 방지
8. 동점 시 정렬 안정성

## 범위 밖

- KTO API 실시간 연동(운영시간·전화 등)은 기존 `TourPage.jsx`의 `getDetail` 로직을 그대로 사용, 이번 작업과 무관
- 186곳 태그의 100% 수작업 정확도는 목표하지 않음 — 규칙 기반 자동 생성으로 전체 일관 커버가 목표
