# 방문 스탬프 목표 모델 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방문 스탬프 지표를 "사용자가 설정한 구별 목표 대비 스탬프 달성률"로 개편하고, 목표를 `profiles`에 저장하며, 친구 스탬프 밴드를 친구 상세 첫 화면으로 옮긴다.

**Architecture:** `computeVisitStamps(entries, {targetPerDistrict, verifiedOnly})`를 새 반환 형태로 재작성(순수 함수, `node --test`). 목표는 `profiles.stamp_target` 컬럼 + `useStampTarget` 훅으로 읽고/쓴다. `VisitStampModal`에 목표 프리셋 컨트롤(본인만), `VisitStampBand`가 훅과 lib를 배선. `MyPage`는 친구 밴드를 `friendDetail` 분기로 이동. DB 변경 1건(컬럼 + grant).

**Tech Stack:** React 18 hooks, Vite, `node:test`/`node:assert/strict`, Supabase (`profiles` 테이블, RLS, 컬럼 단위 grant), `createPortal`.

**Spec:** `docs/superpowers/specs/2026-09-01-visit-stamp-goals-design.md`

## Global Constraints

- **선행 상태:** 초기 스탬프 위젯(`docs/superpowers/specs/2026-09-01-visit-stamp-widget-design.md`)이 이미 `feature-stamp` 브랜치에 구현돼 있다. 이 계획은 그 위에서 지표 모델·표시·배치를 **개편**한다. 기존 파일: `src/lib/{districtFromPoint,visitStamps}.js`, `src/components/mypage/{daejeonStampPaths.js,VisitStampModal.jsx,VisitStampBand.jsx}`, `src/pages/MyPage.jsx`, `src/styles.css`의 `/* ===== 이슈 #63 1단계 ... */` 블록.
- **ESM import 확장자:** `node --test` 그래프의 `.js` 파일은 import에 `.js` 명시(`../data/daejeonDistricts.js`, `./districtFromPoint.js`). `.jsx`/훅은 확장자 없이(`./VisitStampModal`, `../../hooks/useStampTarget`).
- **테스트 러너:** `npm test` = `node --test "src/**/*.test.js"`. 컴포넌트·훅은 이 레포에 단위 테스트 관례가 없다 — 검증은 `npm run build`. lib(`visitStamps`)만 TDD.
- **구 정규 순서:** `Object.keys(DISTRICT_RINGS)` = `['동구','중구','서구','유성구','대덕구']`. 분모(구 수)는 항상 5.
- **`computeVisitStamps` 새 반환:** `{ perDistrict:[{name,count,target,completedSlots,goalPct,completed}], visitedBakeryCount, completedSlots, totalSlots, goalPct, completedDistrictCount }`. 기존 `overallPct`/`conqueredCount` 키는 **남기지 않는다**.
- **목표 클램프:** 어디서든 `Math.min(20, Math.max(1, Math.round(n)))`. DB check `between 1 and 20`.
- **`verifiedOnly`:** 파라미터만 배선. 기본 `false`. 호출부(밴드)는 `false`로 호출 — `verified` 컬럼은 이슈 2단계.
- **색 토큰:** 기존만 — `--accent #F97658`, `--accent-deep #D9603D`, `--brown #705945`, `--gold #FFB94A`, `--muted #BB9B74`, `--line #E2C1A3`, `--card #FFFFFF`, `--card2 #F6DBA8`, `--ink #4C310D`. 새 토큰 금지.
- **용어:** "방문도"·"정복" 금지. "스탬프", "목표 달성률", "구 목표 완료".
- **커밋 꼬리말(정확히 2줄):**
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GBx7nwPNfEN3onS6Uv4v9W
  ```

---

## File Structure

| 파일 | 역할 | 태스크 |
|------|------|--------|
| `supabase/schema.sql` (수정) | `profiles.stamp_target` 컬럼 + check + 컬럼 grant 추가 (idempotent) | T1 |
| `src/lib/visitStamps.js` (재작성) | 새 시그니처·반환의 `computeVisitStamps` | T2 |
| `src/lib/visitStamps.test.js` (재작성) | 새 모델 단위 테스트 | T2 |
| `src/hooks/useStampTarget.js` (신설) | `profiles.stamp_target` 조회(본인/친구) + 본인 갱신 | T3 |
| `src/components/mypage/VisitStampModal.jsx` (재작성) | 새 stamp 표시 + 목표 프리셋 컨트롤(본인) | T4 |
| `src/components/mypage/VisitStampBand.jsx` (재작성) | `useStampTarget` + 새 stamp 배선, 헤드라인 개편 | T5 |
| `src/pages/MyPage.jsx` (수정) | 친구 밴드를 `friendDetail`로 이동, `friendDiary` 원상복구 | T6 |
| `src/styles.css` (수정) | `.mypage-friend-diary` 삭제, 목표 컨트롤·요약·행 그리드 규칙 | T6 |

`src/lib/districtFromPoint.js`, `src/components/mypage/daejeonStampPaths.js` — **변경 없음**.

---

## Task 1: `profiles.stamp_target` 스키마

**Files:**
- Modify: `supabase/schema.sql` (파일 맨 끝에 append)

**Interfaces:**
- Produces: `profiles.stamp_target` (int, not null, default 3, check 1..20), authenticated 에게 `update` grant. 친구는 기존 `profiles_select_self_or_related` 로 읽음.

- [ ] **Step 1: 스키마 블록 추가**

`supabase/schema.sql` 맨 끝(마지막 줄 `grant execute on function get_diary_comment_authors...` 다음)에 빈 줄 하나 두고 추가:

```sql

