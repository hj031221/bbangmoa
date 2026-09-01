# 방문 스탬프 — 사용자 설정 목표 모델 (이슈 #63 확장)

**날짜:** 2026-09-01
**브랜치:** `feature-stamp` (base: `develop`)
**선행 스펙:** `docs/superpowers/specs/2026-09-01-visit-stamp-widget-design.md` (초기 스탬프 위젯 — 이 문서가 지표 모델·표시·배치를 개편한다)
**관련 이슈:** #63

## 배경

초기 구현의 지표는 `구별 min(빵집수/3,1) → 5개 구 평균`이었다. localhost 확인 결과 "왜 7%?"가 2단계 계산을 거쳐야 설명되고, 사용자에게 불투명하다(빵집 1곳 = 7%). 위젯 이름이 "방문 스탬프"인 만큼 **스탬프 투어(스탬프 달성률)** 모델로 바꾼다. 동시에 친구 화면에서 스탬프 밴드가 기록장 안에 묻혀 있던 것을 친구 상세 첫 화면으로 끌어올린다.

이 변경은 `profiles` 스키마에 컬럼 1개를 추가한다(초기 스펙의 "1단계 DB 무변경" 전제를 이 시점에 깬다 — 이슈 본문도 2·3단계에서 깨진다고 명시).

## 브레인스토밍으로 확정된 결정

- **목표값 저장**: `profiles.stamp_target int not null default 3`. `user_metadata` 미러는 두지 않는다 — 단일 `profiles` 컬럼. 기본값이 3이라 로드 전 잠깐 3으로 계산돼도 대부분 체감이 없다. 친구/공유 화면은 기존 `profiles_select_self_or_related` RLS로 대상 사용자의 값을 읽는다.
- **직접 설정 범위**: 1~20 (DB check constraint + 클라 클램프).
- **목표 설정 UI 위치**: `VisitStampModal` 안. 프리셋 `1곳 / 3곳 / 5곳 / 직접`. 친구 모달은 읽기 전용(`목표: 구마다 N곳`).
- **친구 밴드 위치**: `MyPage`의 `friendDetail` 분기 — "OO님의 마이페이지" 헤더와 "찜한 빵 목록" 메뉴 **사이**. `friendDiary` 분기의 밴드·래퍼는 제거.
- **`verifiedOnly` 파라미터**: 지금 배선만. `verified` 컬럼은 이슈 2단계에서 추가되므로 기본 `false`로 전체 기록을 센다. 2단계 병합 시 호출부에서 `true`로 바꾼다.

## 제외 사항

- `verified` 컬럼 추가, GPS 캡처, 인증 뱃지 — 이슈 2단계.
- 공유 이미지 카드 / `/s/:shareCode` 공개 페이지 / OG 이미지 — 이슈 3단계. **단** 공유 화면 문구는 후속에서 `15/15 스탬프 · 목표 달성` 형식을 쓰기로 방향만 정함(이번 범위 아님).
- 구별로 서로 다른 목표(구마다 다른 값) — 목표는 5개 구에 **동일하게** 적용.
- 목표 변경 이력/undo — 마지막 값만 저장.
- `profiles.stamp_target`의 `user_metadata` 미러 및 부분 실패 재동기화 — 단일 컬럼, 낙관적 업데이트 + 실패 시 롤백만.

---

## 1. DB (`supabase/schema.sql`)

파일 맨 끝에 `-- ===== 이슈 #63: 스탬프 목표 =====` 섹션을 추가한다. 전체 재실행이 안전하도록 모든 문장을 idempotent하게 쓴다. 기존 파일의 컬럼 추가 패턴(`avatar_url` 등, line 253~279)을 따른다.

```sql
alter table profiles add column if not exists stamp_target int not null default 3;

alter table profiles drop constraint if exists profiles_stamp_target_range;
alter table profiles add constraint profiles_stamp_target_range
  check (stamp_target between 1 and 20);

-- 컬럼 단위 grant 목록에 stamp_target 추가 (기존: nickname, avatar_url, avatar_version)
revoke update on profiles from authenticated;
grant update (nickname, avatar_url, avatar_version, stamp_target) on profiles to authenticated;
```

