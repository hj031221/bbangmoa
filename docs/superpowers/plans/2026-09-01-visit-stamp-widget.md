# 방문 스탬프 위젯 (이슈 #63 1단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기록장에 남긴 빵집 좌표를 대전 5개 구 경계와 대조해 구별 방문도를 파생하고, 마이페이지 홈·모달·친구 기록장 상단에 전체폭 스탬프 위젯으로 보여준다.

**Architecture:** 순수 함수 2개(`districtOf` 좌표→구, `computeVisitStamps` 기록배열→집계)를 `src/lib`에 두고 `node --test`로 검증한다. `DISTRICT_RINGS`를 로드 시 SVG 좌표계로 투영하는 모듈(`daejeonStampPaths.js`)이 지도 path를 제공한다. 표시 계층은 `VisitStampBand`(띠) + `VisitStampModal`(상세)이며, 모달은 기존 `CourseNameModal` 패턴(auth-modal 공용 클래스, Escape/배경 닫기, body 스크롤 잠금)을 그대로 따른다. DB 변경 없음.

**Tech Stack:** React 18 (함수 컴포넌트, hooks), Vite, `node:test` + `node:assert/strict`, `createPortal`. 기존 `useDiaryEntries` 훅, `src/data/daejeonDistricts.js`의 `DISTRICT_RINGS`.

**Spec:** `docs/superpowers/specs/2026-09-01-visit-stamp-widget-design.md`

## Global Constraints

- **DB 무변경.** `diary_entries` 컬럼 추가, RPC, RLS, Storage, Edge Function 일절 없음 (2·3단계 범위).
- **테스트 러너:** `npm test` = `node --test "src/**/*.test.js"`. 테스트는 대상 파일 옆에 `<name>.test.js`로 둔다.
- **ESM import 확장자:** `node --test` 그래프에 들어가는 `.js` 파일(및 그 의존)은 import에 `.js` 확장자를 **명시**한다 (`../data/daejeonDistricts.js`). `.jsx` 컴포넌트는 기존 관례대로 확장자 없이 import한다 (`./VisitStampModal`).
- **구 정규 순서:** 항상 `Object.keys(DISTRICT_RINGS)` 순서 = `['동구','중구','서구','유성구','대덕구']`. 분모는 항상 5.
- **`count` 정의:** 구별로 방문한 **서로 다른 빵집 id 개수** (`entry.bakery_id ?? entry.bakery?.id`). 같은 빵집 중복 기록은 1.
- **1단계 분자:** `verified` 컬럼이 없으므로 **전체 기록**을 센다. 2단계에서 시그니처 확장 예정 — 주석으로 명시.
- **색:** 기존 토큰 재사용. `--accent #F97658`, `--accent-deep`, `--brown #705945`, `--gold #FFB94A`, `--muted #BB9B74`, `--line #E2C1A3`, `--card #FFFFFF`, `--card2 #F6DBA8`, `--ink #4C310D`. 새 토큰 추가 금지 (이번 범위에선 불필요).
- **커밋 메시지 꼬리말:**
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GBx7nwPNfEN3onS6Uv4v9W
  ```

---

## File Structure

| 파일 | 역할 |
|------|------|
| `src/lib/districtFromPoint.js` (신설) | `districtOf({lat,lng}) → 구이름\|null`. ray-casting point-in-polygon. |
| `src/lib/districtFromPoint.test.js` (신설) | 구별 대표점 5 + 경계 밖 1점. |
| `src/lib/visitStamps.js` (신설) | `computeVisitStamps(entries) → {perDistrict, overallPct, conqueredCount}`. |
| `src/lib/visitStamps.test.js` (신설) | 3곳 캡 / 중복 제거 / 미분류 제외 / 빈 입력 / 평균. |
| `src/components/mypage/daejeonStampPaths.js` (신설) | `DISTRICT_RINGS` → SVG. `STAMP_VIEWBOX`, `DISTRICT_PATHS`, `projectRing`. 로드 시 계산. |
| `src/components/mypage/daejeonStampPaths.test.js` (신설) | path 5개 형식 + 좌표 범위. |
| `src/components/mypage/VisitStampModal.jsx` (신설) | 상세 모달 (확대 SVG + 구별 목록). CourseNameModal 패턴. |
| `src/components/mypage/VisitStampBand.jsx` (신설) | 전체폭 띠. 미니 SVG + 전체 % + 진행 바 + 정복 수. 탭 → 모달. |
| `src/pages/MyPage.jsx` (수정) | 홈(heading↔grid 사이) + `friendDiary` 분기에 띠 삽입. |
| `src/styles.css` (수정) | `.visit-stamp-*`, `.mypage-friend-diary` 규칙. |

---

## Task 1: `districtOf` — 좌표를 대전 5개 구로 분류

**Files:**
- Create: `src/lib/districtFromPoint.js`
- Test: `src/lib/districtFromPoint.test.js`

**Interfaces:**
- Consumes: `DISTRICT_RINGS` from `src/data/daejeonDistricts.js` — `{ '동구': [[lat,lng], …], … }`, 5개 키.
- Produces: `districtOf(point: {lat:number, lng:number} | null | undefined) → '동구'|'중구'|'서구'|'유성구'|'대덕구'|null`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/districtFromPoint.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { districtOf } from './districtFromPoint.js'

// 각 구 내부의 대표 좌표 (구 중심 인근, 실제 링과 대조해 확정한 값)
const SAMPLES = {
  동구: { lat: 36.331, lng: 127.434 },   // 대전역 인근
  중구: { lat: 36.3277, lng: 127.4276 }, // 성심당 본점
  서구: { lat: 36.3515, lng: 127.3781 }, // 둔산동
  유성구: { lat: 36.362, lng: 127.356 }, // 유성 온천 인근
  대덕구: { lat: 36.428, lng: 127.415 }, // 오정동 인근
}

test('각 구 대표 좌표가 자기 구로 분류된다', () => {
  for (const [name, point] of Object.entries(SAMPLES)) {
    assert.equal(districtOf(point), name, `${name} 대표점이 ${districtOf(point)} 로 분류됨`)
  }
})

test('대전 경계 밖 좌표는 null', () => {
  assert.equal(districtOf({ lat: 37.5665, lng: 126.978 }), null) // 서울
})

test('좌표가 없거나 숫자가 아니면 null', () => {
  assert.equal(districtOf(null), null)
  assert.equal(districtOf(undefined), null)
  assert.equal(districtOf({ lat: undefined, lng: 127.4 }), null)
  assert.equal(districtOf({ lat: NaN, lng: NaN }), null)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/lib/districtFromPoint.test.js`
