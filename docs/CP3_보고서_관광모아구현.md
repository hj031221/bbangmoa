# [CP3 보고서] 관광모아 기능 구현

**날짜:** 2026-07-31
**관련 이슈:** #8 (관광모아 기능 구현)
**브랜치:** `20260731-#8-관광모아-기능-구현`
**마감:** 2026-08-04(화)
**상태:** 🟡 기능 구현 완료, PR 미생성 (develop 대상 PR 리뷰 대기)

---

## 요약

새 시안(`대전 웹사이트2.pdf`) 기준으로, 상단 메뉴의 "신상 빵빵"(준비중 placeholder)을 실제 기능인 **관광모아**로 교체했다. 관광명소 허브(그리드) + 상세 페이지를 신설하고, 관광지 상세에서 "근처 빵집 보기"를 누르면 빵 지도가 해당 관광지 기준 거리순 10곳만 보여주는 모드로 전환되도록 연결했다.

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| NavBar "신상 빵빵" | `bm-soon` 비활성 버튼 | "관광모아" 실제 기능 버튼 |
| 관광명소 목록 | 랜딩 페이지 캐러셀에만 일부 노출 | 독립 허브 페이지(원형 그리드, 21개씩 페이지네이션, 구 필터) |
| 관광지 상세 | 없음 | 사진+정보 카드(영업배지, 주소, 시간, 전화, 휴무, 설명 더보기/접기, 출처) 신설 |
| 관광지 주소 정밀도 | 정적 데이터 "OO동"까지만(173곳 중 42곳) | 좌표 기반 카카오 `coord2address`로 도로명/지번 보강 |
| 근처 빵집 | 없음 | 관광지 좌표 기준 haversine 거리순 상위 10곳 + 지도에 관광지 핀 표시 |
| 영업 상태 배지 | (신규) | 영업중=초록 네온 테두리, 영업종료=빨강 네온 테두리+빨간 텍스트 |
| 본문 폰트 | `Pretendard`(실제로는 로드 안 됨 → 시스템 폰트로 대체) | 브랜드 폰트 Regular 컷(`HakgyoansimDunggeunmisoTTF-R`) 정식 로드 |

## 변경 파일

- **`src/components/landing/NavBar.jsx`** — "신상 빵빵" 버튼을 "관광모아"로 교체, `onOpenTour` prop 배선(데스크톱+모바일 메뉴).
- **`src/pages/LandingPage.jsx`** — `showTour`, `nearbyOrigin` 상태 추가. `openBakeryMap(attraction?)`이 관광지 좌표를 받으면 근처 빵집 모드로 진입하도록 확장. 다른 화면 전환 시 서로 배타적으로 초기화.
- **`src/components/tour/TourPage.jsx`** *(신규, 221줄)* — 관광모아 허브(원형 그리드, 페이지네이션 21개/페이지, 구 필터 칩) + 상세 뷰(`AttractionDetail`) 구현. `getDetail`(관광공사 API)로 설명/전화 보강, `reverseGeocodeAddress`로 주소 보강, 설명 160자 요약+더보기/접기 토글, "(출처: OO)" 분리 표기.
- **`src/lib/hours.js`** *(신규)* — `hours.open/close` 기준 영업중 여부 판단(`isOpenNow`) + 배지 텍스트 생성(`hoursBadgeText`).
- **`src/api/kakaoLocal.js`** — `reverseGeocodeAddress(lat, lng)` 추가. 카카오 `coord2address` 엔드포인트로 좌표→도로명/지번 주소 변환.
- **`src/api/index.js`** — `reverseGeocodeAddress` export 추가.
- **`src/components/map/BakeryMapPage.jsx`** — `origin`/`onClearOrigin` prop 수용. `origin`이 있으면 구 필터 대신 haversine 거리순 상위 10곳만 표시(순위+거리 라벨), 지도에 관광지 핀 동시 표시. "← 전체 빵 지도 보기"로 일반 모드 복귀.
- **`src/styles.css`** — 관광모아 전용 스타일(그리드, 상세 카드, 페이지네이션, 네온 배지, 더보기 토글 등) 전량 신규. **사이트 전역**: `HakgyoansimDunggeunmisoTTF-R` `@font-face` 추가 후 `body` 기본 폰트로 적용(브랜드 폰트 Regular 컷 — Bold만 쓰던 걸 Regular까지 확장).