- **읽기**: 기존 `profiles_select_self_or_related` 정책이 본인 + 수락된 친구의 `profiles` 행 SELECT를 허용하므로 `stamp_target`도 별도 정책 없이 읽힌다. 비친구는 RLS로 차단.
- **쓰기**: 기존 `profiles_update_own`(본인 행) + 위 컬럼 grant. 본인만 자기 `stamp_target`을 바꾼다.
- `handle_new_user_profile` 트리거 수정 불필요 — 컬럼에 `default 3`이 있어 신규 가입자도 자동으로 3을 가진다.
- 기존 행(이미 가입한 사용자)은 `add column ... not null default 3`이 백필한다.

## 2. `src/hooks/useStampTarget.js` (신설)

`profiles.stamp_target`을 읽고(본인 또는 친구), 본인 값은 갱신한다.

### API

```js
useStampTarget(targetUserId?: string) → {
  target: number,              // 1~20, 로드 전/실패 시 3
  setTarget: (n: number) => Promise<void>,  // targetUserId 있으면 no-op
  loading: boolean,
}
```

### 동작

- `queryUserId = targetUserId ?? user?.id`. `user`는 `useAuth()`.
- 마운트/`queryUserId` 변경 시 `supabase.from('profiles').select('stamp_target').eq('user_id', queryUserId).maybeSingle()`.
  - 결과 `data?.stamp_target`이 정수면 그것을, 아니면 `3`. 에러는 `console.error('[스탬프목표] 조회 실패', error)` 후 `3` 유지.
  - `useDiaryEntries`의 `alive` 가드 패턴(마운트 effect만 stale 응답 무시)을 그대로 따른다.
- `setTarget(n)`:
  - `targetUserId`가 있으면(친구 조회 모드) 아무것도 안 하고 `Promise.resolve()`.
  - `user`가 없으면 `Promise.resolve()`.
  - `clamped = Math.min(20, Math.max(1, Math.round(n)))`.
  - 낙관적: `setTarget` 로컬 state를 `clamped`로 즉시 갱신.
  - `supabase.from('profiles').update({ stamp_target: clamped }).eq('user_id', user.id)`.
  - 에러면 `console.error('[스탬프목표] 저장 실패', error)` + 로컬 state를 이전 값으로 롤백.
- 비로그인(`user` 없음, `targetUserId` 없음): `target = 3`, `loading = false`, `setTarget` no-op. (밴드는 로그인 분기에서만 마운트되므로 실질적으로 도달 안 함.)

### 테스트

훅은 Supabase·React 의존이라 이 레포 관례상 단위 테스트를 두지 않는다(다른 훅들도 테스트 없음). 검증은 `computeVisitStamps` 단위 테스트 + 수동 확인.

## 3. `src/lib/visitStamps.js` — `computeVisitStamps` 개편

### 새 시그니처

```js
computeVisitStamps(entries, { targetPerDistrict = 3, verifiedOnly = false } = {}) → {
  perDistrict: [
    { name, count, target, completedSlots, goalPct, completed }
  ],                       // 5개, DISTRICT_RINGS 순서
  visitedBakeryCount,      // 5개 구에 속한 서로 다른 빵집 총수 (target 초과분 포함)
  completedSlots,          // Σ perDistrict.completedSlots
  totalSlots,              // targetPerDistrict × 5
  goalPct,                // round(completedSlots / totalSlots × 100), 상한 100
  completedDistrictCount,  // completed === true 인 구 수 (0~5)
}
```

- `overallPct` → `goalPct`, `conqueredCount` → `completedDistrictCount`로 **이름을 바꾼다**(기존 키는 남기지 않음). 호출부는 밴드·모달 2곳뿐이며 같은 PR에서 갱신한다.

### 계산

1. `target = Math.min(20, Math.max(1, Math.round(targetPerDistrict)))` — 방어적 클램프.
2. `source = verifiedOnly ? (entries ?? []).filter((e) => e?.verified === true) : (entries ?? [])`.
   - 지금은 `verified` 필드가 없어 `verifiedOnly: true`면 `source`가 빈 배열이 된다(의도된 동작 — 2단계 전엔 호출부가 `false`).