-- ===== 이슈 #63: 스탬프 목표 =====
-- 방문 스탬프 위젯의 "구별 목표"(1~20, 기본 3). 5개 구에 동일 적용.
-- 친구/공유 화면은 기존 profiles_select_self_or_related 로 대상 사용자의 값을 읽는다.
alter table profiles add column if not exists stamp_target int not null default 3;

alter table profiles drop constraint if exists profiles_stamp_target_range;
alter table profiles add constraint profiles_stamp_target_range
  check (stamp_target between 1 and 20);

-- 컬럼 단위 update grant 목록에 stamp_target 추가 (기존: nickname, avatar_url, avatar_version).
revoke update on profiles from authenticated;
grant update (nickname, avatar_url, avatar_version, stamp_target) on profiles to authenticated;
```

- [ ] **Step 2: idempotency 확인 (정적 검토)**

읽어보며 확인:
- `add column if not exists` — 재실행 안전.
- `drop constraint if exists` → `add constraint` — 재실행 안전.
- `revoke ... / grant (...)` — 재실행 안전, 그리고 grant 목록이 파일 앞쪽의 마지막 `grant update (...) on profiles` (line ~259, `nickname, avatar_url, avatar_version`) 를 **덮어쓴다**. 새 목록에 기존 3개 컬럼이 모두 포함돼 있는지 확인(포함됨).
- 앞쪽에 `alter table profiles enable row level security;` 와 `profiles_update_own` 정책이 이미 있으므로 정책 추가 불필요.

- [ ] **Step 3: 커밋**

```bash
git add supabase/schema.sql
git commit -m "feat: profiles.stamp_target 컬럼 — 스탬프 구별 목표 (이슈 #63)"
```

주: 이 파일은 마이그레이션 스크립트다. 실제 반영은 사용자가 Supabase SQL Editor 에서 전체 재실행한다(기존 관례). 코드 태스크에서 DB에 접속하지 않는다.

---

## Task 2: `computeVisitStamps` 재작성 (TDD)

**Files:**
- Rewrite: `src/lib/visitStamps.js`
- Rewrite: `src/lib/visitStamps.test.js`

**Interfaces:**
- Consumes: `districtOf` from `./districtFromPoint.js`; `DISTRICT_RINGS` from `../data/daejeonDistricts.js` (키 순서).
- Produces:
  ```
  computeVisitStamps(entries: Array|null|undefined,
                     opts?: { targetPerDistrict?: number, verifiedOnly?: boolean })
    → { perDistrict: Array<{ name:string, count:number, target:number,
                             completedSlots:number, goalPct:number, completed:boolean }>,  // 5개, 정규 순서
        visitedBakeryCount: number,   // Σ perDistrict.count
        completedSlots: number,       // Σ perDistrict.completedSlots
        totalSlots: number,           // target * 5
        goalPct: number,              // round(completedSlots/totalSlots*100), ≤100
        completedDistrictCount: number }
  ```
  `target` = `Math.min(20, Math.max(1, Math.round(targetPerDistrict ?? 3)))`.

- [ ] **Step 1: 실패하는 테스트 작성 (기존 파일 전체 교체)**

`src/lib/visitStamps.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeVisitStamps } from './visitStamps.js'

const JUNG = { lat: 36.3277, lng: 127.4276 } // 중구
const SEO = { lat: 36.3515, lng: 127.3781 }  // 서구
const DONG = { lat: 36.331, lng: 127.434 }   // 동구

function entry(id, coords, extra) {
  return { bakery_id: id, bakery: { id, lat: coords?.lat, lng: coords?.lng }, ...extra }
}

const byName = (r, name) => r.perDistrict.find((d) => d.name === name)

test('빈 입력, 기본 목표 3', () => {
  const r = computeVisitStamps([])
  assert.deepEqual(r.perDistrict.map((d) => d.name), ['동구', '중구', '서구', '유성구', '대덕구'])
  assert.ok(r.perDistrict.every((d) => d.count === 0 && d.completedSlots === 0 && d.goalPct === 0 && d.completed === false && d.target === 3))
  assert.equal(r.visitedBakeryCount, 0)
  assert.equal(r.completedSlots, 0)
  assert.equal(r.totalSlots, 15)
  assert.equal(r.goalPct, 0)
  assert.equal(r.completedDistrictCount, 0)
})

