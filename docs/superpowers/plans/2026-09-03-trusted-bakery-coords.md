# 방문 인증 좌표 서버 신뢰값 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `create_diary_entry`의 방문 인증(`verified`)을 클라이언트가 보낸 빵집 좌표가 아니라 서버가 보유한 `bakery_coords` 테이블 좌표로만 판정하게 바꿔, RPC 직접 호출을 통한 인증 위조를 차단한다.

**Architecture:** 새 `bakery_coords` 캐시 테이블(RLS 정책 없음 = 직접 접근 전면 차단)을 두고, 새 Edge Function `resolve-bakery-coords`가 `bakery_id` 접두(`tour:`/`kakao:`)에 따라 KorService2 `detailCommon2` 또는 Kakao Local 키워드 재검색으로 신뢰 좌표를 확보해 upsert 한다. 프런트는 기록 저장 RPC 직전에 이 함수를 1회 호출하고, `create_diary_entry`는 `bakery_coords`만 읽어 거리(≤150m)를 판정한다. 캐시 미스면 `verified = false`로 저장되고 기록 자체는 계속 저장된다.

**Tech Stack:** Supabase Postgres(plpgsql, RLS), Supabase Edge Functions(Deno, 원시 `fetch` + PostgREST), React 훅(`@supabase/supabase-js` `functions.invoke`), `node:test` 순수 함수 테스트.

**Spec:** `docs/superpowers/specs/2026-09-03-trusted-bakery-coords-design.md`

## Global Constraints

- **새 npm 의존성 금지.** `functions.invoke`는 `@supabase/supabase-js`(설치됨)에 내장.
- **`supabase/schema.sql`은 수동 실행 파일** — 모든 문장을 idempotent하게(`create table if not exists`, `create or replace`, `drop policy if exists` 등). 신규 SQL은 파일 맨 끝에 `-- ===== 이슈 #69 ... =====` 섹션으로 append.
- **plpgsql 함수는 `security definer` + `set search_path = public, pg_temp`** (레포 관례).
- **`create_diary_entry` 시그니처·`returns`·grant 불변.** `(jsonb, text, double precision, double precision)` → `table(id uuid, verified boolean, verified_at timestamptz)`. 거리 임계값 **150m** 유지.
- **Edge Function은 호출자에게 절대 throw 하지 않는다.** 항상 `200`, body `{ "resolved": boolean }`.
- **UI·모달·문구 변경 금지.** 프런트 변경은 `useDiaryEntries.addEntry` 내부 로직 한정.
- **테스트는 순수 JS만** (`node:test`). DB·네트워크 의존 자동 테스트 안 함 (레포 관례).
- **`DAEJEON_BBOX`**(`coordMatch.js`) = `src/config/regions.js`의 대전 `region.bbox` = `{ minLat: 36.18, maxLat: 36.5, minLng: 127.25, maxLng: 127.56 }`. Kakao rect 문자열은 `"127.25,36.18,127.56,36.5"`.
- **커밋 메시지 꼬리말:**
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Gj8GDvGL2p6Eiq31HnHxcv
  ```

---

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `supabase/schema.sql` (수정, EOF append) | `bakery_coords` 테이블 + RLS + 백필-없음 주석; `create_diary_entry` 재정의(검증부를 `bakery_coords` 조회로 교체) | 1 |
| `supabase/functions/resolve-bakery-coords/coordMatch.js` (신규) | 순수 매칭 로직 — id 파싱, 대전 bbox 게이트, Kakao/Tour 응답 → 좌표. Deno API 미사용 | 2 |
| `src/lib/resolveBakeryCoords.test.js` (신규) | `coordMatch.js` `node:test` | 2 |
| `supabase/functions/resolve-bakery-coords/index.ts` (신규) | Deno 핸들러 — 캐시 확인 → source별 외부 조회 → upsert. 항상 `{resolved:boolean}` | 3 |
| `supabase/functions/resolve-bakery-coords/README.md` (신규) | 시크릿·배포·로컬 실행 절차 | 3 |
| `supabase/config.toml` (수정) | `[functions.resolve-bakery-coords]` 엔트리(`verify_jwt = true`) | 3 |
| `src/hooks/useDiaryEntries.js` (수정, `addEntry` `47-64`) | RPC 직전 `functions.invoke('resolve-bakery-coords')` 1회, 실패 무시 | 4 |
| (배포·수동 검증) | 시크릿 등록, 함수 배포, schema 적용, 스펙 §7 5개 검증 | 5 |

---

## Task 1: `bakery_coords` 테이블 + `create_diary_entry` 재정의

**Files:**
- Modify: `supabase/schema.sql` (파일 맨 끝에 append — 현재 마지막 문장은 `alter function get_public_stamp(text) set search_path = public, pg_temp;`)

**Interfaces:**
- Consumes: 기존 `diary_entries` 스키마(`visit_lat, visit_lng, verified, verified_at` 컬럼 — #63 2단계에서 추가됨), 기존 `create_diary_entry` grant.
- Produces:
  - 테이블 `bakery_coords(bakery_id text pk, lat double precision, lng double precision, source text, fetched_at timestamptz)`.
  - `create_diary_entry(p_bakery jsonb, p_text text, p_lat double precision, p_lng double precision)` — 검증부만 교체, 시그니처/반환 동일.

- [ ] **Step 1: `schema.sql` 맨 끝에 이슈 #69 섹션을 append**

아래 블록을 파일 최하단에 그대로 추가한다.

```sql

