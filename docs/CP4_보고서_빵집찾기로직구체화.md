# [CP4 보고서] 빵집 찾기 로직 구체화

**날짜:** 2026-08-03
**관련 이슈:** #10 (빵집 찾기 로직 구체화)
**브랜치:** `20260803-#10-refine-bakery-recommendation-logic`
**참고 문서:** `빵로직 요약본.pdf` (개발팀 최종본 — Q1 분기 + Branch별 가중치 스코어링 설계)
**상태:** 🟡 기능 구현 + push 완료, PR 미생성 (develop 대상 PR 리뷰 대기)

---

## 요약

"빵집 찾기"(오늘의 빵 추천) 로직을 4문항 이진 태그 매칭 방식에서 `빵로직 요약본.pdf` 기준
**Q1 분기(Branch A~E) + Branch별 Q2~Q5 가중치 스코어링** 구조로 전면 재설계했다. 문서에 없던
적합도 수치(Branch 5개 × 문항 4개 × 선택지 5개 × 후보 빵 8~9종)와 빵집-대표메뉴 매칭 데이터는
직접 채워 넣었다.

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 설문 구조 | 4문항 이진 선택(고정) | Q1(분기) + Branch별 Q2~Q5(5지선다), 매 사용자가 6스텝 고정 |
| 추천 결과 | 8종 | 20종 (식사형/페이스트리형/든든한 간식형/달콤한 빵/디저트형) |
| 점수 계산 | 태그 가중합 → 최고 매치 타입 | Q2 25%·Q3 30%·Q4 30%·Q5 15% 가중합(0~100), 클램프 없이 실제 점수 노출 |
| 동점 처리 | 없음(첫 항목 우선) | Q4→Q3→Q2→Q5 개별 적합도 → 최고/차상위 적합도 횟수 → 고정 ID 순 |
| 빵집 매칭 | 빵 keywords ↔ 빵집 이름/카테고리 substring, 매칭 0곳 시 인기순 폴백 | 대전시 공식 목록(100곳) 큐레이션 우선 매칭 + keyword 보조, **폴백 없음**(PDF 원칙) |
| 지도(MapResult) | 태그 점수로 대전 전역 거리순 나열(추천 빵과 무관, 항상 같은 목록) | 추천된 빵 기준으로 결과 화면과 동일한 빵집을 지도에 그대로 이어서 표시 |
| 추천점수 UI | 태그 점수 배지(옛 로직 폐기 후 항상 0으로 노출) | 무력화된 표시 제거 |

## 변경 파일

- **`src/data/breadCandidates.js`** *(신규)* — 20종 빵 카탈로그(카테고리/설명/해시태그/keywords).
- **`src/data/surveyConfig.js`** *(전면 교체)* — Q1(분기 질문) + `BRANCHES` A~E, Branch별 Q2~Q5 문항·선택지·후보 빵별 fitness(1~5) 전체.
- **`src/lib/breadRecommend.js`** *(신규)* — `resolveBranch`/`scoreCandidates`/`pickBreadResult`(동점 처리 포함)/`buildReason`/`matchBakeries`/`isSurveyComplete`.
- **`src/data/bakeryBreadMenu.js`** *(신규)* — 대전시 "대전의 맛" 공식 빵집 목록(daejeon.go.kr, 100곳) 기반 "빵집명 → 실제 판매 빵 ID" 큐레이션.
- **`src/api/normalize.js`** — 이름 정규화 함수 `nameKey` export(중복 판정용으로 쓰던 걸 큐레이션 매칭에도 재사용).
- **`src/lib/recommend.js`** — `BREAD_TYPES`/구 `SURVEY` 의존 코드 제거, 범용 태그-가중치 빵집 정렬기만 남김(다른 화면에서 `answers:{}`로 계속 사용).
- **`src/data/breadTypes.js`, `src/lib/breadMatch.js`** — 삭제(각각 `breadCandidates.js`, `breadRecommend.js`로 대체).
- **`src/components/survey/SurveyFlow.jsx`** — Q1 응답으로 branch 파생, Q2~Q5 를 해당 branch 문항으로 동적 전환(TOTAL_STEPS=6 고정 — 모든 branch 4문항).
- **`src/pages/LandingPage.jsx`** — `surveyDone` 판정을 `isSurveyComplete(answers)`로 교체.
- **`src/components/result/BreadReveal.jsx`** — 신규 엔진 연동, 스포트라이트 3→5곳 + 거리/영업여부 표시, 답변 기반 "추천 이유" + 빵 고정 "취향 키워드" 분리 표시, `useBakeries` `limit: Infinity` 호출.
- **`src/components/map/MapResult.jsx`** — `pickBreadResult`/`matchBakeries`로 BreadReveal 과 동일 기준의 빵집만 표시(헤더도 "{빵이름} 맛집 추천"), 결과 없을 때만 기존 전역 거리순 폴백.
- **`src/components/map/RecommendCard.jsx`, `src/styles.css`** — 무력화된 "추천점수" 텍스트/배지 제거.

