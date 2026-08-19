# [CP6 보고서] 마이페이지 신설 + 랜딩 메인 히어로 시안 반영

**날짜:** 2026-08-18 ~ 2026-08-19
**관련 이슈:** #20 ([FE] 마이페이지 신설 — 찜한 빵/코스, 기록장, 친구목록 자리)
**브랜치:** `feature-mypage`
**PR:** #21 (develop 대상)
**상태:** 🟢 기능 구현 + 테스트 완료, push 완료, 코드리뷰 대기 중

---

## 요약

이슈 #20은 두 단계로 진행됐다.

1. **마이페이지 신설(2026-08-18~19)** — 이슈 원문 범위. "나만의 리스트"(찜한 빵집만 보여주던 화면)를 프로필 카드 + 찜한 빵/찜한 코스/기록장/친구목록 4개 패널을 가진 "마이페이지"로 확장.
2. **랜딩 메인 히어로 시안 반영(2026-08-19)** — 별도 TODO(랜딩페이지 시안 반영, 미착수 상태였음)였으나, 사용자가 같은 브랜치에서 이어서 진행하도록 지시해 동일 브랜치에 포함했다. 이슈 #20에 범위 추가 코멘트를 남겼다.

## 1단계 — 마이페이지 신설 (요약)

superpowers:brainstorming(아키텍처 설계) → writing-plans(Task 1~8 계획) → subagent-driven-development로 태스크별 구현+리뷰+fix loop, 최종 전체 브랜치 리뷰까지 통과 후 커밋.

### 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/pages/MyPage.jsx` *(신규)* | 마이페이지 뼈대 — 프로필 카드 + 4개 패널 라우팅 |
| `src/components/mypage/ProfileCard.jsx` *(신규)* | 아바타 placeholder + 닉네임 편집 |
| `src/components/mypage/SavedBakeriesPanel.jsx` *(신규)* | 찜한 빵 목록 — 기존 `useSavedBakeries` 재사용 |
| `src/components/mypage/SavedCoursesPanel.jsx`, `SavedCourseMap.jsx` *(신규)* | 찜한 코스 목록 — `saved_courses` read 화면 신규(기존엔 insert만 있었음) + 지도 상세 |
| `src/components/mypage/DiaryPanel.jsx`, `DiaryEntryModal.jsx` *(신규)* | 기록장 — 신규 `diary_entries` 테이블(RLS) 기반 목록/작성/수정/삭제 |
| `src/hooks/useDiaryEntries.js`, `useSavedCourses.js` *(신규)* | 기록장/찜한 코스 데이터 훅 |
| `src/components/map/RecommendCard.jsx` | 빵집 상세 카드에 "기록 남기기" 버튼 추가 |
| `src/hooks/useAuth.js` | `updateNickname` 추가 |
| `src/lib/displayName.js`, `courseLabel.js` *(신규)* | 표시 이름 우선순위(nickname > full_name > name > email), 코스 라벨 포맷 순수 함수 |
| `src/components/auth/AuthMenu.jsx`, `src/components/landing/NavBar.jsx` | "나만의 리스트" → "마이페이지" 전환, 표시 이름 통일 적용 |
| `src/pages/SavedListPage.jsx` *(삭제)* | 마이페이지로 대체되어 제거 |
| `supabase/schema.sql` | `diary_entries` 테이블 스키마 추가 |

### 테스트

`npm test`(Node 내장 테스트러너) 49개 통과 — `getDisplayName`(6), `formatCourseLabel`(3) 등 순수 함수 유닛 테스트 + 기존 tourRecommend 계열 테스트.

### 후속 이슈로 남긴 것 (범위 제외 확정)

- 신규 Supabase 호출 6곳 중 기록장 저장 실패만 화면에 에러 메시지를 띄우도록 처리함. 나머지(찜한 코스 조회/삭제, 닉네임 변경 등)는 아직 console.error만 남기므로, 화면 에러 메시지 추가는 별도 이슈 필요.
- 친구 시스템 실제 로직(카톡/친구코드) — 탭 자리만 존재.
- 기록장 사진 첨부 — Storage 버킷 구성 필요, 범위 제외.

## 2단계 — 랜딩 메인 히어로 시안 반영 (이번 세션 핵심 작업)

사용자가 시안 SVG 3개(`대전 렌딩페이지.svg`, `대전 빵 일러스트.svg`, `대전1.svg`)와 전체 서비스 목업 PDF(`대전 웹사이트 4.pdf`)를 전달. 브라우저로 각 SVG를 직접 열어 확인한 결과:

- `대전 렌딩페이지.svg` — 오렌지 웨이브 배경 + 지도/타워/빵집 건물/빵 일러스트가 합쳐진, 랜딩 히어로에 바로 쓸 수 있는 완성된 그래픽. **이번에 실제로 사용.**
- `대전1.svg` — 컬러 팔레트/아이콘/로고와 위 히어로 그래픽이 함께 있는 브랜드 스타일 가이드 시트(참고용, 미사용).
- `대전 빵 일러스트.svg` — 빵 종류 아이콘 20개 세트(카드용, 히어로와 무관, 미사용).

### 변경 사항