-- ===== 이슈 #69: 방문 인증 좌표 서버 신뢰값 =====

-- 서버가 보유하는 신뢰 가능한 빵집 좌표 캐시. create_diary_entry 의 거리 검증은 오직 이
-- 테이블의 좌표만 쓰고, 클라이언트가 보낸 p_bakery.lat/lng 는 검증에 쓰지 않는다.
-- 채우는 주체: resolve-bakery-coords Edge Function (service-role 로 upsert).
create table if not exists bakery_coords (
  bakery_id  text primary key,                 -- 'tour:{contentid}' | 'kakao:{doc.id}'
  lat        double precision not null,
  lng        double precision not null,
  source     text not null check (source in ('tour', 'kakao')),
  fetched_at timestamptz not null default now()
);

alter table bakery_coords enable row level security;
-- 정책을 만들지 않는다 = authenticated/anon 직접 접근 전면 거부.
--   읽기: create_diary_entry (security definer — 함수 소유자 권한이라 RLS 우회)
--   쓰기: resolve-bakery-coords Edge Function (service-role 키 — RLS 우회)

-- 기존 verified=true 기록은 소급 재검증하지 않는다. #68 의 대전 광역 bbox 게이트로 이미
-- 대전 범위 좌표만 통과했고, 이 기능엔 아직 금전/보상이 없어 과거 데이터 위조 이득이 없다.
-- 신규 기록부터 bakery_coords 기준으로 판정한다. (필요해지면 별도 재검증 스크립트 이슈.)