Expected: FAIL — `districtOf`를 찾을 수 없음 (모듈 없음).

- [ ] **Step 3: 최소 구현**

`src/lib/districtFromPoint.js`:

```js
import { DISTRICT_RINGS } from '../data/daejeonDistricts.js'

// ray-casting 홀짝 판정. ring = [[lat,lng], …]. lat 을 y, lng 을 x 로 취급한다
// (ray-casting 은 좌표계 방향과 무관하므로 축을 뒤집어도 결과가 같다).
function pointInRing(lat, lng, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0]
    const xi = ring[i][1]
    const yj = ring[j][0]
    const xj = ring[j][1]
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// 좌표를 대전 5개 구 중 하나로 분류. 어느 구에도 안 들어가면 null.
// DISTRICT_RINGS 삽입 순서로 순회하며 첫 번째로 포함하는 구를 반환한다(경계 공유 시 결정적).
export function districtOf(point) {
  if (!point) return null
  const { lat, lng } = point
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  for (const [name, ring] of Object.entries(DISTRICT_RINGS)) {
    if (pointInRing(lat, lng, ring)) return name
  }
  return null
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/lib/districtFromPoint.test.js`
Expected: PASS (3 tests).
만약 특정 구 대표점이 실패하면 → `src/data/daejeonDistricts.js`의 해당 링 좌표들을 보고 그 구 안쪽에 확실히 들어가는 좌표로 `SAMPLES` 값을 조정한다(구현이 아니라 테스트 픽스처를 고친다). 경계 밖/null 테스트는 그대로여야 한다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/districtFromPoint.js src/lib/districtFromPoint.test.js
git commit -m "feat: 좌표를 대전 5개 구로 분류하는 districtOf (이슈 #63)"
```

---

## Task 2: `computeVisitStamps` — 기록 배열에서 구별 방문도 집계

**Files:**
- Create: `src/lib/visitStamps.js`
- Test: `src/lib/visitStamps.test.js`

**Interfaces:**
- Consumes:
  - `districtOf` from `./districtFromPoint.js` (Task 1)
  - `DISTRICT_RINGS` from `../data/daejeonDistricts.js` (키 순서만 사용)
  - `entries`: `useDiaryEntries().entries` 형태의 배열. 각 원소는 `{ bakery_id?: string, bakery?: { id?: string, lat?: number, lng?: number, … }, … }`.
- Produces:
  ```
  computeVisitStamps(entries: Array | null | undefined) → {
    perDistrict: Array<{ name: string, count: number, pct: number }>,  // 5개, 정규 순서
    overallPct: number,      // 0~100, 5개 pct 평균 반올림
    conqueredCount: number,  // pct === 100 인 구 수, 0~5
  }
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/visitStamps.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeVisitStamps } from './visitStamps.js'