test('null / undefined 입력도 빈 입력과 동일', () => {
  assert.equal(computeVisitStamps(null).totalSlots, 15)
  assert.equal(computeVisitStamps(undefined).goalPct, 0)
})

test('목표 3, 한 구 서로 다른 빵집 4곳 → completedSlots 3, goalPct 100, completed', () => {
  const r = computeVisitStamps([entry('a', JUNG), entry('b', JUNG), entry('c', JUNG), entry('d', JUNG)])
  const j = byName(r, '중구')
  assert.equal(j.count, 4)
  assert.equal(j.completedSlots, 3)
  assert.equal(j.goalPct, 100)
  assert.equal(j.completed, true)
  assert.equal(r.visitedBakeryCount, 4)
  assert.equal(r.completedSlots, 3)
  assert.equal(r.totalSlots, 15)
  assert.equal(r.goalPct, 20) // 3/15
  assert.equal(r.completedDistrictCount, 1)
})

test('같은 빵집 3번 (목표 3) → count 1, completedSlots 1, goalPct 33, 미완료', () => {
  const r = computeVisitStamps([entry('x', JUNG), entry('x', JUNG), entry('x', JUNG)])
  const j = byName(r, '중구')
  assert.equal(j.count, 1)
  assert.equal(j.completedSlots, 1)
  assert.equal(j.goalPct, 33)
  assert.equal(j.completed, false)
})

test('좌표 없는 / 대전 밖 기록은 count·visitedBakeryCount 에서 제외', () => {
  const r = computeVisitStamps([
    entry('a', JUNG),
    entry('b', null),
    entry('c', { lat: 37.5665, lng: 126.978 }), // 서울
  ])
  assert.equal(byName(r, '중구').count, 1)
  assert.equal(r.visitedBakeryCount, 1)
})

test('스펙 예제: 목표 5, 중구 5곳·서구 3곳·동구 2곳', () => {
  const es = [
    ...['j1', 'j2', 'j3', 'j4', 'j5'].map((id) => entry(id, JUNG)),
    ...['s1', 's2', 's3'].map((id) => entry(id, SEO)),
    ...['d1', 'd2'].map((id) => entry(id, DONG)),
  ]
  const r = computeVisitStamps(es, { targetPerDistrict: 5 })
  assert.deepEqual(
    [byName(r, '중구'), byName(r, '서구'), byName(r, '동구')].map((d) => [d.completedSlots, d.goalPct, d.completed]),
    [[5, 100, true], [3, 60, false], [2, 40, false]],
  )
  assert.equal(r.visitedBakeryCount, 10)
  assert.equal(r.completedSlots, 10)
  assert.equal(r.totalSlots, 25)
  assert.equal(r.goalPct, 40)
  assert.equal(r.completedDistrictCount, 1)
})

test('targetPerDistrict 클램프: 0→1, 100→20, 2.6→3', () => {
  assert.equal(computeVisitStamps([], { targetPerDistrict: 0 }).perDistrict[0].target, 1)
  assert.equal(computeVisitStamps([], { targetPerDistrict: 100 }).totalSlots, 100)
  assert.equal(computeVisitStamps([], { targetPerDistrict: 2.6 }).perDistrict[0].target, 3)
})

test('goalPct 100 상한', () => {
  // 목표 1, 다섯 구 모두 2곳씩 → completedSlots 5 / totalSlots 5
  const es = [JUNG, SEO, DONG, { lat: 36.362, lng: 127.356 } /*유성*/, { lat: 36.428, lng: 127.415 } /*대덕*/]
    .flatMap((c, i) => [entry(`${i}a`, c), entry(`${i}b`, c)])
  const r = computeVisitStamps(es, { targetPerDistrict: 1 })
  assert.equal(r.completedSlots, 5)
  assert.equal(r.totalSlots, 5)
  assert.equal(r.goalPct, 100)
  assert.equal(r.completedDistrictCount, 5)
})