create or replace function create_diary_entry(
  p_bakery jsonb,
  p_text text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns table(id uuid, verified boolean, verified_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_bakery_id text;
  v_bakery_lat double precision;
  v_bakery_lng double precision;
  v_visit_lat double precision;
  v_visit_lng double precision;
  v_distance_m double precision;
  v_verified boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_bakery is null
    or jsonb_typeof(p_bakery) <> 'object'
    or nullif(btrim(p_bakery ->> 'id'), '') is null then
    raise exception 'invalid bakery' using errcode = '22023';
  end if;

  if nullif(btrim(p_text), '') is null then
    raise exception 'text is required' using errcode = '22023';
  end if;

  v_bakery_id := p_bakery ->> 'id';

  -- GPS 좌표 새너티만 확인한다. 이건 사용자 본인 기기가 보고한 "지금 내 위치"이고,
  -- 검증이 판정하려는 대상 그 자체다(빵집 좌표와 달리 서버가 대체 출처를 가질 수 없다).
  if p_lat between -90 and 90 and p_lng between -180 and 180 then
    v_visit_lat := p_lat;
    v_visit_lng := p_lng;
  end if;

  -- 이슈 #69: 신뢰 가능한 빵집 좌표는 오직 서버가 보유한 bakery_coords 에서만 온다.
  -- 클라이언트가 보낸 p_bakery.lat/lng 는 검증에 쓰지 않는다(위조 가능).
  -- 캐시 미스(resolve-bakery-coords 가 아직 못 채웠거나 좌표 미해결)면 v_verified 는
  -- false 로 남고, 기록 자체는 그대로 저장된다.
  select lat, lng into v_bakery_lat, v_bakery_lng
    from bakery_coords
    where bakery_id = v_bakery_id;

  if v_bakery_lat is not null and v_visit_lat is not null then
    v_distance_m := 6371000 * 2 * asin(sqrt(least(1, greatest(0,
      power(sin(radians(v_visit_lat - v_bakery_lat) / 2), 2)
      + cos(radians(v_bakery_lat)) * cos(radians(v_visit_lat))
      * power(sin(radians(v_visit_lng - v_bakery_lng) / 2), 2)
    ))));
    v_verified := v_distance_m <= 150;
  end if;

  return query
    insert into diary_entries (
      user_id, bakery_id, bakery, text,
      visit_lat, visit_lng, verified, verified_at
    ) values (
      v_user_id, v_bakery_id, p_bakery, btrim(p_text),
      v_visit_lat, v_visit_lng, v_verified,
      case when v_verified then now() else null end
    )
    returning diary_entries.id, diary_entries.verified, diary_entries.verified_at;
end;
$$;

-- 시그니처가 그대로라 아래 grant/revoke 재실행은 사실상 no-op 이지만, 이 섹션만 따로
-- 실행해도 되도록 다시 명시한다 (이슈 #63 2단계 블록과 동일).
revoke execute on function create_diary_entry(jsonb, text, double precision, double precision)
  from public, anon;
grant execute on function create_diary_entry(jsonb, text, double precision, double precision)
  to authenticated;

alter function create_diary_entry(jsonb, text, double precision, double precision)
  set search_path = public, pg_temp;
```

- [ ] **Step 2: 임시 bbox 게이트가 사라졌는지 확인**

Run:
```bash
grep -n "36.0 and 36.7\|127.0 and 127.9\|p_bakery -> 'lat'" supabase/schema.sql
```
Expected: 이슈 #63 2단계 블록의 **원본** `create_diary_entry`(파일 중간)에서만 매치가 남고, 파일 끝 #69 섹션에는 매치가 없다. (원본 블록은 그대로 두고 EOF `create or replace`가 최종 정의를 덮어쓴다 — 레포의 "새 섹션 append" 관례.)

- [ ] **Step 3: 링 파리티 테스트가 여전히 통과하는지 확인** (schema.sql 텍스트를 파싱하는 기존 테스트)

Run: `npm test`
Expected: PASS — 특히 `schema.sql classify_daejeon_district 의 링 좌표가 DISTRICT_RINGS 와 완전히 일치한다`. (이 태스크는 링을 건드리지 않는다.)

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "$(cat <<'EOF'
feat: bakery_coords 테이블 + create_diary_entry 를 서버 좌표 검증으로 (이슈 #69)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gj8GDvGL2p6Eiq31HnHxcv
EOF
)"
```

---

## Task 2: `coordMatch.js` 순수 매칭 로직 (TDD)

**Files:**
- Create: `supabase/functions/resolve-bakery-coords/coordMatch.js`
- Test: `src/lib/resolveBakeryCoords.test.js`

**Interfaces:**
- Consumes: 없음 (순수 함수).
- Produces (Task 3이 import):
  - `DAEJEON_BBOX: { minLat: number, maxLat: number, minLng: number, maxLng: number }`
  - `parseBakeryId(bakeryId: unknown): { source: 'tour'|'kakao', nativeId: string } | null`
  - `inDaejeon(lat: unknown, lng: unknown, bbox?): boolean` — `lat/lng`가 `number`가 아니면 `false`
  - `pickKakaoMatch(documents: Array<{id,x,y}>|null|undefined, nativeId: string|number): { lat: number, lng: number } | null`
  - `pickTourCoord(item: {mapx,mapy}|null|undefined): { lat: number, lng: number } | null`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

Create `src/lib/resolveBakeryCoords.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DAEJEON_BBOX,
  parseBakeryId,
  inDaejeon,
  pickKakaoMatch,
  pickTourCoord,
} from '../../supabase/functions/resolve-bakery-coords/coordMatch.js'

test('parseBakeryId — 접두 있는 id 는 source/nativeId 로 분해', () => {
  assert.deepEqual(parseBakeryId('kakao:12345678'), { source: 'kakao', nativeId: '12345678' })
  assert.deepEqual(parseBakeryId('tour:741957'), { source: 'tour', nativeId: '741957' })
  assert.deepEqual(parseBakeryId('  kakao:abc  '), { source: 'kakao', nativeId: 'abc' })
})

test('parseBakeryId — 잘못된 입력은 null', () => {
  for (const bad of ['foo', '', 'kakao:', 'tour:', ':123', 'other:1', null, undefined, 123]) {
    assert.equal(parseBakeryId(bad), null, `${JSON.stringify(bad)} → null`)
  }
})

test('inDaejeon — 대전 안/밖', () => {
  assert.equal(inDaejeon(36.35, 127.42), true)
  assert.equal(inDaejeon(DAEJEON_BBOX.minLat, DAEJEON_BBOX.minLng), true) // 경계 포함
  assert.equal(inDaejeon(DAEJEON_BBOX.maxLat, DAEJEON_BBOX.maxLng), true)
  assert.equal(inDaejeon(37.5665, 126.978), false) // 서울
  assert.equal(inDaejeon(0, 0), false)
  assert.equal(inDaejeon(Number.NaN, 127.4), false)
  assert.equal(inDaejeon('36.3', '127.4'), false) // 문자열 비허용
})

test('pickKakaoMatch — id 일치 문서의 좌표(y=lat, x=lng)', () => {
  const docs = [
    { id: '111', x: '127.1', y: '36.2' },
    { id: '222', x: '127.42', y: '36.35' },
  ]
  assert.deepEqual(pickKakaoMatch(docs, '222'), { lat: 36.35, lng: 127.42 })
  assert.deepEqual(pickKakaoMatch(docs, 222), { lat: 36.35, lng: 127.42 }) // 숫자 nativeId 도 허용
})

test('pickKakaoMatch — 불일치/빈 입력/대전 밖은 null', () => {
  assert.equal(pickKakaoMatch([{ id: '999', x: '127.42', y: '36.35' }], '222'), null)
  assert.equal(pickKakaoMatch([], '222'), null)
  assert.equal(pickKakaoMatch(null, '222'), null)
  assert.equal(pickKakaoMatch(undefined, '222'), null)
  assert.equal(pickKakaoMatch([{ id: '222', x: '126.978', y: '37.5665' }], '222'), null) // 서울 좌표
})

test('pickTourCoord — mapy=lat, mapx=lng', () => {
  assert.deepEqual(pickTourCoord({ mapx: '127.42', mapy: '36.35' }), { lat: 36.35, lng: 127.42 })
})

test('pickTourCoord — 좌표 없음/0,0/대전 밖은 null', () => {
  assert.equal(pickTourCoord({}), null)
  assert.equal(pickTourCoord({ mapx: '0', mapy: '0' }), null)
  assert.equal(pickTourCoord({ mapx: '126.978', mapy: '37.5665' }), null)
  assert.equal(pickTourCoord(null), null)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../supabase/functions/resolve-bakery-coords/coordMatch.js'`.

- [ ] **Step 3: `coordMatch.js`를 구현한다**

Create `supabase/functions/resolve-bakery-coords/coordMatch.js`:

```js
// 이슈 #69 — resolve-bakery-coords Edge Function 의 순수 매칭 로직.
// Deno API 를 쓰지 않는다: src 의 node:test 가 이 파일을 그대로 import 한다.

// 출처: src/config/regions.js 의 대전 region.bbox. 값 변경 시 양쪽을 반드시 함께 고친다.
export const DAEJEON_BBOX = { minLat: 36.18, maxLat: 36.5, minLng: 127.25, maxLng: 127.56 }

// 'kakao:123' → { source: 'kakao', nativeId: '123' } / 형식 불일치는 null
export function parseBakeryId(bakeryId) {
  const m = /^(tour|kakao):(.+)$/.exec(String(bakeryId ?? '').trim())
  return m ? { source: m[1], nativeId: m[2] } : null
}

export function inDaejeon(lat, lng, bbox = DAEJEON_BBOX) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  )
}

// Kakao 키워드검색 documents[] 에서 nativeId 와 정확히 일치하는 항목의 좌표.
// Kakao 규약: doc.x = 경도(lng), doc.y = 위도(lat).
export function pickKakaoMatch(documents, nativeId) {
  for (const d of documents ?? []) {
    if (String(d?.id) !== String(nativeId)) continue
    const lat = parseFloat(d.y)
    const lng = parseFloat(d.x)
    return inDaejeon(lat, lng) ? { lat, lng } : null
  }
  return null
}

// KorService2 detailCommon2 item → 좌표. 규약: item.mapx = 경도, item.mapy = 위도.
export function pickTourCoord(item) {
  const lat = parseFloat(item?.mapy)
  const lng = parseFloat(item?.mapx)
  return inDaejeon(lat, lng) ? { lat, lng } : null
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npm test`
Expected: PASS — 신규 7개 테스트 + 기존 테스트 전부.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/resolve-bakery-coords/coordMatch.js src/lib/resolveBakeryCoords.test.js
git commit -m "$(cat <<'EOF'
feat: resolve-bakery-coords 순수 매칭 로직 + 테스트 (이슈 #69)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gj8GDvGL2p6Eiq31HnHxcv
EOF
)"
```

---

## Task 3: `resolve-bakery-coords` Edge Function + 설정

**Files:**
- Create: `supabase/functions/resolve-bakery-coords/index.ts`
- Create: `supabase/functions/resolve-bakery-coords/README.md`
- Modify: `supabase/config.toml` (파일 끝에 블록 추가)

**Interfaces:**
- Consumes: `./coordMatch.js`의 `parseBakeryId`, `pickKakaoMatch`, `pickTourCoord`. 환경변수 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`(자동 주입), `KAKAO_REST_KEY`, `TOUR_API_KEY`(시크릿).
- Produces: HTTP 엔드포인트 `resolve-bakery-coords`. 요청 `POST { bakery_id: string, name?: string }` → 응답 `200 { resolved: boolean }`. 부수효과: `bakery_coords` upsert. **throw 없음.**

- [ ] **Step 1: `index.ts`를 작성한다**

Create `supabase/functions/resolve-bakery-coords/index.ts`:

```ts
// 이슈 #69 — bakery_id 로 서버가 신뢰하는 좌표를 확보해 bakery_coords 에 upsert 한다.
// og-stamp 와 같은 패턴: Deno.env.get + 원시 fetch + PostgREST 직접 호출(전용 클라이언트 미도입).
//
// 필요한 시크릿:  KAKAO_REST_KEY, TOUR_API_KEY   (supabase secrets set 으로 등록)
// 자동 주입:      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { parseBakeryId, pickKakaoMatch, pickTourCoord } from './coordMatch.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const KAKAO_REST_KEY = Deno.env.get('KAKAO_REST_KEY') ?? ''
const TOUR_API_KEY = Deno.env.get('TOUR_API_KEY') ?? ''

// 대전 rect (Kakao 규약: "minLng,minLat,maxLng,maxLat"). coordMatch.DAEJEON_BBOX 와 같은 값.
const DAEJEON_RECT = '127.25,36.18,127.56,36.5'

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 6000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const restHeaders = () => ({
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
})

async function cacheHas(bakeryId: string): Promise<boolean> {
  const url =
    `${SUPABASE_URL}/rest/v1/bakery_coords` +
    `?bakery_id=eq.${encodeURIComponent(bakeryId)}&select=bakery_id`
  const res = await fetchWithTimeout(url, { headers: restHeaders() })
  if (!res.ok) return false
  const rows = await res.json()
  return Array.isArray(rows) && rows.length > 0
}

async function upsertCoord(
  bakeryId: string,
  coord: { lat: number; lng: number },
  source: string,
): Promise<boolean> {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/bakery_coords`, {
    method: 'POST',
    headers: {
      ...restHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      bakery_id: bakeryId,
      lat: coord.lat,
      lng: coord.lng,
      source,
      fetched_at: new Date().toISOString(),
    }),
  })
  return res.ok
}