// 중구 안 좌표 (Task 1 테스트에서 검증된 값)
const JUNG = { lat: 36.3277, lng: 127.4276 }
const SEO = { lat: 36.3515, lng: 127.3781 }

function entry(id, coords) {
  return { bakery_id: id, bakery: { id, lat: coords?.lat, lng: coords?.lng } }
}

test('빈 입력 — 5개 구 전부 0, overallPct 0, conqueredCount 0', () => {
  const r = computeVisitStamps([])
  assert.equal(r.perDistrict.length, 5)
  assert.deepEqual(r.perDistrict.map((d) => d.name), ['동구', '중구', '서구', '유성구', '대덕구'])
  assert.ok(r.perDistrict.every((d) => d.count === 0 && d.pct === 0))
  assert.equal(r.overallPct, 0)
  assert.equal(r.conqueredCount, 0)
})

test('null/undefined 입력도 빈 입력처럼 처리', () => {
  assert.equal(computeVisitStamps(null).overallPct, 0)
  assert.equal(computeVisitStamps(undefined).conqueredCount, 0)
})

test('한 구에 서로 다른 빵집 4곳 → 그 구 count 4, pct 100, 정복', () => {
  const r = computeVisitStamps([
    entry('b1', JUNG), entry('b2', JUNG), entry('b3', JUNG), entry('b4', JUNG),
  ])
  const jung = r.perDistrict.find((d) => d.name === '중구')
  assert.equal(jung.count, 4)
  assert.equal(jung.pct, 100)
  assert.equal(r.conqueredCount, 1)
  assert.equal(r.overallPct, 20) // 100 + 0*4 = 100 / 5
})

test('같은 빵집 3번 기록 → count 1, pct 33 (중복 제거)', () => {
  const r = computeVisitStamps([entry('b1', JUNG), entry('b1', JUNG), entry('b1', JUNG)])
  const jung = r.perDistrict.find((d) => d.name === '중구')
  assert.equal(jung.count, 1)
  assert.equal(jung.pct, 33)
  assert.equal(r.conqueredCount, 0)
})

test('좌표 없는 기록 / 경계 밖 기록은 제외, 분모는 항상 5', () => {
  const r = computeVisitStamps([
    entry('b1', JUNG),
    entry('b2', null),                       // 좌표 없음
    entry('b3', { lat: 37.5665, lng: 126.978 }), // 서울 (경계 밖)
  ])
  assert.equal(r.perDistrict.find((d) => d.name === '중구').count, 1)
  const total = r.perDistrict.reduce((s, d) => s + d.count, 0)
  assert.equal(total, 1) // b2, b3 는 어느 count 에도 안 잡힘
})