- **레이아웃**: `MainHero`를 시안(PDF 1p) 그대로 좌측 정렬 헤드라인/서브카피/검색창/CTA 2개 구성으로 재구성하고, `대전 렌딩페이지.svg`를 화면 전체 폭 일러스트로 배치(`src/assets/landing-hero-illustration.svg`).
- **검색 기능**: "빵집을 검색해보세요" 입력 후 제출 → 빵 지도로 이동하며 실제 이름 부분 일치 필터링. `BakeryMapPage`에 `initialSearch` prop 추가, `LandingPage`에 `mapSearch` 상태 + `searchBakeryMap` 핸들러 추가.
- **버그 수정**: "빵 지도 보기" 버튼이 기존엔 실수로 설문 시작(`onStart`)에 연결돼 있던 것을 실제 빵 지도로 이동하도록 수정(`onOpenMap` prop 추가).
- **죽은 코드 정리**: 시안에 없는 "사진으로 미리 만나보는 대전" 섹션을 `LandingPage`에서 제거하고, 더 이상 어디서도 안 쓰이는 `PhotoShowcase.jsx`/`CultureCarousel.jsx`와 전용 CSS를 삭제.
- **스크롤 잠금**: 메인 홈 화면에서는 마우스 휠/터치 스크롤이 필요 없도록 막음(다른 화면 진입 시 자동 복원). CSS `overflow:hidden`만으로는 실제 휠 스크롤이 안 막혀서, `wheel`/`touchmove` 이벤트에 `preventDefault()`를 거는 방식으로 구현(`LandingPage.jsx` useEffect).
- **컬러 팔레트**: 시안 팔레트로 바꾸지 않고 기존 `--bm-*` CSS 변수 그대로 유지(사용자 명시적 지시).

### 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/assets/landing-hero-illustration.svg` *(신규)* | 시안 원본 SVG(`대전 렌딩페이지.svg`) |
| `src/components/landing/MainHero.jsx` | 좌측 정렬 카피+검색창+CTA 2개 + 전체 폭 일러스트로 재구성 |
| `src/components/map/BakeryMapPage.jsx` | `initialSearch` prop, 이름 부분 일치 필터링, 검색 결과 헤더/빈 상태 문구 |
| `src/pages/LandingPage.jsx` | `mapSearch`/`searchBakeryMap` 추가, `MainHero`에 `onOpenMap`/`onSearch` 연결, PhotoShowcase 제거, 홈 화면 스크롤 잠금 useEffect |
| `src/styles.css` | `.bm-mhero*` 재구성, `.bm-showcase`/`.bm-culture*` 삭제 |
| `src/components/landing/PhotoShowcase.jsx`, `CultureCarousel.jsx` *(삭제)* | 더 이상 사용되지 않음 |

### 조사 중 발견한 것

같은 작업(랜딩 히어로 시안 반영)을 이전 세션에서 이미 한 번 시도했다가 8분 만에 되돌린 커밋을 발견했다(`73893bf` → `6ab58b9`, 2026-08-18 21:41~21:48). 당시엔 손그림 SVG로 만든 임시 일러스트를 썼고, 동시에 사이트 전체 컬러 팔레트(`--bm-accent` 등)까지 갈아엎어 다른 화면과 톤이 깨졌던 것이 되돌린 원인으로 추정된다. 이번엔 (1) 사용자가 전달한 실제 시안 SVG를 사용하고 (2) 팔레트는 손대지 않는 방식으로 재작업해 같은 문제를 피했다.

### 검증

- `npm test` 49/49 통과(마이페이지 단계와 동일 스위트, 회귀 없음).
- 브라우저(dev 서버)로 직접 확인: 일러스트 렌더링, 검색 기능(실제 API 데이터로 "성심당" 검색 → 10곳), "빵 지도 보기" 버튼(272곳 전체 지도로 이동), 스크롤 잠금(실제 `WheelEvent` 디스패치로 `defaultPrevented:true` 확인), 다른 화면 진입 시 스크롤 정상 복원.
- 콘솔 에러 없음(마이페이지 단계의 기존 이슈인 "찜한 코스 조회 실패" 1건 제외 — 무관, 위 후속 이슈 항목 참고).

## 자가 점검

- **범위**: 랜딩 히어로 작업은 이슈 #20 원문 범위가 아니었으나, 사용자가 같은 브랜치에서 이어서 진행하도록 명시적으로 지시했다. 이슈 #20에 범위 추가 코멘트를, PR #21 본문에 별도 섹션을 남겨 반영했다.
- **일러스트 배치**는 사용자 피드백을 여러 차례 반영하며 조정했다(전체 화면 크기 → 양옆 잘림 수정 → 스크롤 잠금 → 위치 미세조정). 최종 상태는 시안의 좌측 카피/우측 없이-전체폭 하단 일러스트 구성을 그대로 따른다.
- **디자인 스타일 가이드**(`대전1.svg`)의 컬러 팔레트·아이콘·로고는 이번 범위에서 미적용 — 필요 시 별도 이슈에서 검토.

## 다음 단계

1. `docs/superpowers/`(브레인스토밍/계획 임시 산출물)는 이 보고서로 대체되어 제거함.
2. PR #21에 push 완료, `Closes #20`.
3. 팀 코드리뷰 → 반영 → 본인이 merge.
4. 후속 이슈: 화면 에러 메시지 반영(찜한 코스 조회/삭제, 닉네임 변경 등), 친구 시스템 실제 로직, 기록장 사진 첨부, 브랜드 스타일 가이드(팔레트/아이콘) 반영 여부 결정.