test('verifiedOnly: verified 없는 기록은 제외, verified:true 만 포함', () => {
  const mixed = [entry('a', JUNG), entry('b', JUNG, { verified: true })]
  assert.equal(computeVisitStamps(mixed, { verifiedOnly: true }).visitedBakeryCount, 1)
  assert.equal(computeVisitStamps(mixed, { verifiedOnly: true }).perDistrict.find((d) => d.name === '중구').count, 1)
  assert.equal(computeVisitStamps(mixed, { verifiedOnly: false }).visitedBakeryCount, 2)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/lib/visitStamps.test.js`
Expected: FAIL — 기존 `computeVisitStamps`가 새 시그니처/반환을 만족 못 함 (`totalSlots` undefined 등).

- [ ] **Step 3: 재작성**

`src/lib/visitStamps.js` (전체 교체):

```js
import { districtOf } from './districtFromPoint.js'
import { DISTRICT_RINGS } from '../data/daejeonDistricts.js'

const DISTRICT_NAMES = Object.keys(DISTRICT_RINGS)

const clampTarget = (n) => Math.min(20, Math.max(1, Math.round(n)))

// 기록장 배열 + 사용자 목표에서 스탬프 달성도를 파생한다.
//   count          = 그 구에서 방문한 서로 다른 빵집 수 (중복 기록은 1)
//   completedSlots = min(count, target) — 목표 초과분은 스탬프에 안 잡힘
//   goalPct(구)    = round(completedSlots / target * 100)
//   completed      = count >= target
//   goalPct(전체)  = round(Σ completedSlots / (target*5) * 100), 100 상한
// verifiedOnly: 2단계(방문 인증)에서 verified 기록만 세기 위한 스위치. 지금 호출부는 false.
export function computeVisitStamps(
  entries,
  { targetPerDistrict = 3, verifiedOnly = false } = {},
) {
  const target = clampTarget(targetPerDistrict)
  const source = verifiedOnly
    ? (entries ?? []).filter((e) => e?.verified === true)
    : (entries ?? [])

  const byDistrict = new Map(DISTRICT_NAMES.map((name) => [name, new Set()]))
  for (const entry of source) {
    const bakery = entry?.bakery
    const district = districtOf({ lat: bakery?.lat, lng: bakery?.lng })
    if (!district) continue
    const bakeryId = entry?.bakery_id ?? bakery?.id
    if (bakeryId == null) continue
    byDistrict.get(district).add(bakeryId)
  }

  const perDistrict = DISTRICT_NAMES.map((name) => {
    const count = byDistrict.get(name).size
    const completedSlots = Math.min(count, target)
    const goalPct = Math.round((completedSlots / target) * 100)
    return { name, count, target, completedSlots, goalPct, completed: count >= target }
  })

  const visitedBakeryCount = perDistrict.reduce((sum, d) => sum + d.count, 0)
  const completedSlots = perDistrict.reduce((sum, d) => sum + d.completedSlots, 0)
  const totalSlots = target * DISTRICT_NAMES.length
  const goalPct = Math.min(100, Math.round((completedSlots / totalSlots) * 100))
  const completedDistrictCount = perDistrict.filter((d) => d.completed).length

  return { perDistrict, visitedBakeryCount, completedSlots, totalSlots, goalPct, completedDistrictCount }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/lib/visitStamps.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: 전체 회귀**

Run: `npm test`
Expected: 모든 테스트 PASS (visitStamps 외 파일 불변). 테스트 총수는 `111 - 6(기존 visitStamps) + 9 = 114` 부근 — 정확한 수보다 **0 fail** 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/visitStamps.js src/lib/visitStamps.test.js
git commit -m "feat: computeVisitStamps 를 스탬프 목표 달성률 모델로 재작성 (이슈 #63)"
```

---

## Task 3: `useStampTarget` 훅

**Files:**
- Create: `src/hooks/useStampTarget.js`

**Interfaces:**
- Consumes: `useAuth` from `./useAuth` (`{ user }`); `supabase` from `../lib/supabase`.
- Produces:
  ```
  useStampTarget(targetUserId?: string) → {
    target: number,        // 1~20, 로드 전/에러 시 3
    setTarget: (n:number) => Promise<void>,  // targetUserId 있거나 비로그인이면 no-op
    loading: boolean,
  }
  ```

참고: 이 레포는 훅 단위 테스트가 없다. 검증 = `npm run build`. 패턴은 `src/hooks/useDiaryEntries.js`의 `alive` 가드를 따른다.

- [ ] **Step 1: 훅 작성**

`src/hooks/useStampTarget.js`:

```js
import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

const DEFAULT_TARGET = 3
const clamp = (n) => Math.min(20, Math.max(1, Math.round(n)))

// profiles.stamp_target(구별 스탬프 목표, 1~20)를 읽고, 본인 값은 갱신한다.
// targetUserId 가 있으면 그 사용자(친구)의 값을 읽기만 한다 — setTarget 은 no-op.
export function useStampTarget(targetUserId) {
  const { user } = useAuth()
  const queryUserId = targetUserId ?? user?.id
  const [target, setTargetState] = useState(DEFAULT_TARGET)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!queryUserId) {
      setTargetState(DEFAULT_TARGET)
      return
    }
    const alive = { current: true }
    setLoading(true)
    supabase
      .from('profiles')
      .select('stamp_target')
      .eq('user_id', queryUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive.current) return
        setLoading(false)
        if (error) {
          console.error('[스탬프목표] 조회 실패', error)
          return
        }
        setTargetState(Number.isInteger(data?.stamp_target) ? data.stamp_target : DEFAULT_TARGET)
      })
    return () => {
      alive.current = false
    }
  }, [queryUserId])

  const setTarget = (n) => {
    if (targetUserId || !user) return Promise.resolve()
    const clamped = clamp(n)
    const prev = target
    setTargetState(clamped) // 낙관적
    return supabase
      .from('profiles')
      .update({ stamp_target: clamped })
      .eq('user_id', user.id)
      .then(({ error }) => {
        if (error) {
          console.error('[스탬프목표] 저장 실패', error)
          setTargetState(prev) // 롤백
        }
      })
  }

  return { target, setTarget, loading }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공(사전 존재하는 chunk-size 경고만). 아직 import 하는 곳이 없어 트리셰이킹될 수 있음 — 문법/타입만 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/hooks/useStampTarget.js