## 동작 검증 (dev 서버 + 브라우저 자동화)

- Branch A(든든한 한 끼) 완주 → 베이글 61%, Branch B(커피와 함께) 전항목 1번 선택 → 크루아상 85% — 두 경우 모두 수식(`Σ fitness/5×weight`)과 정확히 일치 확인.
- 뒤로가기로 Q1 답을 E→B로 변경 → 이전 branch(E)의 잔여 답변이 새 branch 문항과 안 섞이는지 확인(branch 접두사 id 덕분에 안전).
- Q1 미응답 상태로 "건너뛰고 결과 보기" → 안내 문구("아직 답변이 부족해요") 정상 표시 확인.
- 소금빵(94%) 결과 → 큐레이션 매칭으로 콜드버터베이크샵/언니네빵집/버터포인트/에코브레드하우스/두건호텔리어 5곳이 거리순 노출 확인.
- 베이글(88%) 결과 → 큐레이션 확정 매칭("굿베이글")과 keyword 보조 매칭("베이글클럽")이 함께 동작함을 확인.
- "지도에서 보기" 이동 시 결과 화면과 동일한 빵집 목록이 그대로 이어짐(이전엔 안 그랬음 — 아래 버그 항목 참고) 확인.
- `npm run build` 매 커밋 전 통과 확인, 100개 큐레이션 항목 breadId 유효성/브랜치별 적합도표 무결성(같은 질문 내 5점 중복 없음, 후보 빵 전원 최소 1회 5점 확보)을 스크립트로 전수 검증.

## 발견 및 수정한 버그

- **"지도에서 보기"가 항상 같은 빵집만 보여줌:** `MapResult`가 새 Q1~Q5 응답과 안 맞는 옛
  태그-가중치 정렬기(`recommend.js`)를 그대로 쓰고 있어서, 실제로는 매 결과가 대전 전역
  거리순 나열과 동일했다(추천된 빵과 무관). `pickBreadResult`/`matchBakeries`로 교체해 해결.
- **큐레이션 매칭 0건:** `BreadReveal`이 `useBakeries`를 기본 `limit`(10)으로 호출해서
  "출발지 근처 10곳"으로 이미 잘린 풀 안에서만 검색하고 있었다. 큐레이션한 100곳은 대전
  전역에 흩어져 있어 근처 10곳 안에는 거의 안 걸림 → `limit: Infinity`로 전체 풀에서
  검색하도록 수정.
- **무력화된 "추천점수" 텍스트:** 옛 태그 점수가 새 응답 구조와 안 맞아 항상 0이 되면서,
  `RecommendCard`에 조건 없이 "추천점수: 0"이 계속 노출되고 있었다(사용자 지적으로 발견). 제거.

## 자가 점검

- **큐레이션 데이터의 한계:** `bakeryBreadMenu.js`는 좌표가 없어 빵집 **이름 매칭**으로만
  실제 API 레코드와 연결한다. 상호명이 조금이라도 다르면(지점명 차이 등) 매칭이 안 될 수
  있음 — `nameKey` 정규화(공백/괄호/본점·점 제거)로 일부 완화했으나 완전하지 않다.
- **범위:** 큐레이션 100곳에 없는 빵집이나, 큐레이션엔 있어도 해당 항목에 대응하는 빵 ID가
  없는 메뉴(마카롱/쿠키/파이 등 20종 밖 품목)는 이 채널로는 매칭되지 않는다 — keyword 보조
  매칭에만 의존.
- **미해결/범위 외:** GitHub 이슈의 Type/Projects 필드는 이 저장소가 개인 계정 소유라 현재
  지원되지 않아(확인됨) 적용하지 않았다.

## 다음 단계

1. `git push` 완료 상태 — PR 생성 필요 (develop 대상, `Closes #10`).
2. 팀 코드리뷰 → 반영 → 본인이 merge.