3. 구별 빵집 id 집합: `source`를 순회하며 `districtOf({ lat: e.bakery?.lat, lng: e.bakery?.lng })`가 null이 아니고 `bakeryId = e.bakery_id ?? e.bakery?.id`가 non-null이면 그 구의 `Set`에 추가.
4. 각 구:
   - `count = set.size`
   - `completedSlots = Math.min(count, target)`
   - `goalPct = Math.round((completedSlots / target) * 100)` — `target ≥ 1`이라 0 나눗셈 없음
   - `completed = count >= target`
   - `{ name, count, target, completedSlots, goalPct, completed }`
5. `visitedBakeryCount = Σ perDistrict.count` (구에 매칭된 것만 — 대전 밖/좌표 없는 기록은 애초에 어느 구 집합에도 안 들어감).
6. `completedSlots = Σ perDistrict.completedSlots`.
7. `totalSlots = target * 5`.
8. `goalPct = Math.min(100, Math.round((completedSlots / totalSlots) * 100))`.
9. `completedDistrictCount = perDistrict.filter((d) => d.completed).length`.

### 예 (스펙 검증용)

`targetPerDistrict: 5` → `totalSlots = 25`. 중구 5곳·서구 3곳·동구 2곳(모두 대전 안, 서로 다른 빵집):
- 중구 `count 5, completedSlots 5, goalPct 100, completed true`
- 서구 `count 3, completedSlots 3, goalPct 60, completed false`
- 동구 `count 2, completedSlots 2, goalPct 40, completed false`
- 유성구·대덕구 `count 0, completedSlots 0, goalPct 0, completed false`
- `visitedBakeryCount 10`, `completedSlots 10`, `totalSlots 25`, `goalPct 40`, `completedDistrictCount 1`

### 테스트 (`src/lib/visitStamps.test.js` 전면 개편)

기존 파일을 새 시그니처·반환에 맞춰 다시 쓴다.

- **기본 목표(3) 빈 입력**: `perDistrict` 5개 전부 `count 0 / completedSlots 0 / goalPct 0 / completed false / target 3`; `visitedBakeryCount 0`, `completedSlots 0`, `totalSlots 15`, `goalPct 0`, `completedDistrictCount 0`.
- **`null`/`undefined` 입력**: 빈 입력과 동일.
- **목표 3, 한 구 4곳**: 그 구 `count 4 / completedSlots 3 / goalPct 100 / completed true`; `visitedBakeryCount 4`, `completedSlots 3`, `totalSlots 15`, `goalPct 20`(3/15), `completedDistrictCount 1`.
- **중복 제거**: 같은 빵집 3번(목표 3) → 그 구 `count 1 / completedSlots 1 / goalPct 33 / completed false`.
- **미분류 제외**: 좌표 없는 기록 + 서울 좌표 기록 → 어느 `count`에도 안 잡히고 `visitedBakeryCount`에도 안 들어감; `totalSlots`는 목표에만 의존.
- **스펙 예제 재현**: 위 "중구 5·서구 3·동구 2, 목표 5" → 표의 숫자 그대로 assert.
- **`targetPerDistrict` 클램프**: `0` → target 1로 처리; `100` → target 20; `2.6` → target 3(반올림).
- **`goalPct` 100 상한**: 목표 1, 다섯 구 모두 2곳씩 → `completedSlots 5`, `totalSlots 5`, `goalPct 100`(초과 아님) ; 목표 1, 한 구 3곳 나머지 0 → `completedSlots 1`, `goalPct 20`.
- **`verifiedOnly: true`**: `verified` 없는 기록만 넣으면 전부 걸러져 `goalPct 0`; `{ ..., verified: true }` 기록은 포함.

## 4. `src/components/mypage/VisitStampModal.jsx` — 개편

### props

```
{ stamp, target, onTargetChange, editable, nickname, onClose }
```