git commit -m "feat: useStampTarget — profiles.stamp_target 조회/갱신 훅 (이슈 #63)"
```

---

## Task 4: `VisitStampModal` 재작성

**Files:**
- Rewrite: `src/components/mypage/VisitStampModal.jsx`

**Interfaces:**
- Consumes: `STAMP_VIEWBOX`, `DISTRICT_PATHS` (`{name,d,cx,cy}`) from `./daejeonStampPaths`; `stamp` = Task 2 반환.
- props: `{ stamp, target, onTargetChange, editable, nickname, onClose }`.
- Produces: default export `VisitStampModal`.

검증 = `npm run build`. 기존 모달 구조(`createPortal`, `.auth-modal.visit-stamp-modal`, `onCloseRef`, Escape/배경 닫기, body 스크롤 잠금, `.auth-modal-close`, SVG 라벨, `vectorEffect`) 유지.

- [ ] **Step 1: 컴포넌트 재작성 (전체 교체)**

`src/components/mypage/VisitStampModal.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from './daejeonStampPaths'

// 방문 스탬프 상세 모달. CourseNameModal 패턴(auth-modal 공용 클래스, Escape/배경 닫기,
// body 스크롤 잠금). stamp = computeVisitStamps() 결과.
// editable=true(본인)면 목표 프리셋 컨트롤, false(친구)면 '목표: 구마다 N곳' 읽기 전용.
function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100 // pct 0 이어도 형태가 보이도록 최소 0.15
}

const PRESETS = [1, 3, 5]