test('두 구에 각 3곳 → 두 구 정복, overallPct 40', () => {
  const r = computeVisitStamps([
    entry('a1', JUNG), entry('a2', JUNG), entry('a3', JUNG),
    entry('c1', SEO), entry('c2', SEO), entry('c3', SEO),
  ])
  assert.equal(r.conqueredCount, 2)
  assert.equal(r.overallPct, 40) // (100 + 100 + 0 + 0 + 0) / 5
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/lib/visitStamps.test.js`
Expected: FAIL — `computeVisitStamps`를 찾을 수 없음.

- [ ] **Step 3: 최소 구현**

`src/lib/visitStamps.js`:

```js
import { districtOf } from './districtFromPoint.js'
import { DISTRICT_RINGS } from '../data/daejeonDistricts.js'

const DISTRICT_NAMES = Object.keys(DISTRICT_RINGS)
const CONQUER_THRESHOLD = 3 // 이 수 이상의 서로 다른 빵집이면 그 구 100%(정복)

// 기록장 배열에서 구별 방문도를 파생한다.
// count = 구별로 방문한 서로 다른 빵집 id 수 (중복 기록은 1). 분모는 항상 5개 구.
// 1단계는 전체 기록을 센다. 2단계 병합 시 verified 필터 인자를 추가하며 시그니처가 바뀐다.
export function computeVisitStamps(entries) {
  const byDistrict = new Map(DISTRICT_NAMES.map((name) => [name, new Set()]))

  for (const entry of entries ?? []) {
    const bakery = entry?.bakery
    const district = districtOf({ lat: bakery?.lat, lng: bakery?.lng })
    if (!district) continue
    const bakeryId = entry?.bakery_id ?? bakery?.id
    if (bakeryId == null) continue
    byDistrict.get(district).add(bakeryId)
  }

  const perDistrict = DISTRICT_NAMES.map((name) => {
    const count = byDistrict.get(name).size
    const pct = Math.round(Math.min(count / CONQUER_THRESHOLD, 1) * 100)
    return { name, count, pct }
  })

  const overallPct = Math.round(
    perDistrict.reduce((sum, d) => sum + d.pct, 0) / DISTRICT_NAMES.length,
  )
  const conqueredCount = perDistrict.filter((d) => d.pct === 100).length

  return { perDistrict, overallPct, conqueredCount }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/lib/visitStamps.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: 전체 테스트 회귀 확인**

Run: `npm test`
Expected: 기존 테스트 + 신규 2개 파일 모두 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/visitStamps.js src/lib/visitStamps.test.js
git commit -m "feat: 기록 배열에서 구별 방문도 집계하는 computeVisitStamps (이슈 #63)"
```

---

## Task 3: `daejeonStampPaths` — DISTRICT_RINGS를 SVG 좌표계로 투영

**Files:**
- Create: `src/components/mypage/daejeonStampPaths.js`
- Test: `src/components/mypage/daejeonStampPaths.test.js`

**Interfaces:**
- Consumes: `DISTRICT_RINGS` from `../../data/daejeonDistricts.js`
- Produces:
  - `projectRing(ring: Array<[lat,lng]>) → string` — `"M x0 y0 Lx1 y1 … Z"` (좌표 소수점 2자리)
  - `STAMP_VIEWBOX: string` — `"0 0 <W> <H>"` (W=320 고정, H는 계산값)
  - `DISTRICT_PATHS: ReadonlyArray<{ name: string, d: string }>` — `DISTRICT_RINGS` 순서, 동결

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/mypage/daejeonStampPaths.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DISTRICT_RINGS } from '../../data/daejeonDistricts.js'
import { STAMP_VIEWBOX, DISTRICT_PATHS, projectRing } from './daejeonStampPaths.js'

test('DISTRICT_PATHS 는 DISTRICT_RINGS 와 같은 구를 같은 순서로 담는다', () => {
  assert.deepEqual(
    DISTRICT_PATHS.map((p) => p.name),
    Object.keys(DISTRICT_RINGS),
  )
})

test('각 path d 는 M 으로 시작하고 Z 로 끝난다', () => {
  for (const { name, d } of DISTRICT_PATHS) {
    assert.match(d, /^M[-\d.]/, `${name}`)
    assert.ok(d.trim().endsWith('Z'), `${name}: Z 로 안 끝남`)
  }
})

test('모든 좌표가 유한하고 viewBox 범위 안에 있다', () => {
  const [, , w, h] = STAMP_VIEWBOX.split(' ').map(Number)
  assert.ok(w > 0 && h > 0)
  for (const { name, d } of DISTRICT_PATHS) {
    const nums = d.match(/-?\d+(\.\d+)?/g).map(Number)
    assert.ok(nums.length > 0 && nums.length % 2 === 0, `${name}: 좌표쌍 아님`)
    for (let i = 0; i < nums.length; i += 2) {
      const x = nums[i]
      const y = nums[i + 1]
      assert.ok(Number.isFinite(x) && x >= 0 && x <= w, `${name}: x=${x} 범위 밖`)
      assert.ok(Number.isFinite(y) && y >= 0 && y <= h, `${name}: y=${y} 범위 밖`)
    }
  }
})

test('projectRing 은 점 개수만큼 좌표쌍을 만든다', () => {
  const ring = DISTRICT_RINGS['중구']
  const d = projectRing(ring)
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number)
  assert.equal(nums.length, ring.length * 2)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/components/mypage/daejeonStampPaths.test.js`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현**

`src/components/mypage/daejeonStampPaths.js`:

```js
import { DISTRICT_RINGS } from '../../data/daejeonDistricts.js'

// DISTRICT_RINGS([lat,lng] 링)를 로드 시 한 번 SVG 좌표계로 투영한다.
// 5개 구 전체의 bbox 를 공유해 지도가 서로 맞물리게 하고, 위도에 따른 경도 축소
// (cos(lat))를 보정해 형태 왜곡을 줄인다. y 는 북이 위로 오도록 뒤집는다.
const WIDTH = 320
const PAD = 8

const rings = Object.values(DISTRICT_RINGS)
let minLat = Infinity
let maxLat = -Infinity
let minLng = Infinity
let maxLng = -Infinity
for (const ring of rings) {
  for (const [lat, lng] of ring) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
}

const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) // 경도 1도의 가로 실제 비율
const spanX = (maxLng - minLng) * kx
const spanY = maxLat - minLat
const scale = (WIDTH - 2 * PAD) / spanX
const HEIGHT = Math.round(spanY * scale + 2 * PAD)

const round2 = (n) => Math.round(n * 100) / 100

function projectPoint([lat, lng]) {
  const x = PAD + (lng - minLng) * kx * scale
  const y = PAD + (maxLat - lat) * scale // 북이 위
  return `${round2(x)} ${round2(y)}`
}

export function projectRing(ring) {
  return (
    'M' +
    ring.map((pt, i) => `${i === 0 ? '' : 'L'}${projectPoint(pt)}`).join(' ') +
    ' Z'
  )
}

export const STAMP_VIEWBOX = `0 0 ${WIDTH} ${HEIGHT}`

export const DISTRICT_PATHS = Object.freeze(
  Object.entries(DISTRICT_RINGS).map(([name, ring]) => ({ name, d: projectRing(ring) })),
)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/components/mypage/daejeonStampPaths.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/components/mypage/daejeonStampPaths.js src/components/mypage/daejeonStampPaths.test.js
git commit -m "feat: DISTRICT_RINGS 를 SVG path 로 투영하는 daejeonStampPaths (이슈 #63)"
```

---

## Task 4: `VisitStampModal` — 스탬프 상세 모달

**Files:**
- Create: `src/components/mypage/VisitStampModal.jsx`

**Interfaces:**
- Consumes:
  - `STAMP_VIEWBOX`, `DISTRICT_PATHS` from `./daejeonStampPaths` (Task 3)
  - props: `{ stamp: ReturnType<computeVisitStamps>, nickname?: string, onClose: () => void }`
- Produces: default export `VisitStampModal` React 컴포넌트 (Task 5가 렌더)

참고: 이 프로젝트는 컴포넌트 단위 테스트 관례가 없다. 검증은 `npm run build`(vite) 통과 + Task 6의 수동 확인으로 한다. 구조는 `src/components/tour/CourseNameModal.jsx`를 그대로 참고한다.

- [ ] **Step 1: 컴포넌트 작성**

`src/components/mypage/VisitStampModal.jsx`:

```jsx
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from './daejeonStampPaths'

// 방문 스탬프 상세 모달. CourseNameModal 과 같은 구조(auth-modal 공용 클래스,
// Escape/배경 클릭 닫기, body 스크롤 잠금)를 따른다. stamp = computeVisitStamps() 결과.
// nickname 이 있으면 친구 것(제목만 달라짐), 없으면 본인 것. 공유 버튼은 3단계.
function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100 // pct 0 이어도 형태가 보이도록 최소 0.15
}

export default function VisitStampModal({ stamp, nickname, onClose }) {
  // onClose 는 부모가 매 렌더 새로 만드는 인라인 함수라 deps 에 넣으면 리스너를 뗐다 붙인다.
  // ref 로 최신 함수만 받고, effect 는 마운트/언마운트에만 반응한다.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.pct]))
  const title = nickname ? `${nickname}님의 대전 빵 지도` : '내 대전 빵 지도'

  return createPortal(
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" aria-label="닫기" onClick={onClose}>
          ✕
        </button>
        <div className="auth-modal-copy">
          <h3 className="auth-modal-title">{title}</h3>
        </div>

        <svg
          className="visit-stamp-modal-map"
          viewBox={STAMP_VIEWBOX}
          role="img"
          aria-label="대전 5개 구 방문도"
        >
          {DISTRICT_PATHS.map(({ name, d }) => (
            <path
              key={name}
              d={d}
              fill="var(--accent)"
              fillOpacity={fillOpacity(pctByName[name] ?? 0)}
              stroke="var(--brown)"
              strokeWidth="1"
            />
          ))}
        </svg>

        <ul className="visit-stamp-modal-list">
          {stamp.perDistrict.map((d) => (
            <li key={d.name} className="visit-stamp-modal-row">
              <span className="visit-stamp-modal-name">{d.name}</span>
              <span className="visit-stamp-bar">
                <span className="visit-stamp-bar-fill" style={{ width: `${d.pct}%` }} />
              </span>
              <span className="visit-stamp-modal-pct">{d.pct}%</span>
            </li>
          ))}
        </ul>

        <p className="visit-stamp-modal-summary">
          대전 {stamp.overallPct}% · {stamp.conqueredCount}/5 구 정복
        </p>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: 빌드 통과 확인**

Run: `npm run build`
Expected: 성공 (vite build 에러 없음). 아직 어디서도 import 안 하므로 트리셰이킹으로 번들에서 빠질 수 있음 — 문법/타입 에러만 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/components/mypage/VisitStampModal.jsx
git commit -m "feat: 방문 스탬프 상세 모달 VisitStampModal (이슈 #63)"
```

---

## Task 5: `VisitStampBand` — 전체폭 스탬프 띠

**Files:**
- Create: `src/components/mypage/VisitStampBand.jsx`

**Interfaces:**
- Consumes:
  - `useDiaryEntries` from `../../hooks/useDiaryEntries` — 반환 `{ entries, loading, … }`
  - `computeVisitStamps` from `../../lib/visitStamps` (Task 2)
  - `STAMP_VIEWBOX`, `DISTRICT_PATHS` from `./daejeonStampPaths` (Task 3)
  - `VisitStampModal` from `./VisitStampModal` (Task 4)
  - props: `{ targetUserId?: string, nickname?: string }` — `targetUserId` 있으면 친구 것
- Produces: default export `VisitStampBand` React 컴포넌트 (Task 6가 MyPage에서 렌더)

- [ ] **Step 1: 컴포넌트 작성**

`src/components/mypage/VisitStampBand.jsx`:

```jsx
import { useMemo, useState } from 'react'
import { useDiaryEntries } from '../../hooks/useDiaryEntries'
import { computeVisitStamps } from '../../lib/visitStamps'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from './daejeonStampPaths'
import VisitStampModal from './VisitStampModal'

// 마이페이지 홈 / 친구 기록장 상단의 전체폭 방문 스탬프 띠.
// targetUserId 가 있으면 그 친구 기록장으로 계산한다(useDiaryEntries 가 이미 지원).
// 로그인 게이트는 불필요 — 이 컴포넌트는 MyPage 의 로그인된 분기에서만 마운트된다.
function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100
}

export default function VisitStampBand({ targetUserId, nickname }) {
  const { entries, loading } = useDiaryEntries(targetUserId)
  const stamp = useMemo(() => computeVisitStamps(entries), [entries])
  const [open, setOpen] = useState(false)

  const pending = loading && entries.length === 0
  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.pct]))

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
            />
          ))}
        </svg>

        <span className="visit-stamp-band-body">
          <span className="visit-stamp-band-top">
            <strong>대전 {stamp.overallPct}%</strong>
            <span className="visit-stamp-band-conquer">{stamp.conqueredCount}/5 구 정복</span>
          </span>
          <span className="visit-stamp-bar">
            <span
              className="visit-stamp-bar-fill"
              style={{ width: `${stamp.overallPct}%` }}
            />
          </span>
        </span>
      </button>

      {open && (
        <VisitStampModal stamp={stamp} nickname={nickname} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
```

- [ ] **Step 2: 빌드 통과 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: 커밋**

```bash
git add src/components/mypage/VisitStampBand.jsx
git commit -m "feat: 전체폭 방문 스탬프 띠 VisitStampBand (이슈 #63)"
```

---

## Task 6: MyPage 삽입 + 스타일

**Files:**
- Modify: `src/pages/MyPage.jsx` (import 추가; 홈 `return` 블록 line ~137-145; `friendDiary` 분기 line ~112-122)
- Modify: `src/styles.css` (파일 끝에 규칙 추가)

**Interfaces:**
- Consumes: `VisitStampBand` from `../components/mypage/VisitStampBand` (Task 5)

- [ ] **Step 1: `MyPage.jsx` import 추가**

기존 mypage import들 아래(`import FriendsPanel from '../components/mypage/FriendsPanel'` 다음 줄)에:

```jsx
import VisitStampBand from '../components/mypage/VisitStampBand'
```

- [ ] **Step 2: `friendDiary` 분기 래핑**

기존:

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

변경:

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

- [ ] **Step 3: 홈 `return` 블록에 띠 삽입**

기존 `.mypage-home-main` 내부:

```jsx
        <div className="mypage-home-heading">
          <h2>마이페이지</h2>
          <p>마음에 들었던 빵과 코스를 찜하고 기록장에 그 날의 빵을 기록해보세요!</p>
        </div>
        <div className="mypage-preview-grid">
```

변경 (heading `</div>` 와 `mypage-preview-grid` 사이에 한 줄):

```jsx
        <div className="mypage-home-heading">
          <h2>마이페이지</h2>
          <p>마음에 들었던 빵과 코스를 찜하고 기록장에 그 날의 빵을 기록해보세요!</p>
        </div>
        <VisitStampBand />
        <div className="mypage-preview-grid">
```

- [ ] **Step 4: `src/styles.css` 규칙 추가**

파일 맨 끝에 추가:

```css
/* ===== 이슈 #63 1단계 — 방문 스탬프 위젯 ===== */
.visit-stamp-band{ display:flex; align-items:center; gap:14px; width:100%; margin:0 0 20px; padding:12px 16px;
  border:1.5px solid var(--line); border-radius:16px; background:var(--card); cursor:pointer; text-align:left;
  transition:border-color .15s, box-shadow .15s; }
.visit-stamp-band:hover{ border-color:var(--accent); box-shadow:0 8px 20px rgba(76,49,13,.08); }
.visit-stamp-band:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
.visit-stamp-band:disabled{ opacity:.6; cursor:default; }
.visit-stamp-band-map{ flex:0 0 auto; width:60px; height:auto; }
.visit-stamp-band-body{ flex:1 1 auto; display:flex; flex-direction:column; gap:8px; min-width:0; }
.visit-stamp-band-top{ display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
.visit-stamp-band-top strong{ color:var(--brown); font-size:1rem; }
.visit-stamp-band-conquer{ color:var(--muted); font-size:.82rem; white-space:nowrap; }
.visit-stamp-bar{ display:block; width:100%; height:8px; border-radius:999px; background:var(--card2); overflow:hidden; }
.visit-stamp-bar-fill{ display:block; height:100%; background:linear-gradient(90deg, var(--gold), var(--accent)); transition:width .25s; }
.visit-stamp-modal-map{ width:100%; height:auto; margin:4px 0 14px; }
.visit-stamp-modal-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; width:100%; }
.visit-stamp-modal-row{ display:grid; grid-template-columns:52px 1fr 40px; align-items:center; gap:10px; font-size:.85rem; color:var(--ink); }
.visit-stamp-modal-row .visit-stamp-bar{ height:8px; }
.visit-stamp-modal-pct{ text-align:right; color:var(--muted); }
.visit-stamp-modal-summary{ margin:14px 0 0; font-size:.85rem; font-weight:700; color:var(--brown); text-align:center; }
.mypage-friend-diary{ display:flex; flex-direction:column; }
```

- [ ] **Step 5: 빌드 + 전체 테스트**

Run: `npm run build && npm test`
Expected: 빌드 성공, 모든 테스트 PASS.

- [ ] **Step 6: 수동 확인 (`npm run dev`)**

- 로그인 → 마이페이지 홈: 인사말과 프리뷰 그리드 **사이**에 전체폭 띠. 미니 대전 지도 + "대전 N%" + 진행 바 + "M/5 구 정복". 기록장에 빵집 기록이 있으면 그 구가 채워져 보인다.
- 띠 클릭 → auth-modal 스타일 다이얼로그. 확대된 5구 SVG + 구별 % 목록 + 하단 요약. ✕ / 배경 클릭 / Esc 로 닫힘. 열려 있는 동안 body 스크롤 잠김.
- 친구 → 친구 상세 → 기록장: 패널 위에 같은 띠(읽기 전용, 그 친구 데이터). 클릭 시 "{닉네임}님의 대전 빵 지도" 제목 모달.
- 기록이 하나도 없으면: 전체 0%, 진행 바 빈 상태, "0/5 구 정복". 로딩 순간엔 버튼 비활성.

- [ ] **Step 7: 커밋**

```bash
git add src/pages/MyPage.jsx src/styles.css
git commit -m "feat: 마이페이지 홈·친구 기록장에 방문 스탬프 띠 삽입 (이슈 #63)"
```

---

## Self-Review

**1. Spec coverage:**

| 스펙 항목 | 태스크 |
|-----------|--------|
| §1 `districtFromPoint.js` (`districtOf`, ray-casting, null 가드, 첫 포함 링) | Task 1 |
| §1.3 구별 대표점 5 + 경계 밖 1 테스트 | Task 1 Step 1 |
| §2 `visitStamps.js` (`computeVisitStamps`, count 정의, 3캡, 미분류 제외, 분모 5) | Task 2 |
| §2.3 1단계 전체 기록, 시그니처 주석 | Task 2 Step 3 (주석) |
| §2.4 3곳 캡 / 중복 제거 / 미분류 제외 / 빈 입력 / 평균 테스트 | Task 2 Step 1 |
| §3 `daejeonStampPaths.js` (로드 시 계산, 공유 bbox, y 뒤집기, `STAMP_VIEWBOX`, `DISTRICT_PATHS`, `projectRing`) | Task 3 |
| §3.3 path 5개 형식 + 범위 테스트 | Task 3 Step 1 |
| §4 `VisitStampBand.jsx` (props, useMemo, 미니 SVG 채도, 진행 바, 정복 수, 탭→모달, 로딩 플레이스홀더) | Task 5 |
| §5 `VisitStampModal.jsx` (CourseNameModal 패턴, portal, ✕/배경/Esc, 스크롤 잠금, 제목, 구별 목록, 요약, 공유 버튼 없음) | Task 4 |
| §6.1 홈 heading↔grid 사이 삽입 | Task 6 Step 3 |
| §6.2 friendDiary 분기 래핑 + import | Task 6 Step 1-2 |
| §7 `.visit-stamp-*`, `.mypage-friend-diary` 규칙, 기존 토큰 | Task 6 Step 4 |
| §8 데이터 흐름 | Task 2 + Task 5 (통합) |
| §9 테스트 3파일 + 수동 확인 | Task 1/2/3 Step 1, Task 6 Step 6 |

갭 없음.

**2. Placeholder scan:** "TBD"/"TODO"/"적절히 처리" 없음. 모든 코드 스텝에 실제 코드 블록 포함. Task 1 Step 4의 "테스트 픽스처 조정"은 플레이스홀더가 아니라 구체적 실패 대응 절차(구현 불변, 픽스처만 수정).

**3. Type consistency:**
- `districtOf(point)` — Task 1 정의, Task 2에서 `districtOf({ lat, lng })`로 호출. ✓
- `computeVisitStamps(entries) → { perDistrict:[{name,count,pct}], overallPct, conqueredCount }` — Task 2 정의, Task 4/5에서 `stamp.perDistrict` `stamp.overallPct` `stamp.conqueredCount`로 소비. ✓
- `STAMP_VIEWBOX`, `DISTRICT_PATHS`(`{name,d}`), `projectRing` — Task 3 정의, Task 4/5에서 동일 이름·형태로 소비. ✓
- `useDiaryEntries(targetUserId) → { entries, loading }` — 기존 훅(`src/hooks/useDiaryEntries.js` 실제 반환 `{ entries, loading, addEntry, updateEntry, removeEntry }`)과 일치. ✓
- `VisitStampModal` props `{ stamp, nickname, onClose }` — Task 4 정의, Task 5에서 동일하게 전달. ✓
- `VisitStampBand` props `{ targetUserId, nickname }` — Task 5 정의, Task 6에서 홈은 무props, 친구는 `targetUserId`+`nickname`. ✓
- `fillOpacity` 헬퍼 — Task 4와 Task 5에 각각 로컬 정의(동일 식). 공유 모듈로 빼지 않은 건 의도 (2줄, 파일 경계 단순 유지).

이슈 없음.