## 동작 검증 (dev 서버 + 브라우저 자동화)

- 관광모아 허브 → 상세 → 근처 빵집 보기 → 전체 빵 지도 복귀 전체 플로우 반복 확인.
- 구 필터(유성구 등) 적용 시 개수/페이지 재계산 확인.
- 영업중/영업종료 배지 실제 데이터로 초록/빨강 네온 둘 다 렌더링 확인.
- 설명 더보기/접기 토글, 명소 전환 시 접힘 상태로 리셋 확인.
- 좌표 기반 주소 보강(예: "대전광역시 서구 둔산동" → "대전 서구 둔산동 1544") 확인.
- 근처 빵집: "대전솔로몬로파크" 기준 10곳이 569m~2.4km 거리순으로 정확히 정렬됨을 확인.
- `document.fonts` 로 브랜드 폰트 Bold/Regular 둘 다 `status:"loaded"` 확인.
- 전 구간 console error 0건 (아래 크래시 건은 발생 즉시 수정 후 재검증).

## 발견 및 수정한 버그

- **Rules of Hooks 위반 크래시:** 구 필터 커밋에서 `useMemo(filtered)`를 상세뷰 조기 `return` **뒤에** 둬서, 명소 클릭 시 렌더링마다 훅 호출 개수가 달라지며 화면이 통째로 하얗게 깨지는 문제 발생(`Rendered fewer hooks than expected`). `useMemo`를 조기 return 앞으로 이동해 수정. (커밋 `c11a03d`)
- **상세 사진 높이 불일치:** `.tour-detail-img`가 `height:100%`+`min-height`라서 정보 패널 텍스트 길이(그리드 행 auto-height)에 따라 명소마다 사진 높이가 들쭉날쭉했음. 고정 `height:360px`(모바일 220px)로 변경. (커밋 `0129357`)
- **Pretendard 미로드:** 본문 폰트로 지정돼 있던 `Pretendard`가 실제로는 `@font-face`/CDN 링크가 전혀 없어 대부분 사용자 환경에서 시스템 기본 폰트로 대체되고 있었음. 브랜드 폰트 Regular 컷을 정식으로 불러와 교체.

## 자가 점검

- **데이터 계약:** `BakeryMapPage`에 `origin` prop 추가는 옵셔널(기본 `null`)이라 기존 호출부(NavBar "빵 지도" 등)는 영향 없음. `openBakeryMap(attraction)`은 `attraction?.lat/lng` 가드로 이벤트 객체가 실수로 들어와도 안전하게 무시.
- **범위:** `body` 폰트 변경은 사이트 전역에 영향 — 관광모아 범위를 넘어서므로 PR 리뷰 시 별도로 짚어야 함(이미 리뷰어에게 구두 안내함).
- **미해결/범위 외:** "빵지순례" 코스 빌더는 이번 이슈 범위 밖(별도 이슈 필요, 가장 큰 미착수 작업). `RecommendCard`(빵집 상세)에는 아직 네온 배지·더보기 패턴이 반영되지 않음 — 관광지 쪽에만 우선 적용됨. 독립 "빵집 상세 페이지" 라우트도 여전히 없음(지도 사이드패널로만 존재).

## 다음 단계

1. `git push` 완료 상태 — PR 생성 필요 (develop 대상, `Closes #8`).
2. 팀 코드리뷰 → 반영 → 본인이 merge.
3. 마감(2026-08-04) 전까지 리뷰 피드백 대응 여유 확보됨.
