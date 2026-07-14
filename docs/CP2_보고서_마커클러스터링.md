# [CP2 보고서] 마커 클러스터링 + 초기 로드 체감 점검

**날짜:** 2026-06-30
**관련 지시서:** [CP2_지시서_마커클러스터링.md](CP2_지시서_마커클러스터링.md)
**선행:** [CP1_보고서_맵밀도확장.md](CP1_보고서_맵밀도확장.md) (빵집 44 → 360곳)
**상태:** ✅ 완료 (빌드 통과 + 브라우저 로직 검증)

---

## 요약

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 마커 표시 | 360개 개별 마커 (빽빽) | 줌아웃 = 클러스터(숫자) / 줌인(<레벨6) = 개별 마커 |
| `clustering` 기능 | `enabled:false` 골격만 | `enabled:true` + `MarkerClusterer` 연동 |
| 선택 포커스 | 줌인+딤+말풍선 | 동일 유지 (클러스터와 충돌 없음) |
| 재방문 로드 | 매번 카카오 ~57회 재호출 | regionId 캐시 적중 → 재호출 0회 |
| 로드 계측 | 없음 | `[bakeries] 로드 ms` · `[markers] N개 생성 ms` 로그 |
| 빌드 | — | `npm run build` 통과 |

## 측정값 (브라우저 콘솔, dev)

| 단계 | 수치 |
| --- | --- |
| 데이터 로드(콜드, 카카오 fetch+병합) | **3010ms** |
| 마커 360개 생성 + 클러스터러 배치 add | **61ms** |
| 재방문(같은 regionId, SPA 이동) | 캐시 적중 → fetch **생략(0ms)** |

- 병목은 카카오 ~57회 호출(3초)이며 마커 생성(61ms)은 무시 가능 → 마커 측 추가 최적화 불필요(과최적화 지양).
- 개선책으로 **regionId 인메모리 캐시** 추가: 설문→지도→뒤로→지도 재방문 시 재호출 제거.

## 변경 파일

- **`src/components/map/features/index.js`** — `clustering` `enabled:true`. 마커 소유권을 MarkerLayer와 조율해야 하므로 generic `setup` 대신 `create({map,kakao})` 팩토리로 `kakao.maps.MarkerClusterer`(`averageCenter:true`, `minLevel:6`, `gridSize:80`, 앱 팔레트 주황 3단 스타일+숫자) 생성. `clusteringEnabled()`/`createClusterer()` export. `getEnabledFeatures()`는 `setup` 가진 기능만 반환하도록 좁혀 clustering 중복 실행 방지.
- **`src/components/map/MarkerLayer.jsx`** — `clusterer` prop 수용. 클러스터 모드에선 마커 생성 시 `map` 미지정 후 `clusterer.addMarkers()` 일괄 추가, 정리는 `clusterer.clear()`. 개별 모드(폴백)는 기존 `setMap`. 마커 생성 시간 로그.
- **`src/components/map/MapView.jsx`** — 지도 생성 effect에서 `createClusterer({map,kakao})`로 인스턴스 만들어 state에 담고 `MarkerLayer`에 prop 전달(자식 effect 순서 레이스 없이 1회 부착).
- **`src/hooks/useBakeries.js`** — 모듈 레벨 `mergedCache(regionId→Bakery[])`로 재호출 방지, `performance.now()` 로드 계측 로그.

기존 **대전 마스크 폴리곤·윤곽선 · 선택 포커스(딤/줌인/말풍선) · 관광공사 병합** 로직 유지.

## 동작 검증 (preview, port 5173)

- 콘솔 `[markers] 360개 생성 61ms (클러스터링)` → `createClusterer`가 실제 인스턴스 반환 + `addMarkers` 무오류 실행 확인(클러스터링 경로 동작).
- 리스트에서 "성심당 본점" 선택 → 콘솔 에러 0건. `setLevel(4)`(<minLevel 6)에서 클러스터가 개별 마커로 풀리며 딤/말풍선 정상(선택 포커스 ↔ 클러스터 호환 확인).
- 전 구간 console error 0건.
- ⚠️ **시각 스크린샷 미확보:** 헤드리스 preview 렌더러가 카카오맵 타일/오버레이를 그리지 못해(스크린샷 타임아웃) 클러스터 원형은 화면 캡처로 남기지 못함 — 환경 제약(CP1도 동일). 로직은 위 콘솔/무오류로 검증.

## 자가 점검

- **데이터 계약:** `MarkerLayer`에 `clusterer` prop 추가만, Bakery 객체 형태 불변. `features` export(`clusteringEnabled`/`createClusterer`)와 `MapView` 소비부 일치.
- **구조:** 클러스터러를 지도 생성 effect에서 함께 생성·state 전달 → 자식(MarkerLayer) effect가 prop으로 받아 1회 부착(이중 add 없음). 클러스터 모드에서 마커에 `map` 미지정으로 클러스터러와 표시 권한 충돌 없음. 정리 시 `clusterer.clear()` 멱등.
- **경계/충돌:** 클러스터러는 마커만 관리, 대전 마스크/윤곽 폴리곤은 별도 오버레이라 충돌 없음. `minLevel:6`·`maxLevel:9`와 정합.
- **쿼터:** 호출 수 불변(쿼리 19개 × 3p ≈ 57회). 캐시로 재방문 시 호출 **감소**.
- **결함 없음.**

## 참고 (CP2 범위 외)

- 이번 실행에서 관광공사 `tour` 결과가 0건(`수집 800건 (tour 0 + kakao 800)`). dev 프록시(`/tourapi`) 응답 이슈로 보이며 카카오 360곳으로 정상 동작. 클러스터링과 무관하므로 본 CP에서 손대지 않음(필요 시 별도 CP에서 점검).