export default function VisitStampModal({ stamp, target, onTargetChange, editable, nickname, onClose }) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState(String(target))

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.goalPct]))
  const heading = nickname ? `${nickname}님의 스탬프` : '내 스탬프'

  const commitCustom = () => {
    const n = Number(customValue)
    if (Number.isFinite(n)) onTargetChange(n)
    setCustomOpen(false)
  }

  return createPortal(
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal visit-stamp-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" aria-label="닫기" onClick={onClose}>
          ✕
        </button>
        <div className="auth-modal-copy">
          <h3 className="auth-modal-title">{heading}</h3>
        </div>

        {editable ? (
          <div className="visit-stamp-goal">
            <span className="visit-stamp-goal-label">구마다</span>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`visit-stamp-goal-btn${target === p && !customOpen ? ' is-active' : ''}`}
                onClick={() => {
                  setCustomOpen(false)
                  onTargetChange(p)
                }}
              >
                {p}곳
              </button>
            ))}
            <button
              type="button"
              className={`visit-stamp-goal-btn${customOpen || !PRESETS.includes(target) ? ' is-active' : ''}`}
              onClick={() => {
                setCustomValue(String(target))
                setCustomOpen(true)
              }}
            >
              직접
            </button>
            {customOpen && (
              <input
                type="number"
                min={1}
                max={20}
                className="visit-stamp-goal-input"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onBlur={commitCustom}
                onKeyDown={(e) => e.key === 'Enter' && commitCustom()}
                autoFocus
              />
            )}
          </div>
        ) : (
          <p className="visit-stamp-goal-readonly">목표: 구마다 {target}곳</p>
        )}

        <svg
          className="visit-stamp-modal-map"
          viewBox={STAMP_VIEWBOX}
          role="img"
          aria-label="대전 5개 구 스탬프 달성도"
        >
          {DISTRICT_PATHS.map(({ name, d }) => (
            <path
              key={name}
              d={d}
              fill="var(--accent)"
              fillOpacity={fillOpacity(pctByName[name] ?? 0)}
              stroke="var(--brown)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {DISTRICT_PATHS.map(({ name, cx, cy }) => (
            <text
              key={name + '-label'}
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fill="var(--brown)"
              style={{ pointerEvents: 'none' }}
            >
              {name}
            </text>
          ))}
        </svg>

        <div className="visit-stamp-modal-stats">
          <p className="visit-stamp-modal-headline">
            스탬프 {stamp.completedSlots}/{stamp.totalSlots}
            <span className="visit-stamp-modal-goalpct"> · 목표 달성률 {stamp.goalPct}%</span>
          </p>
          <p>{stamp.completedDistrictCount}/5개 구 목표 완료</p>
          <p>방문한 빵집 {stamp.visitedBakeryCount}곳</p>
        </div>

        <ul className="visit-stamp-modal-list">
          {stamp.perDistrict.map((d) => (
            <li key={d.name} className="visit-stamp-modal-row">
              <span className="visit-stamp-modal-name">{d.name}</span>
              <span className="visit-stamp-bar">
                <span className="visit-stamp-bar-fill" style={{ width: `${d.goalPct}%` }} />
              </span>
              <span className="visit-stamp-modal-pct">
                {d.completedSlots}/{d.target}
              </span>
              <span className="visit-stamp-modal-check" aria-hidden="true">
                {d.completed ? '✓' : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/components/mypage/VisitStampModal.jsx
git commit -m "feat: VisitStampModal — 스탬프 달성률 표시 + 목표 프리셋 컨트롤 (이슈 #63)"
```

---

## Task 5: `VisitStampBand` 재작성

**Files:**
- Rewrite: `src/components/mypage/VisitStampBand.jsx`

**Interfaces:**
- Consumes: `useDiaryEntries` (`{entries,loading}`); `useStampTarget` from `../../hooks/useStampTarget` (`{target,setTarget}`, Task 3); `computeVisitStamps` (Task 2); `STAMP_VIEWBOX`/`DISTRICT_PATHS`; `VisitStampModal` (Task 4).
- props: `{ targetUserId, nickname }`.
- Produces: default export `VisitStampBand`.

- [ ] **Step 1: 컴포넌트 재작성 (전체 교체)**

`src/components/mypage/VisitStampBand.jsx`:

```jsx
import { useMemo, useState } from 'react'
import { useDiaryEntries } from '../../hooks/useDiaryEntries'
import { useStampTarget } from '../../hooks/useStampTarget'
import { computeVisitStamps } from '../../lib/visitStamps'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from './daejeonStampPaths'
import VisitStampModal from './VisitStampModal'

function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100
}

// 마이페이지 홈 / 친구 상세 첫 화면의 전체폭 스탬프 밴드.
// targetUserId 가 있으면 그 친구의 기록·목표로 계산하고 모달은 읽기 전용이 된다.
// 로그인 게이트 불필요 — MyPage 의 로그인된 분기에서만 마운트된다.
export default function VisitStampBand({ targetUserId, nickname }) {
  const { entries, loading } = useDiaryEntries(targetUserId)
  const { target, setTarget } = useStampTarget(targetUserId)
  const stamp = useMemo(
    () => computeVisitStamps(entries, { targetPerDistrict: target }),
    [entries, target],
  )
  const [open, setOpen] = useState(false)

  const pending = loading && entries.length === 0
  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.goalPct]))

  return (
    <>
      <button
        type="button"
        className="visit-stamp-band"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        <svg className="visit-stamp-band-map" viewBox={STAMP_VIEWBOX} aria-hidden="true">
          {DISTRICT_PATHS.map(({ name, d }) => (
            <path
              key={name}
              d={d}
              fill="var(--accent)"
              fillOpacity={fillOpacity(pctByName[name] ?? 0)}
              stroke="var(--brown)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <span className="visit-stamp-band-body">
          <span className="visit-stamp-band-top">
            <strong>
              스탬프 {stamp.completedSlots}/{stamp.totalSlots}
            </strong>
            <span className="visit-stamp-band-conquer">
              {stamp.completedDistrictCount}/5개 구 목표 완료
            </span>
          </span>
          <span className="visit-stamp-bar">
            <span className="visit-stamp-bar-fill" style={{ width: `${stamp.goalPct}%` }} />
          </span>
          <span className="visit-stamp-band-sub">목표 달성률 {stamp.goalPct}%</span>
        </span>
      </button>

      {open && (
        <VisitStampModal
          stamp={stamp}
          target={target}
          onTargetChange={setTarget}
          editable={!targetUserId}
          nickname={nickname}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/components/mypage/VisitStampBand.jsx
git commit -m "feat: VisitStampBand — useStampTarget 배선 + 헤드라인 개편 (이슈 #63)"
```

---

## Task 6: `MyPage.jsx` 친구 밴드 이동 + `styles.css`

**Files:**
- Modify: `src/pages/MyPage.jsx` (`friendDetail` 분기, `friendDiary` 분기)
- Modify: `src/styles.css` (stamp 블록)

**Interfaces:**
- Consumes: `VisitStampBand` (이미 import 되어 있음 — 초기 스펙에서 추가됨).

- [ ] **Step 1: `friendDetail` 분기에 밴드 삽입**

`panel === 'friendDetail' && friend` 분기에서 `.mypage-panel-header` 의 `</div>` 와 `<div className="friend-detail-menu">` **사이**에 삽입:

```jsx
        </div>
        <VisitStampBand targetUserId={friend.userId} nickname={friend.nickname} />
        <div className="friend-detail-menu">
```

(즉 `<h3>{friend.nickname}님의 마이페이지</h3>` 를 닫는 `</div>` 다음 줄.)

- [ ] **Step 2: `friendDiary` 분기 원상복구**

현재:

```jsx
  if (panel === 'friendDiary' && friend) {
    return (
      <div className="mypage-friend-diary">
        <VisitStampBand targetUserId={friend.userId} nickname={friend.nickname} />
        <DiaryPanel
          targetUserId={friend.userId}
          readOnly
          friendNickname={friend.nickname}
          onBack={() => setPanel('friendDetail')}
        />
      </div>
    )
  }
```

변경:

```jsx
  if (panel === 'friendDiary' && friend) {
    return (
      <DiaryPanel
        targetUserId={friend.userId}
        readOnly
        friendNickname={friend.nickname}
        onBack={() => setPanel('friendDetail')}
      />
    )
  }
```

- [ ] **Step 3: 홈 분기 — 변경 없음**

`.mypage-home-heading` 와 `.mypage-preview-grid` 사이의 `<VisitStampBand />` 는 그대로 둔다. import 도 그대로.

- [ ] **Step 4: `styles.css` — stamp 블록 수정**

`src/styles.css`의 `/* ===== 이슈 #63 1단계 — 방문 스탬프 위젯 ===== */` 블록에서:

(a) 마지막 줄 **삭제**:
```css
.mypage-friend-diary{ display:flex; flex-direction:column; max-width:720px; margin:0 auto; }
```

(b) `.visit-stamp-modal-row` 규칙의 `grid-template-columns` 를 4열로 교체:
```css
.visit-stamp-modal-row{ display:grid; grid-template-columns:52px 1fr auto 16px; align-items:center; gap:10px; font-size:.85rem; color:var(--ink); }
```

(c) 블록 끝에 append:
```css
/* 이슈 #63 — 스탬프 목표 모델 */
.visit-stamp-band-sub{ font-size:.8rem; color:var(--muted); }
.visit-stamp-goal{ display:flex; flex-wrap:wrap; align-items:center; gap:6px; width:100%; margin:2px 0 12px; }
.visit-stamp-goal-label{ font-size:.85rem; color:var(--muted); margin-right:2px; }
.visit-stamp-goal-btn{ border:1.5px solid var(--line); background:var(--card); color:var(--brown); font-size:.82rem; font-weight:700; padding:6px 12px; border-radius:999px; cursor:pointer; }
.visit-stamp-goal-btn:hover{ border-color:var(--accent); }
.visit-stamp-goal-btn.is-active{ background:var(--accent); border-color:var(--accent); color:#fff; }
.visit-stamp-goal-input{ width:64px; padding:6px 10px; border:1.5px solid var(--line); border-radius:12px; font-family:inherit; font-size:.85rem; }
.visit-stamp-goal-readonly{ margin:2px 0 12px; font-size:.85rem; color:var(--brown); font-weight:700; }
.visit-stamp-modal-stats{ display:flex; flex-direction:column; gap:4px; width:100%; margin:4px 0 12px; text-align:center; font-size:.85rem; color:var(--muted); }
.visit-stamp-modal-stats p{ margin:0; }
.visit-stamp-modal-headline{ font-size:1rem; font-weight:800; color:var(--brown); }
.visit-stamp-modal-goalpct{ font-weight:700; color:var(--accent-text, var(--accent-deep)); }
.visit-stamp-modal-check{ color:var(--accent-deep); font-weight:700; text-align:center; }
```

주: `--accent-text` 는 실제 존재하는 토큰(`styles.css:30`)이지만 Global Constraints 목록엔 안 적혀 있으니 fallback 을 붙여 안전하게. 정 불안하면 `var(--accent-deep)` 단독 사용.

- [ ] **Step 5: 빌드 + 회귀 테스트**

Run: `npm run build && npm test`
Expected: 빌드 성공, 테스트 0 fail (T2 이후 총수 유지).

- [ ] **Step 6: 수동 확인 (`npm run dev`, 불가 시 diff 정적 검토)**

- 본인 홈 밴드: `스탬프 x/15` + 바(`목표 달성률 y%`) + `n/5개 구 목표 완료`.
- 밴드 탭 → 모달: 목표 프리셋 `구마다 1곳/3곳/5곳/직접`. `5곳` 누르면 헤드라인이 `스탬프 x/25`로 즉시 갱신. `직접` → 숫자 입력, `25` 넣으면 20으로 클램프. 새로고침해도 유지(`profiles`).
- 친구 → 친구 상세("OO님의 마이페이지"): 헤더 바로 아래·"찜한 빵 목록" 위에 밴드. 모달엔 프리셋 없이 `목표: 구마다 N곳`(그 친구 값). 기록장 진입 시 밴드 없음.
- JSX 중첩: `friendDetail` 의 `.mypage-panel` 안에 헤더 div, 밴드(자기닫힘), 메뉴 div 3형제 — 균형 확인.

- [ ] **Step 7: 커밋**

```bash
git add src/pages/MyPage.jsx src/styles.css
git commit -m "feat: 친구 스탬프 밴드를 친구 상세 첫 화면으로 이동 + 목표 UI 스타일 (이슈 #63)"
```

---

## Self-Review

**1. Spec coverage:**

| 스펙 항목 | 태스크 |
|-----------|--------|
| §1 `profiles.stamp_target` 컬럼 + check(1..20) + 컬럼 grant, idempotent | T1 |
| §2 `useStampTarget(targetUserId)` — 조회(본인/친구) + `setTarget`(본인만, 클램프, 낙관적+롤백), alive 가드 | T3 |
| §3 `computeVisitStamps(entries,{targetPerDistrict,verifiedOnly})` 새 반환, 클램프, `completedSlots=min(count,target)`, 전체 `goalPct` 100 상한, `verifiedOnly` 필터 | T2 |
| §3 테스트 목록(빈/ null / 4곳캡 / 중복 / 미분류 / 스펙예제 / 클램프 / 100상한 / verifiedOnly) | T2 Step 1 |
| §4 모달 props `{stamp,target,onTargetChange,editable,nickname,onClose}`, 목표 프리셋(본인)/읽기전용(친구), 구별 goalPct 채움, 요약 4항목, 구별목록 `completedSlots/target`+체크, 공유버튼 없음 | T4 |
| §4 기존 모달 구조·라벨·vectorEffect·max-height 유지 | T4 Step 1 (코드에 포함) |
| §5 밴드 `useStampTarget` 배선, `useMemo([entries,target])`, 헤드라인 `스탬프 c/t` + `목표 달성률 %` + `n/5개 구 목표 완료`, 바=goalPct, 모달에 editable=!targetUserId | T5 |
| §6.1 `friendDetail` 헤더↔메뉴 사이 밴드 | T6 Step 1 |
| §6.2 `friendDiary` 원상복구(`.mypage-friend-diary` 래퍼 제거) | T6 Step 2 |
| §6.3 홈 밴드 불변 | T6 Step 3 |
| §7 `.mypage-friend-diary` 삭제, 목표 컨트롤/요약/행 그리드 규칙, 기존 토큰만 | T6 Step 4 |
| §8 데이터 흐름 | T5 (통합 지점) |
| §9 테스트/수동 | T2 Step 1·5, T6 Step 5·6 |
| 용어 개편(방문도→목표 달성률, 정복→구 목표 완료) | T4·T5 JSX 텍스트 |

갭 없음.

**2. Placeholder scan:** "TBD"/"TODO"/"적절히" 없음. 모든 코드 스텝에 전체 코드 블록. T6 Step 4(c)의 `--accent-text` fallback 은 구체적 지시(존재하는 토큰이나 목록 밖 → fallback 부착).

**3. Type consistency:**
- `computeVisitStamps(entries, {targetPerDistrict, verifiedOnly})` — T2 정의. T5 가 `{ targetPerDistrict: target }` 로 호출. ✓
- 반환 키 `perDistrict[{name,count,target,completedSlots,goalPct,completed}]`, `visitedBakeryCount`, `completedSlots`, `totalSlots`, `goalPct`, `completedDistrictCount` — T2 정의. T4 는 `stamp.completedSlots/totalSlots/goalPct/completedDistrictCount/visitedBakeryCount` 및 `d.goalPct/completedSlots/target/completed` 소비. T5 는 `stamp.completedSlots/totalSlots/goalPct/completedDistrictCount` 및 `d.goalPct` 소비. ✓ 기존 `overallPct`/`conqueredCount` 참조 없음(재작성으로 제거). ✓
- `useStampTarget(targetUserId) → {target,setTarget,loading}` — T3 정의. T5 가 `{ target, setTarget }` 소비, `setTarget` 를 모달 `onTargetChange` 로 전달. ✓
- 모달 props `{stamp,target,onTargetChange,editable,nickname,onClose}` — T4 정의, T5 가 정확히 그 이름으로 전달. ✓
- `DISTRICT_PATHS` 항목 `{name,d,cx,cy}` — 기존(fix wave에서 cx/cy 추가됨), T4 가 `d` 와 `cx,cy` 소비. ✓
- `VisitStampBand` props `{targetUserId,nickname}` — T5 정의, T6 이 홈은 무props, `friendDetail` 은 `targetUserId`+`nickname`. ✓
- `useStampTarget` 는 `supabase.from('profiles').select('stamp_target')` — T1 이 그 컬럼을 만든다. 순서상 T1 이 먼저지만 코드 컴파일은 T1 없이도 됨(런타임/수동확인만 의존). ✓

이슈 없음.