async function resolveTour(nativeId: string) {
  const url =
    `https://apis.data.go.kr/B551011/KorService2/detailCommon2` +
    `?serviceKey=${encodeURIComponent(TOUR_API_KEY)}` +
    `&MobileOS=ETC&MobileApp=DaejeonBreadMap&_type=json` +
    `&contentId=${encodeURIComponent(nativeId)}&numOfRows=1&pageNo=1`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return null
  const json = await res.json()
  const item = json?.response?.body?.items?.item
  const first = Array.isArray(item) ? item[0] : item
  return first ? pickTourCoord(first) : null
}

async function resolveKakao(nativeId: string, name: string) {
  if (!name.trim()) return null
  for (let page = 1; page <= 3; page++) {
    const url =
      `https://dapi.kakao.com/v2/local/search/keyword.json` +
      `?query=${encodeURIComponent(name.trim())}&size=15&page=${page}&rect=${DAEJEON_RECT}`
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
    })
    if (!res.ok) return null
    const json = await res.json()
    const hit = pickKakaoMatch(json?.documents, nativeId)
    if (hit) return hit
    if ((json?.meta?.is_end ?? true) === true) break
  }
  return null
}

async function handler(req: Request): Promise<Response> {
  let body: { bakery_id?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ resolved: false })
  }

  const bakeryId = typeof body?.bakery_id === 'string' ? body.bakery_id : ''
  const parsed = parseBakeryId(bakeryId)
  if (!parsed) return Response.json({ resolved: false })

  try {
    if (await cacheHas(bakeryId)) return Response.json({ resolved: true })

    const coord =
      parsed.source === 'tour'
        ? await resolveTour(parsed.nativeId)
        : await resolveKakao(parsed.nativeId, typeof body?.name === 'string' ? body.name : '')

    if (!coord) return Response.json({ resolved: false })

    const ok = await upsertCoord(bakeryId, coord, parsed.source)
    return Response.json({ resolved: ok })
  } catch (err) {
    console.error('[resolve-bakery-coords] 좌표 해석 실패', err)
    return Response.json({ resolved: false })
  }
}

