# [CP7 보고서] 마이페이지 UI 개편 — 세로형 미리보기 레이아웃

**날짜:** 2026-08-21
**관련 이슈:** #22 ([FE] 마이페이지 UI 개편 — 빈 공간 최소화한 세로형 레이아웃 적용)
**브랜치:** `feature-mypageui`
**상태:** 🟢 기능 구현 + 테스트 완료, PR 생성 예정

## 요약

CP6에서 만든 마이페이지 홈 화면은 클릭해서 들어가야만 내용이 보이는 2x2 버튼 카드(`.mypage-panel-grid`)였다. 시안(`대전 웹사이트 4.pdf` 11p)처럼 프로필 카드 옆에 찜한 빵/찜한 코스/기록장 패널이 실제 콘텐츠를 세로 리스트로 즉시 보여주는 구조로 교체했다. 친구목록은 4번째 컬럼 자리만 만들고 "준비 중" 상태 유지(#24에서 실기능 구현 예정).

## 변경 사항

### 1. 홈 화면 구조 — 버튼 그리드 → 미리보기 패널

- `SavedBakeriesPreview.jsx`, `SavedCoursesPreview.jsx`, `DiaryPreview.jsx`, `FriendsPreview.jsx` *(신규)* — 기존 `useSavedBakeries`/`useSavedCourses`/`useDiaryEntries` 훅을 그대로 재사용하되, 개수 제한 없이 찜한/저장한/기록한 만큼 세로로 자라는 미리보기 카드. 헤더(골드 배경 + 흰 원형 아이콘 배지 + 제목 + 화살표) 클릭 시 기존 전체 화면 패널(`SavedBakeriesPanel` 등)로 이동.
- `PreviewChevron.jsx` *(신규)* — 헤더 우측 화살표. 빵 지도(`BakeryMapPage`) 뒤로가기 아이콘과 동일한 SVG를 좌우 반전 + 축소해서 재사용.
- `PreviewIcons.jsx` *(신규)* — 헤더 좌측 아이콘 3종(하트/장소 핀/종이, 시안 17p 팔레트 아이콘 기준). 장소 핀은 `MarkerLayer.jsx`의 빵모아 로고 마커(코랄 핀 + 흰 빵 실루엣)와 동일한 벡터를 재사용해 앱 전체와 일치시켰다.
- `MyPage.jsx` — 홈 화면을 `<ProfileCard/>` + `마이페이지 제목/설명` + `<프리뷰 4개>` 구조로 재구성.

### 2. 스타일 — 시안 기준 카드/레이아웃

- `.mypage-panel-grid`/`.mypage-panel-card`(빈 여백 큰 버튼 카드) 제거, `.mypage-preview-*`(골드 헤더 바 + 흰 배경 리스트, `.result-header`/`.tour-detail-header`와 동일 톤) 신규 추가.
- 프로필 카드: 너비 240px → 180px로 좁히고 `min-height:340px`로 세로 길이 확보, 미리보기 그리드는 남는 폭을 4열로 채움.
- 반응형: 1024px 이하 2열, 760px 이하 1열(프로필 카드 `min-height` 해제).
- CSS 그리드 아이템 기본 `min-width:auto` 때문에 긴 빵집 이름이 들어오면 컬럼이 밀려 옆 패널을 덮던 버그를 `min-width:0`으로 수정.

### 3. 빵집 찾기 결과로 찜한 빵 — 빵 종류 표시

`MapResult.jsx`(빵집 찾기 설문 추천 결과 화면)는 추천된 빵 종류(`breadResult.bread`)를 알고 있었지만 찜할 때 그 정보가 유실됐다. 저장되는 bakery 객체에 `breadType`(이름)·`breadTypeEmoji`(`breadCandidates.js` 이모지)를 함께 담도록 수정. 미리보기/전체 목록에서 `breadType`이 있으면 빵 종류 이름 + 해당 빵 이모지 아이콘을 위에, 빵집 이름을 아래에 작게 표시하고, 빵 지도에서 그냥 찜한 경우(필드 없음)는 기존처럼 빵집 이름만 표시한다. `bakery`는 JSON으로 통째 저장되는 구조라 스키마 변경 없이 처리했다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/pages/MyPage.jsx` | 홈 화면을 프로필 카드 + 제목/설명 + 4개 미리보기 패널 구조로 교체 |
| `src/components/mypage/SavedBakeriesPreview.jsx` *(신규)* | 찜한 빵 미리보기 — 빵 종류/아이콘 표시 로직 포함 |
| `src/components/mypage/SavedCoursesPreview.jsx` *(신규)* | 찜한 코스 미리보기 |
| `src/components/mypage/DiaryPreview.jsx` *(신규)* | 기록장 미리보기 |
| `src/components/mypage/FriendsPreview.jsx` *(신규)* | 친구목록 4번째 컬럼 자리표시자("준비 중") |
| `src/components/mypage/PreviewChevron.jsx` *(신규)* | 헤더 화살표 아이콘(빵 지도 뒤로가기 아이콘 재사용) |
| `src/components/mypage/PreviewIcons.jsx` *(신규)* | 헤더 아이콘 3종(하트/장소 핀/종이) |
| `src/components/mypage/SavedBakeriesPanel.jsx` | 전체 목록에도 `breadType` 있으면 빵 종류/빵집 이름 함께 표시 |
| `src/components/mypage/DiaryPanel.jsx` | 날짜 포맷 함수를 `lib/formatDate.js`로 공용화 |
| `src/lib/formatDate.js` *(신규)* | 기록장 날짜 포맷 공용 유틸 |
| `src/components/map/MapResult.jsx` | 찜할 때 `breadType`/`breadTypeEmoji`를 bakery 객체에 함께 저장 |
| `src/styles.css` | `.mypage-preview-*` 신규, `.mypage-panel-grid`/`.mypage-panel-card` 제거, 프로필 카드/헤딩/반응형 조정 |

## 테스트 및 검증

- `npm test` 49/49 통과(회귀 없음).
- `npm run build` 정상.
- dev 서버에서 `useAuth` 훅에 임시 로그인 유저를 주입해(작업 종료 후 매번 원복) 로그인 상태 화면을 직접 확인: 미리보기 4열 레이아웃, 항목 늘어날 때 세로로 자라는지, 긴 빵집 이름 들어갔을 때 옆 패널 침범 여부, 헤더 아이콘/화살표, 빵 종류 아이콘 분기(있음/없음) 모두 스크린샷으로 확인.
- 모바일 브레이크포인트(760px)는 기존 코드베이스와 동일한 패턴을 그대로 적용했으나, 브라우저 리사이즈 스크린샷 도구 문제로 육안 검증은 못 함 — 실기기/DevTools 확인 권장.

## 자가 점검

- 코스 목록 미리보기는 시안처럼 "성심당 코스" 같은 짧은 이름이 아니라 기존 `formatCourseLabel`(날짜·스탑 수·이동수단) 그대로 사용 — `saved_courses.title`이 항상 "대전한바퀴"로 고정 저장되는 구조라 커스텀 이름이 없고, 스키마 변경은 이번 범위에서 제외했다.
- 친구목록 실기능(#24)은 미착수, 자리만 유지.

## 다음 단계

1. PR 생성, `Closes #22`.
2. 팀 코드리뷰 → 반영 → 본인이 merge.
3. 후속 이슈: #23(모바일 반응형 정리), #24(친구목록 실기능, #22가 만든 4번째 컬럼 자리를 채움).