- `stamp` = 새 `computeVisitStamps` 반환.
- `target` = 현재 목표(숫자). `onTargetChange(n)` = 목표 변경 콜백(밴드가 `useStampTarget().setTarget` 전달). `editable` = `true`면 목표 컨트롤 표시(본인), `false`면 읽기 전용(친구).
- 기존 구조(`createPortal`, `.auth-modal.visit-stamp-modal`, `onCloseRef`, Escape/배경 닫기, body 스크롤 잠금, `.auth-modal-close`)와 SVG(라벨 포함)·`vectorEffect`·`max-height` CSS는 유지.

### 내용 (위→아래)

1. 제목: `nickname ? \`${nickname}님의 스탬프\` : '내 스탬프'`.
2. **목표 컨트롤** (`editable`일 때만): 프리셋 버튼 `구마다 1곳 / 3곳 / 5곳` + `직접`. 현재 `target`과 일치하는 버튼에 `.is-active`. `직접` 누르면 `<input type="number" min={1} max={20}>` 노출, 커밋 시 `onTargetChange(clamped)`. 프리셋 버튼은 누르는 즉시 `onTargetChange(1|3|5)`.
   - `editable`이 아니면 대신 한 줄: `목표: 구마다 {target}곳`.
3. 확대 5구 SVG — 구별 채움은 `stamp.perDistrict`의 `goalPct`로 (`fillOpacity(goalPct)`), 구 이름 라벨 유지.
4. 요약 블록:
   - `스탬프 {completedSlots}/{totalSlots}` (강조) · `목표 달성률 {goalPct}%`
   - `{completedDistrictCount}/5개 구 목표 완료`
   - `방문한 빵집 {visitedBakeryCount}곳`
   - "현재 목표"는 여기서 반복하지 않는다 — `editable`이면 2번의 프리셋 컨트롤이, 아니면 2번의 `목표: 구마다 {target}곳` 한 줄이 이미 목표를 보여준다.
5. 구별 목록(`.visit-stamp-modal-list`): 각 행 = 구 이름 / 진행 바(`width: ${goalPct}%`) / `{completedSlots}/{target}` (`.visit-stamp-modal-pct` 자리) / `completed`면 체크 표시.
6. 공유 버튼 없음.

### 용어

- "방문도"·"정복" 단어를 쓰지 않는다. "목표 달성률", "구 목표 완료", "스탬프".

## 5. `src/components/mypage/VisitStampBand.jsx` — 개편

```jsx
const { entries, loading } = useDiaryEntries(targetUserId)
const { target, setTarget } = useStampTarget(targetUserId)
const stamp = useMemo(
  () => computeVisitStamps(entries, { targetPerDistrict: target }),
  [entries, target],
)
```

- `pending`: 기존 `loading && entries.length === 0` 유지(목표 로딩은 기본 3으로 렌더되므로 게이트에 넣지 않음).
- 미니 SVG 채움: 구별 `goalPct` 사용 (`fillOpacity(goalPct)`), `vectorEffect="non-scaling-stroke"` 유지.
- 헤드라인(`.visit-stamp-band-top`):
  - 강조: `스탬프 {stamp.completedSlots}/{stamp.totalSlots}`
  - 보조: `목표 달성률 {stamp.goalPct}%`
  - 그 아래 줄 또는 우측: `{stamp.completedDistrictCount}/5개 구 목표 완료`
- 진행 바 `width: ${stamp.goalPct}%`.
- 모달 렌더: `<VisitStampModal stamp={stamp} target={target} onTargetChange={setTarget} editable={!targetUserId} nickname={nickname} onClose={...} />`.
- `fillOpacity` 로컬 헬퍼는 유지(모달과 각자 2줄 — 초기 스펙에서 합의된 선택).

## 6. `src/pages/MyPage.jsx` — 친구 밴드 위치 이동

### 6.1 `friendDetail` 분기에 삽입

기존:

```jsx
  if (panel === 'friendDetail' && friend) {
    return (
      <div className="mypage-panel">
        <div className="mypage-panel-header"> … {friend.nickname}님의 마이페이지 … </div>
        <div className="friend-detail-menu"> … 3개 버튼 … </div>
      </div>
    )
  }
```