export default { fetch: handler }
```

- [ ] **Step 2: `README.md`를 작성한다**

Create `supabase/functions/resolve-bakery-coords/README.md`:

```markdown
# resolve-bakery-coords

`bakery_id`(`tour:` / `kakao:` 접두)로 서버가 신뢰하는 좌표를 외부 API에서 확보해
`bakery_coords` 테이블에 upsert 한다. `create_diary_entry` RPC가 방문 인증(`verified`)을
이 테이블 좌표로만 판정하므로(이슈 #69), 프런트는 기록 저장 직전에 이 함수를 1회 호출한다.

- `tour:{contentId}` → KorService2 `detailCommon2`
- `kakao:{id}` → Kakao Local 키워드 검색(대전 rect) 후 `doc.id` 정확 일치 항목

응답은 항상 `200 { "resolved": boolean }`. 실패·미해결은 `resolved: false`이며 에러를 던지지 않는다.

## 시크릿

| 이름 | 발급처 |
|---|---|
| `KAKAO_REST_KEY` | Kakao Developers — **서버 전용** REST 키(클라이언트 `VITE_KAKAO_REST_KEY`와 분리 발급) |
| `TOUR_API_KEY` | 공공데이터포털 KorService2 (`VITE_TOUR_API_KEY`와 같은 값 사용 가능) |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`는 플랫폼이 자동 주입한다.

## 배포

    supabase secrets set KAKAO_REST_KEY=... TOUR_API_KEY=...
    supabase functions deploy resolve-bakery-coords

## 로컬 실행

    supabase functions serve resolve-bakery-coords --env-file supabase/functions/.env.local
    # .env.local: KAKAO_REST_KEY / TOUR_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
```

- [ ] **Step 3: `config.toml`에 함수 엔트리를 추가한다**

`supabase/config.toml` 맨 끝에 append:

```toml

[functions.resolve-bakery-coords]
verify_jwt = true
entrypoint = "./functions/resolve-bakery-coords/index.ts"
```

(`og-stamp`는 `verify_jwt = false` — 이 함수는 로그인 사용자만 호출하게 명시적으로 `true`.)

- [ ] **Step 4: 회귀 없음 확인** (이 태스크는 JS 번들·테스트에 영향 없음)

Run: `npm test`
Expected: PASS — 기존 + Task 2 테스트 전부. (Deno 파일은 `node --test` 대상 아님.)

- [ ] **Step 5: 핸들러를 스펙 §2.4와 대조 검토** (Deno CLI가 없으므로 배포가 첫 타입 게이트 — Task 5)

체크리스트:
- 캐시 히트 시 외부 API를 부르지 않고 `{resolved:true}` 즉시 반환하는가.
- 모든 외부 호출이 `fetchWithTimeout`(6s)로 감싸였는가.
- `parsed` 실패, JSON 파싱 실패, 외부 오류, 결과 없음, upsert 실패 — 전부 `{resolved:false}`(또는 upsert 결과값)로 귀결하고 throw 하지 않는가.
- `name`이 없거나 빈 문자열이면 `resolveKakao`가 조회 없이 `null`인가.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/resolve-bakery-coords/index.ts supabase/functions/resolve-bakery-coords/README.md supabase/config.toml
git commit -m "$(cat <<'EOF'
feat: resolve-bakery-coords Edge Function (이슈 #69)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gj8GDvGL2p6Eiq31HnHxcv
EOF
)"
```

---

## Task 4: 프런트 — `addEntry`에 좌표 해석 호출 추가

**Files:**
- Modify: `src/hooks/useDiaryEntries.js` (`addEntry`, 현재 `47-64`)

**Interfaces:**
- Consumes: 배포된 `resolve-bakery-coords` 함수(Task 3), `supabase.functions.invoke`(`@supabase/supabase-js` 내장), `bakery.id` / `bakery.name`(정규화된 Bakery 객체 — 호출 경로 `RecommendCard` → `DiaryEntryModal onSubmit` → `addEntry(bakery, text, location)`).
- Produces: 동작 변화 — `create_diary_entry` 호출 전에 `resolve-bakery-coords`를 1회 `await`. 반환 계약(`{ error }`)·`reload()` 타이밍은 그대로.

- [ ] **Step 1: `addEntry`를 교체한다**

`src/hooks/useDiaryEntries.js`의 `addEntry` 정의(현재)…

```js
  const addEntry = (bakery, text, location = null) => {
    if (!user) return Promise.resolve({ error: new Error('로그인이 필요해요.') })
    return supabase
      .rpc('create_diary_entry', {
        p_bakery: bakery,
        p_text: text,
        p_lat: location?.lat ?? null,
        p_lng: location?.lng ?? null,
      })
      .then(({ error }) => {
        if (error) {
          console.error('[기록장] 작성 실패', error)
          return { error }
        }
        reload()
        return { error: null }
      })
  }
```

…를 아래로 바꾼다:

```js
  const addEntry = (bakery, text, location = null) => {
    if (!user) return Promise.resolve({ error: new Error('로그인이 필요해요.') })

    // 이슈 #69: create_diary_entry 는 bakery_coords(서버 신뢰 좌표)만 보고 verified 를
    // 판정한다. 저장 직전에 서버측 좌표 해석을 1회 시도해 캐시를 채운다. 실패해도
    // (미해결/함수 오류) 기록은 그대로 저장되며 그 경우 verified=false 가 된다 — 흐름을 막지 않는다.
    return supabase.functions
      .invoke('resolve-bakery-coords', { body: { bakery_id: bakery.id, name: bakery.name } })
      .catch((err) => console.error('[기록장] 좌표 해석 실패', err))
      .then(() =>
        supabase.rpc('create_diary_entry', {
          p_bakery: bakery,
          p_text: text,
          p_lat: location?.lat ?? null,
          p_lng: location?.lng ?? null,
        }),
      )
      .then(({ error }) => {
        if (error) {
          console.error('[기록장] 작성 실패', error)
          return { error }
        }
        reload()
        return { error: null }
      })
  }
```

- [ ] **Step 2: 테스트·빌드 회귀 확인**

Run: `npm test && npm run build`
Expected: PASS — 테스트 전부 통과, `vite build`가 import/문법 오류 없이 완료.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDiaryEntries.js
git commit -m "$(cat <<'EOF'
feat: 기록 저장 전 resolve-bakery-coords 호출 (이슈 #69)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gj8GDvGL2p6Eiq31HnHxcv
EOF
)"
```

---

## Task 5: 배포 + 수동 검증 (운영자 단계 — 사용자 자격증명 필요)

**Files:** 없음 (배포·검증만). 이 태스크의 산출물은 **PR 설명에 붙일 검증 결과**다.

**Interfaces:**
- Consumes: Task 1~4의 커밋, Supabase 프로젝트 접근 권한, 발급된 `KAKAO_REST_KEY`(서버용) / `TOUR_API_KEY`.
- Produces: 배포된 함수 + 적용된 스키마 + 검증 로그.

- [ ] **Step 1: 서버 전용 Kakao REST 키 발급** — Kakao Developers 콘솔에서 클라이언트(`VITE_KAKAO_REST_KEY`)와 별개 앱/키로. 허용 IP·플랫폼 제약이 있으면 Edge Function 아웃바운드에 맞게 설정(또는 제약 없음).

- [ ] **Step 2: 시크릿 등록**

```bash
supabase secrets set KAKAO_REST_KEY=<서버용 키> TOUR_API_KEY=<KorService2 키>
```

- [ ] **Step 3: 함수 배포** (esbuild 번들링이 `index.ts`/`coordMatch.js` 타입·문법을 여기서 검증)

```bash
supabase functions deploy resolve-bakery-coords
```
Expected: 배포 성공. 실패 시 오류를 Task 3으로 되돌려 수정.

- [ ] **Step 4: 스키마 적용** — Supabase 대시보드 SQL Editor에 `supabase/schema.sql`의 `-- ===== 이슈 #69 ... =====` 섹션을 붙여 실행. `bakery_coords` 생성 + `create_diary_entry` 교체 확인.

- [ ] **Step 5: 스펙 §7 수동 검증 5건 수행 후 결과 기록**

1. `bakery_coords`에 행이 없는 새 `kakao:` 빵집으로 기록 작성 → `verified = false`.
2. `resolve-bakery-coords`를 실존 `kakao:` 빵집(`{ bakery_id, name }`)으로 호출 → `{resolved:true}` + `bakery_coords`에 해당 행 생성.
3. 같은 빵집에 실제 근처(≤150m) GPS로 기록 작성 → `verified = true`, `verified_at` 채워짐.
4. 같은 빵집에 먼 GPS(>150m)로 작성 → `verified = false`.
5. RPC를 직접 호출해 `p_lat/p_lng`와 `p_bakery.lat/lng`에 동일 좌표를 넣어도 `bakery_coords` 좌표로만 판정됨(행 없으면 `verified=false`, 있으면 그 좌표 기준) — 위조 차단 확인.

- [ ] **Step 6: 브랜치 푸시 & PR** (사용자 지시 시)

```bash
git push -u origin fix/stamp
```
PR base: `feature-stamp` (이 작업의 선행 스키마가 아직 `develop`에 없음 — `feature-stamp`가 `develop`에 먼저 병합되면 리베이스). PR 설명에 Step 5 검증 결과를 붙인다.

---

## Self-Review

**1. Spec coverage**

| 스펙 항목 | 태스크 |
|---|---|
| §1 `bakery_coords` 테이블 + RLS(정책 없음) | Task 1 Step 1 |
| §2.1 함수 디렉터리 + `config.toml` `verify_jwt=true` | Task 3 Step 1·3 |
| §2.2 요청/응답 계약(항상 200 `{resolved}`) | Task 3 Step 1 (`handler`) |
| §2.3 `coordMatch.js` 순수 로직 4함수 + bbox 게이트 | Task 2 Step 3 |
| §2.4 `index.ts` 흐름(캐시→source별 조회→upsert→실패처리) | Task 3 Step 1 |
| §2.5 시크릿 표 | Task 3 Step 2(README), Task 5 Step 1·2 |
| §3 `create_diary_entry` 재작성(bbox 게이트 제거, `bakery_coords` 조회) | Task 1 Step 1·2 |
| §4 `useDiaryEntries.addEntry` `functions.invoke` | Task 4 Step 1 |
| §5 설정·시크릿·배포 (README는 함수 디렉터리 README로 — 레포 최상위 README가 사실상 비어 있음) | Task 3 Step 2, Task 5 |
| §6 백필 안 함 + 근거 주석 | Task 1 Step 1 (주석 블록) |
| §7 `resolveBakeryCoords.test.js` 케이스 표 + 수동 검증 5건 | Task 2 Step 1, Task 5 Step 5 |
| §8 구현 순서 | Task 1→5 순서 |
| §부록 bbox 동기화 주석 | Task 2 Step 3 (`coordMatch.js` 상단 주석) |

스펙 대비 편차 1건: §5는 "`README.md`의 환경변수 섹션"을 말하지만 레포 최상위 `README.md`가 2줄짜리(섹션 없음)라 `supabase/functions/resolve-bakery-coords/README.md`에 배포·시크릿 절차를 둔다. 기능적 차이 없음.

**2. Placeholder scan** — "TBD/TODO/적절히 처리" 없음. 모든 코드 스텝에 실제 코드 블록 포함. Task 5는 운영자 단계라 셸 명령·검증 절차가 실제 산출물.

**3. Type consistency**
- `parseBakeryId` 반환 `{ source, nativeId }` — Task 2 정의, Task 3 `index.ts`에서 `parsed.source` / `parsed.nativeId`로 사용. 일치.
- `pickKakaoMatch(documents, nativeId)` / `pickTourCoord(item)` 반환 `{ lat, lng } | null` — Task 2 정의, Task 3 `resolveKakao`/`resolveTour`에서 그대로 반환·`upsertCoord(bakeryId, coord, source)`로 전달. 일치.
- 응답 `{ resolved: boolean }` — Task 3 전 분기 동일. Task 4는 이 값을 읽지 않음(`.then(() => ...)`). 일치.
- `bakery_coords` 컬럼(`bakery_id, lat, lng, source, fetched_at`) — Task 1 정의, Task 3 `upsertCoord` body / `cacheHas` select와 일치.
- `create_diary_entry` 시그니처 — Task 1에서 불변(Global Constraints), Task 4 호출 인자(`p_bakery, p_text, p_lat, p_lng`)와 일치.
