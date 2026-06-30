# [CP2 지시서] 마커 클러스터링 + 초기 로드 체감 점검

**날짜:** 2026-06-30
**선행:** [CP1_보고서_맵밀도확장.md](CP1_보고서_맵밀도확장.md) (빵집 44 → 360곳으로 확장 완료)
**프로젝트:** `C:\Users\user\관광공모전` (대전 빵집 지도, React + Vite). 빌드 `npm run build`.

---

## 배경 / 문제
CP1로 결과 지도에 빵집이 **360곳**(5개 구) 뜨게 됨. 마커가 너무 많아 **지도가 빽빽**하고, 카카오 쿼리 ~57회 + 마커 360개라 **초기 로드가 느릴 수** 있음.

## 목표
1. 줌 레벨에 따라 **마커 클러스터링**(묶음 + 숫자) → 가독성 확보.
2. **초기 로드 체감**을 측정하고, 느리면 개선.

## 작업
1. **클러스터링 연동**
   - `src/components/map/features/index.js`에 `clustering` 기능 객체가 `enabled:false`로 존재 → 구현 + `enabled:true`.
   - 카카오 SDK는 이미 `clusterer` 라이브러리 로드됨(`useKakaoLoader`). `kakao.maps.MarkerClusterer`로 마커를 묶기.
   - `src/components/map/MarkerLayer.jsx`가 마커를 클러스터러에 add 하도록(현재는 개별 `setMap`). `minLevel`(예: 6)·`gridSize`·`averageCenter` 설정, 클러스터 숫자 표시.
2. **선택 포커스와 호환**
   - 기존 동작 유지: 리스트/마커 클릭 → 줌인(level 4) + panTo + 말풍선 + **나머지 마커 opacity 0.25 딤**. 줌인 시(레벨 4 < minLevel) 개별 마커가 보이므로 딤이 정상 동작하는지 확인.
   - 대전 마스크 폴리곤·윤곽선과 충돌 없게.
3. **초기 로드 체감 점검**
   - 360곳 로드 + 마커 생성 시간 측정(콘솔 `performance.now()` 또는 타임스탬프 로그).
   - 느리면: ⒜ 카카오 쿼리 병렬 호출 확인 ⒝ 결과 메모리/세션 캐싱(같은 regionId 재호출 방지) ⒞ 마커 배치 생성. 과한 최적화는 지양.

## 대상 파일
- `src/components/map/features/index.js` (clustering setup + enabled:true)
- `src/components/map/MarkerLayer.jsx` (MarkerClusterer 사용)
- 필요 시 `src/components/map/MapView.jsx`, `src/hooks/useBakeries.js`(캐싱)

## 제약
- 기존 **대전 마스크 · 선택 포커스(딤/줌인/말풍선) · 관광공사 병합** 로직 유지.
- 카카오 일 쿼터 준수. `npm run build` 통과.

## 완료 조건
- 줌아웃 → 클러스터(숫자) / 줌인 → 개별 마커.
- 선택 포커스(딤·줌인·말풍선) 정상.
- 초기 로드 체감 측정값 확보(개선했으면 전/후 수치).
- `npm run build` 통과.

## 보고 (필수)
- 같은 폴더에 **`docs/CP2_보고서_마커클러스터링.md`** 작성. 형식은 [CP1 보고서](CP1_보고서_맵밀도확장.md) 참고:
  요약표(변경 전/후) · 변경 파일 · 측정값(로드 체감) · 자가 점검(데이터 계약/구조/경계) · 검증 방법.