변경: `.mypage-panel-header` `</div>`와 `.friend-detail-menu` `<div>` **사이**에

```jsx
        <VisitStampBand targetUserId={friend.userId} nickname={friend.nickname} />
```

### 6.2 `friendDiary` 분기 원상복구

`.mypage-friend-diary` 래퍼와 그 안의 `<VisitStampBand …>`를 제거하고 다시 `<DiaryPanel … />`만 `return`한다(초기 스펙 이전 상태).

### 6.3 홈 분기

`.mypage-home-heading`과 `.mypage-preview-grid` 사이의 `<VisitStampBand />`는 **그대로 둔다**.

### 6.4 import

`import VisitStampBand from '../components/mypage/VisitStampBand'`는 유지(초기 스펙에서 추가됨).

## 7. `src/styles.css`

- `.mypage-friend-diary` 규칙 **삭제**(래퍼 제거됨).
- 기존 클래스명은 **그대로 둔다**. `.visit-stamp-band-conquer`는 이제 "구 목표 완료" 텍스트를 담지만 클래스명은 유지(이름 변경 이득 없음, diff만 커짐).
- 목표 컨트롤 규칙 추가: `.visit-stamp-goal`(래퍼, flex wrap), `.visit-stamp-goal-btn`(프리셋/직접 버튼, `.is-active` 상태), `.visit-stamp-goal-input`(숫자 입력, `.mypage-nickname-input` 재사용 가능하면 재사용).
- 요약 블록: 기존 `.visit-stamp-modal-summary` 확장 또는 `.visit-stamp-modal-stats`(여러 줄) 추가.
- 구별 목록 행: `{completedSlots}/{target}` + 체크가 들어가므로 `.visit-stamp-modal-row`의 `grid-template-columns`를 조정(예: `56px 1fr auto 18px`).
- 기존 색 토큰만 사용(`--accent --accent-deep --brown --gold --muted --line --card --card2 --ink`). 새 토큰 금지.
- 친구 밴드가 `friendDetail`의 `.mypage-panel`(max-width 720, 가운데 정렬) 안에 들어가므로 별도 폭 규칙 불필요.

## 8. 데이터 흐름

```
useStampTarget(targetUserId) ─ target ─┐
useDiaryEntries(targetUserId) ─ entries ┤
                                       ▼
        computeVisitStamps(entries, { targetPerDistrict: target })
                                       │
   { perDistrict[{name,count,target,completedSlots,goalPct,completed}],
     visitedBakeryCount, completedSlots, totalSlots, goalPct, completedDistrictCount }
                                       │
        ┌──────────────────────────────┴───────────────────────────┐
        ▼                                                          ▼
  VisitStampBand 헤드라인/바 (goalPct)                    VisitStampModal
                                                  · editable=!targetUserId 면 목표 프리셋
                                                  · onTargetChange → useStampTarget.setTarget
                                                    → profiles.stamp_target update → target 변경
                                                    → computeVisitStamps 재계산
```

## 9. 테스트 / 검증

- `src/lib/visitStamps.test.js` — §3 목록 전면 개편, `npm test`.
- `districtFromPoint.test.js`, `daejeonStampPaths.test.js` — 변경 없음, 회귀만 확인.
- 컴포넌트/훅 단위 테스트 없음(레포 관례). `npm run build` 통과.
- 수동:
  - 본인 홈 밴드 → 헤드라인이 `스탬프 x/15 · 목표 달성률 y%` 형태. 모달에서 목표를 5로 바꾸면 `x/25`로 즉시 재계산, 새로고침해도 유지(`profiles` 저장).
  - 목표 `직접` 25 입력 → 20으로 클램프.
  - 친구 → 친구 상세: "OO님의 마이페이지" 아래·"찜한 빵 목록" 위에 밴드. 모달은 목표 컨트롤 없이 `목표: 구마다 N곳`, 그 친구의 저장된 목표로 계산.
  - 친구 기록장: 밴드 없음(원상복구 확인).
  - 기록 0개: `스탬프 0/15 · 목표 달성률 0%`, `0/5개 구 목표 완료`, `방문한 빵집 0곳`.
