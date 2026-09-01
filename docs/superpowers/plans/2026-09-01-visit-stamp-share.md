# 방문 스탬프 공유 (이슈 #63 3단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마이페이지 방문 스탬프를 PNG로 저장/공유하고, `/s/:code` 공개 페이지에서 비로그인 방문자가 그 결과를 보고 로그인하도록 유도한다.

**Architecture:** 프런트 전용 + Supabase RPC 3개. 새 컬럼 `profiles.share_code`(지연 생성), 비로그인 실행 가능한 집계 RPC `get_public_stamp`(구 분류를 PL/pgSQL ray-casting으로 서버에서 재계산), 카드 이미지는 외부 리소스 없는 단일 SVG 문자열을 `<canvas>`로 래스터화. 라우터는 도입하지 않고 `App.jsx`에서 `location.pathname` 분기. 동적 OG는 후속 이슈, 이번엔 정적 이미지 1장.

**Tech Stack:** React 18 (라우터 없음), Vite 5, `@supabase/supabase-js` v2, `node --test`(node:test/node:assert), Supabase Postgres (plpgsql, RLS, security definer).

**Spec:** `docs/superpowers/specs/2026-09-01-visit-stamp-share-design.md`

## Global Constraints

- 브랜치는 `feature-stamp`. **별도 브랜치를 만들지 않는다.** base는 `develop`.
- `.claude/settings.local.json`은 절대 커밋하지 않는다.
- **PR을 생성하지 않는다.** 커밋·푸시 여부는 작업 완료 후 사용자에게 확인.
- **PR에 자동 코멘트 금지** — 진행 보고는 채팅으로만.
- 지표 필드명은 `src/lib/visitStamps.js`의 `computeVisitStamps` 반환과 **정확히 일치**해야 한다: `perDistrict[{name,count,target,completedSlots,goalPct,completed}]`, `visitedBakeryCount`, `completedSlots`, `totalSlots`, `goalPct`, `completedDistrictCount`. 과거 이슈의 `overallPct`/`conqueredCount`를 되살리지 않는다.
- `profiles` RLS 정책을 넓히지 않는다. 공개 노출은 `security definer` RPC가 컬럼만 골라 반환한다.
- 신규 SQL 함수는 전부 `set search_path = public, pg_temp`. `schema.sql`은 전체 재실행이 안전하도록 idempotent하게 작성한다(맨 끝에 `-- ===== 이슈 #63 3단계: 공유 =====` 섹션).
- 신규 npm 의존성 없음.
- CSS는 기존 색 토큰만 사용(`--accent --accent-deep --brown --gold --muted --line --card --card2 --ink`). 새 토큰 금지. 클래스명은 kebab-case + 컴포넌트 프리픽스.
- Windows 환경: 테스트는 `npm.cmd test`, 빌드는 `npm.cmd run build`(bash 툴에서는 `npm test` / `npm run build`도 가능). LF/CRLF 경고, 번들 500kB 경고는 기존과 동일한 비차단.
- **표준 커밋 트레일러** — 모든 커밋 메시지 끝에 이 두 줄을 붙인다:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013SGUbVrX77z4M4BH7jPoWs
  ```
- SQL 태스크(1~3)는 로컬 실행 하네스가 없다. "테스트"는 명시된 수동 검증 쿼리 + 예상 결과다. 실제 Supabase 반영은 **사용자가 수행**하며, 각 SQL 태스크 완료 시 적용 범위를 사용자에게 안내한다.

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `supabase/schema.sql` | `share_code` 컬럼 + `ensure_share_code()` + `classify_daejeon_district()` + `get_public_stamp()` + grant. 맨 끝 새 섹션 | 1, 2, 3 |
| `src/lib/stampShareImage.js` | 카드 SVG 문자열 빌더 + SVG→PNG 래스터화. 순수(빌더) + 브라우저(래스터) | 4 |
| `src/lib/stampShareImage.test.js` | `buildStampCardSvg` 단위 테스트 | 4 |
| `src/lib/stampShare.js` | 공유 오케스트레이션: `ensure_share_code` → 이미지 → `navigator.share`/다운로드 | 5 |
| `src/components/mypage/VisitStampModal.jsx` | 본인 모달에 `스탬프 공유하기` 버튼, `targetPerDistrict` prop 수신 | 6 |
| `src/components/mypage/VisitStampBand.jsx` | 모달에 `targetPerDistrict={target}` 전달 | 6 |
| `src/pages/StampSharePage.jsx` | `/s/:code` 공개 결과 페이지 + CTA | 7 |
| `src/App.jsx` | `location.pathname` `"/s/"` 분기 | 7 |
| `src/styles.css` | `.visit-stamp-share*`(태스크 6), `.stamp-share-*`(태스크 7) 규칙 | 6, 7 |
| `index.html` | 정적 OG/twitter 메타 | 8 |
| `public/og-stamp-default.svg` | 정적 OG 이미지(소스, 1200×630) | 8 |

**의존 순서:** 1 → 2 → 3 → 4 → 5 → 6, 그리고 3 → 7. 8은 독립. 권장 실행 순서: 1, 2, 3, 4, 5, 6, 7, 8.

---

### Task 1: DB — `profiles.share_code` 컬럼 + `ensure_share_code()`

**Files:**
- Modify: `supabase/schema.sql` (파일 맨 끝에 추가)

**Interfaces:**
- Produces (SQL): `profiles.share_code text unique` 컬럼. RPC `ensure_share_code() returns text` — 호출자(`auth.uid()`)의 `share_code`를 반환하고, 없으면 8자리 대문자+숫자 코드를 생성·저장 후 반환. `authenticated`만 실행.

- [ ] **Step 1: `schema.sql` 맨 끝에 3단계 공유 섹션 헤더와 컬럼 추가**

파일 맨 끝(현재 마지막 줄은 `grant update (nickname, avatar_url, avatar_version, stamp_target) on profiles to authenticated;`)에 이어서 추가:

```sql

-- ===== 이슈 #63 3단계: 공유 =====

-- 공유 링크 전용 코드. friend_code 와 분리 — friend_code 는 authenticated 전용이고
-- "낯선 사람에게 노출 금지" 원칙이 있어(위 find_user_by_friend_code 주석) 재사용하지 않는다.
-- 첫 공유 때 지연 생성되므로 nullable. 사용자가 직접 못 쓰게 update grant 목록에 넣지 않는다.
alter table profiles add column if not exists share_code text unique;
```

- [ ] **Step 2: `ensure_share_code()` 함수 추가**

Step 1 블록 바로 아래에:

```sql
-- 내 share_code 를 반환한다. 없으면 generate_friend_code() 와 동일한 문자셋으로 8자리를
-- 만들어 저장 후 반환한다. security definer 라 컬럼 update grant 를 우회해 share_code 를 쓴다.
create or replace function ensure_share_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_uid uuid := auth.uid();
  v_code text;
  v_exists boolean;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select share_code into v_code from profiles where user_id = v_uid;
  if v_code is not null then
    return v_code;
  end if;

  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from profiles where share_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;

  update profiles set share_code = v_code where user_id = v_uid;
  return v_code;
end;
$$;

revoke execute on function ensure_share_code() from public, anon;
grant execute on function ensure_share_code() to authenticated;

alter function ensure_share_code() set search_path = public, pg_temp;
```

- [ ] **Step 3: 수동 검증 쿼리를 커밋 메시지에 남길 수 있도록 기록**

로컬 실행 불가. 사용자가 Supabase SQL 에디터에서 확인할 쿼리(태스크 완료 안내에 포함):

```sql
-- 1) 컬럼 존재
select column_name, is_nullable from information_schema.columns
where table_name = 'profiles' and column_name = 'share_code';
-- 기대: share_code | YES

-- 2) 로그인 세션에서(에디터는 service_role 이라 auth.uid() 가 null → 아래는 앱에서 호출 시 검증)
--    앱에서 supabase.rpc('ensure_share_code') 두 번 호출 → 같은 8자리 코드가 반환되고
--    두 번째 호출이 새 코드를 만들지 않는다.
select user_id, share_code from profiles where share_code is not null;
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/schema.sql
git commit -m "feat: profiles.share_code 컬럼 + ensure_share_code() (이슈 #63 3단계)

공유 링크 전용 코드. friend_code 와 분리(그건 authenticated 전용). 첫 공유 때
지연 생성. security definer RPC 로만 설정, 사용자 직접 쓰기 불가.

<표준 커밋 트레일러 2줄 (Global Constraints 참조)>"
```

---

### Task 2: DB — `classify_daejeon_district(lat, lng)`

**Files:**
- Modify: `supabase/schema.sql` (Task 1 블록 아래에 추가)

**Interfaces:**
- Consumes: 없음(자기완결).
- Produces (SQL): `classify_daejeon_district(p_lat float8, p_lng float8) returns text` — `'동구'|'중구'|'서구'|'유성구'|'대덕구'|NULL`. `src/lib/districtFromPoint.js`의 홀짝 ray-casting과 동일 규칙(삽입 순서 순회, 첫 포함 구, 경계 밖/NULL이면 NULL). `immutable`.

- [ ] **Step 1: `classify_daejeon_district` 함수 추가 (링 데이터 전체 포함)**

Task 1의 `ensure_share_code` 블록 아래에 그대로 붙여넣는다. 링 좌표는 `src/data/daejeonDistricts.js`의 `DISTRICT_RINGS`와 **정확히 동일**하다:

```sql
-- src/lib/districtFromPoint.js 의 ray-casting 을 그대로 포팅. 좌표 출처:
-- src/data/daejeonDistricts.js 의 DISTRICT_RINGS ([lat, lng] 링). 좌표 수정 시 양쪽 동기화.
-- 순회 순서(동구→중구→서구→유성구→대덕구)가 경계 공유 지점의 귀속을 결정하므로
-- jsonb 객체가 아니라 배열로 저장해 순서를 보존한다.
create or replace function classify_daejeon_district(p_lat float8, p_lng float8)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_rings jsonb := '[
    {"name":"동구","ring":[[36.41936,127.51778],[36.41782,127.54454],[36.39179,127.55633],[36.38413,127.52680],[36.36636,127.52899],[36.33036,127.50335],[36.28373,127.49943],[36.25629,127.48832],[36.23514,127.49490],[36.22030,127.46965],[36.21184,127.47068],[36.19110,127.44494],[36.20534,127.42449],[36.23599,127.44464],[36.25439,127.43232],[36.26511,127.44076],[36.28715,127.43274],[36.29774,127.45798],[36.34076,127.41490],[36.35755,127.46803],[36.37798,127.45344],[36.40004,127.45951],[36.42977,127.49135],[36.40527,127.50470],[36.41936,127.51778]]},
    {"name":"중구","ring":[[36.34715,127.40503],[36.34076,127.41490],[36.29774,127.45798],[36.28715,127.43274],[36.26511,127.44076],[36.25439,127.43232],[36.23599,127.44464],[36.20534,127.42449],[36.20993,127.41040],[36.24781,127.38852],[36.26192,127.39151],[36.26923,127.37453],[36.31762,127.38804],[36.34715,127.40503]]},
    {"name":"서구","ring":[[36.36974,127.39712],[36.34715,127.40503],[36.31762,127.38804],[36.26923,127.37453],[36.26625,127.36483],[36.21702,127.36684],[36.18136,127.33355],[36.21841,127.31735],[36.22668,127.29455],[36.24112,127.28019],[36.26124,127.29389],[36.26937,127.30902],[36.31159,127.34194],[36.32925,127.34033],[36.34691,127.35120],[36.36993,127.38255],[36.36974,127.39712]]},
    {"name":"유성구","ring":[[36.45277,127.40475],[36.43896,127.39331],[36.41363,127.42065],[36.37873,127.41323],[36.36974,127.39712],[36.36993,127.38255],[36.34691,127.35120],[36.32925,127.34033],[36.31159,127.34194],[36.26937,127.30902],[36.26124,127.29389],[36.28048,127.25157],[36.29329,127.26132],[36.32427,127.26187],[36.34600,127.28000],[36.41161,127.28443],[36.41927,127.29635],[36.41898,127.32886],[36.44498,127.35521],[36.48247,127.36128],[36.49710,127.38329],[36.48869,127.39780],[36.48040,127.40634],[36.45277,127.40475]]},
    {"name":"대덕구","ring":[[36.42977,127.49135],[36.40004,127.45951],[36.37798,127.45344],[36.35755,127.46803],[36.34076,127.41490],[36.34715,127.40503],[36.36974,127.39712],[36.37873,127.41323],[36.41363,127.42065],[36.43896,127.39331],[36.45277,127.40475],[36.45372,127.43839],[36.44717,127.45534],[36.45491,127.48148],[36.44638,127.50478],[36.42977,127.49135]]}
  ]'::jsonb;
  v_entry jsonb;
  v_ring jsonb;
  v_n int; v_i int; v_j int;
  v_yi float8; v_xi float8; v_yj float8; v_xj float8;
  v_inside boolean;
begin
  if p_lat is null or p_lng is null then
    return null;
  end if;

  for v_entry in select * from jsonb_array_elements(v_rings)
  loop
    v_ring := v_entry -> 'ring';
    v_n := jsonb_array_length(v_ring);
    v_inside := false;
    v_j := v_n - 1;
    for v_i in 0 .. v_n - 1 loop
      -- ring 좌표는 [lat, lng] → 0=lat(y), 1=lng(x)
      v_yi := (v_ring -> v_i ->> 0)::float8;
      v_xi := (v_ring -> v_i ->> 1)::float8;
      v_yj := (v_ring -> v_j ->> 0)::float8;
      v_xj := (v_ring -> v_j ->> 1)::float8;
      -- 첫 조건이 false 면 PG 의 AND 단축평가로 나눗셈을 건너뛴다.
      -- 그 조건이 true 이면 v_yi <> v_yj 이므로 (v_yj - v_yi) 는 0 이 아니다.
      if ((v_yi > p_lat) <> (v_yj > p_lat))
         and (p_lng < (v_xj - v_xi) * (p_lat - v_yi) / (v_yj - v_yi) + v_xi) then
        v_inside := not v_inside;
      end if;
      v_j := v_i;
    end loop;
    if v_inside then
      return v_entry ->> 'name';
    end if;
  end loop;

  return null;
end;
$$;

alter function classify_daejeon_district(float8, float8) set search_path = public, pg_temp;
```

- [ ] **Step 2: 파리티 검증 쿼리 준비 (사용자 안내용)**

`src/lib/districtFromPoint.test.js`의 대표 좌표 세트와 동일하게 확인한다. 좌표는 실제 링과 대조해 확정하되, 아래는 각 구 중심 근처라 안정적이다:

```sql
select
  classify_daejeon_district(36.3315, 127.4348) as e1,   -- 동구 (대전역)  기대: 동구
  classify_daejeon_district(36.3277, 127.4276) as e2,   -- 중구 (성심당)  기대: 중구
  classify_daejeon_district(36.3515, 127.3781) as e3,   -- 서구 (둔산)    기대: 서구
  classify_daejeon_district(36.3540, 127.3360) as e4,   -- 유성구 (봉명)  기대: 유성구
  classify_daejeon_district(36.4350, 127.4200) as e5,   -- 대덕구 (오정)  기대: 대덕구
  classify_daejeon_district(37.5665, 126.9780) as e6,   -- 서울           기대: null
  classify_daejeon_district(null, 127.0)       as e7;   -- 기대: null
```

기대 행: `동구 | 중구 | 서구 | 유성구 | 대덕구 | (null) | (null)`.

만약 e1~e5 중 어긋나는 게 있으면 해당 좌표를 그 구 폴리곤 내부의 다른 점으로 교체(브라우저에서 `districtOf({lat,lng})`로 먼저 확인). 알고리즘이 아니라 샘플 좌표 문제다.

- [ ] **Step 3: 커밋**

```bash
git add supabase/schema.sql
git commit -m "feat: classify_daejeon_district() — 좌표→대전 구 판정 (이슈 #63 3단계)

districtFromPoint.js 의 홀짝 ray-casting 을 PL/pgSQL 로 포팅. 링 좌표는
DISTRICT_RINGS 와 동일(동기화 주석). get_public_stamp 가 서버에서 구를
재계산하는 데 쓴다.

<표준 커밋 트레일러 2줄>"
```

---

### Task 3: DB — `get_public_stamp(code)`

**Files:**
- Modify: `supabase/schema.sql` (Task 2 블록 아래에 추가)

**Interfaces:**
- Consumes (SQL): `classify_daejeon_district(float8, float8)` (Task 2). `profiles.share_code`, `profiles.stamp_target`, `profiles.nickname`. `diary_entries.verified`, `diary_entries.bakery`(jsonb), `diary_entries.bakery_id`.
- Produces (SQL): `get_public_stamp(p_code text) returns jsonb` — 비로그인(`anon`) 실행 가능. 코드가 없으면 `NULL`(SQL null). 있으면:
  ```json
  {
    "nickname": "...",
    "targetPerDistrict": 3,
    "stamp": {
      "perDistrict": [{"name","count","target","completedSlots","goalPct","completed"}, ...5],
      "visitedBakeryCount": 0, "completedSlots": 0, "totalSlots": 15,
      "goalPct": 0, "completedDistrictCount": 0
    }
  }
  ```
  `stamp` 객체는 `computeVisitStamps()` 반환과 필드명·구조가 동일.

- [ ] **Step 1: `get_public_stamp` 함수 추가**

Task 2 블록 아래:

```sql
-- 비로그인 방문자가 공유 링크로 받는 공개 집계. 닉네임과 집계 수치만 반환한다.
-- 노출 금지: 기록 원문, visit_lat/visit_lng, 빵집 id·이름·목록, friend_code, user_id.
-- 소유자 본인 화면(computeVisitStamps)이 빵집 좌표로 구를 분류하므로 여기서도 동일하게
-- diary_entries.bakery 좌표를 쓴다(GPS visit 좌표 아님). verified 기록만 집계.
create or replace function get_public_stamp(p_code text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_nickname text;
  v_target int;
  v_names text[] := array['동구','중구','서구','유성구','대덕구'];
  v_per jsonb;
  v_completed_slots int;
  v_total_slots int;
  v_visited int;
  v_completed_districts int;
begin
  if p_code is null or btrim(p_code) = '' then
    return null;
  end if;

  select user_id, nickname, stamp_target
    into v_uid, v_nickname, v_target
    from profiles
    where share_code = upper(btrim(p_code));

  if v_uid is null then
    return null;
  end if;

  v_target := least(20, greatest(1, coalesce(v_target, 3)));
  v_total_slots := v_target * 5;

  with visited as (
    select distinct
      classify_daejeon_district((bakery ->> 'lat')::float8, (bakery ->> 'lng')::float8) as district,
      coalesce(bakery_id, bakery ->> 'id') as bakery_id
    from diary_entries
    where user_id = v_uid
      and verified = true
      and jsonb_typeof(bakery -> 'lat') = 'number'
      and jsonb_typeof(bakery -> 'lng') = 'number'
  ),
  counted as (
    select district, count(*)::int as cnt
    from visited
    where district is not null and bakery_id is not null
    group by district
  ),
  per as (
    select
      names.n as name,
      coalesce(c.cnt, 0) as count,
      v_target as target,
      least(coalesce(c.cnt, 0), v_target) as completed_slots,
      round(least(coalesce(c.cnt, 0), v_target)::numeric / v_target * 100)::int as goal_pct,
      (coalesce(c.cnt, 0) >= v_target) as completed,
      names.ord as ord
    from unnest(v_names) with ordinality as names(n, ord)
    left join counted c on c.district = names.n
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'name', name, 'count', count, 'target', target,
        'completedSlots', completed_slots, 'goalPct', goal_pct, 'completed', completed
      ) order by ord
    ),
    coalesce(sum(completed_slots), 0)::int,
    coalesce(sum(count), 0)::int,
    count(*) filter (where completed)::int
  into v_per, v_completed_slots, v_visited, v_completed_districts
  from per;

  return jsonb_build_object(
    'nickname', v_nickname,
    'targetPerDistrict', v_target,
    'stamp', jsonb_build_object(
      'perDistrict', v_per,
      'visitedBakeryCount', v_visited,
      'completedSlots', v_completed_slots,
      'totalSlots', v_total_slots,
      'goalPct', least(100, round(v_completed_slots::numeric / v_total_slots * 100)::int),
      'completedDistrictCount', v_completed_districts
    )
  );
end;
$$;

revoke execute on function get_public_stamp(text) from public;
grant execute on function get_public_stamp(text) to anon, authenticated;

alter function get_public_stamp(text) set search_path = public, pg_temp;
```

- [ ] **Step 2: 셀프 리뷰 — computeVisitStamps 와 계산 일치 확인**

`src/lib/visitStamps.js`와 나란히 놓고 대조:
- `target` 클램프: JS `Math.min(20, Math.max(1, Math.round(n)))` ↔ SQL `least(20, greatest(1, coalesce(v_target,3)))` — DB CHECK가 1~20을 이미 강제하므로 `round` 불필요, 동일.
- 구별 `completedSlots = min(count, target)`, `goalPct = round(completedSlots/target*100)` — 동일.
- `completed = count >= target` — 동일.
- 전체 `goalPct = min(100, round(completedSlots/totalSlots*100))` — 동일.
- `visitedBakeryCount = Σ count` (구에 매칭된 것만) — SQL은 `district is not null`만 counted에 들어가므로 동일.
- 빈 결과: `visited`가 비면 `counted` 비고 `per`는 5행 전부 count 0 → `sum` null → `coalesce(...,0)`. `jsonb_agg`는 5개 객체 유지(`unnest`가 5행 보장). OK.

- [ ] **Step 3: 파리티 검증 쿼리 준비 (사용자 안내용)**

```sql
-- 존재하지 않는 코드
select get_public_stamp('ZZZZZZZZ');            -- 기대: null
select get_public_stamp(null);                  -- 기대: null

-- 실제 사용자 (앱에서 supabase.rpc('ensure_share_code') 로 코드 확보 후)
select get_public_stamp('<그 코드>');
-- 기대: stamp.perDistrict 5개, 필드명 정확, 그 사용자의 마이페이지 밴드/모달 숫자와
--       completedSlots/totalSlots/goalPct/completedDistrictCount 가 일치.
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/schema.sql
git commit -m "feat: get_public_stamp(code) — 비로그인 공개 스탬프 집계 (이슈 #63 3단계)

anon 실행 허용. share_code 로 사용자 해석 → verified 기록의 빵집 좌표를
classify_daejeon_district 로 재분류 → computeVisitStamps 와 동일 계산.
닉네임+집계만 반환, 기록 원문·좌표·빵집목록 미노출.

<표준 커밋 트레일러 2줄>"
```

- [ ] **Step 5: 사용자에게 DB 적용 안내**

태스크 1~3의 SQL 블록 전체(컬럼 1 + 함수 3 + grant)를 Supabase SQL 에디터에서 실행해야 앱이 동작함을 알린다. `schema.sql` 전체 재실행도 안전(idempotent)함을 명시.

---

### Task 4: `src/lib/stampShareImage.js` — 카드 SVG 빌더 + 래스터화

**Files:**
- Create: `src/lib/stampShareImage.js`
- Test: `src/lib/stampShareImage.test.js`

**Interfaces:**
- Consumes: `src/components/mypage/daejeonStampPaths.js`의 `STAMP_VIEWBOX: string`, `DISTRICT_PATHS: {name, d, cx, cy}[]` (node-safe, 기존 `daejeonStampPaths.test.js`가 증명).
- Produces:
  - `buildStampCardSvg({ nickname: string|null, stamp: <computeVisitStamps 반환>, targetPerDistrict: number }) → string` — 1080×1350 SVG 마크업 문자열.
  - `rasterizeStampCard(svgString: string) → Promise<Blob>` — `image/png` Blob. 브라우저 전용(canvas/Image).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/stampShareImage.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStampCardSvg } from './stampShareImage.js'

const STAMP = {
  perDistrict: [
    { name: '동구', count: 3, target: 3, completedSlots: 3, goalPct: 100, completed: true },
    { name: '중구', count: 1, target: 3, completedSlots: 1, goalPct: 33, completed: false },
    { name: '서구', count: 0, target: 3, completedSlots: 0, goalPct: 0, completed: false },
    { name: '유성구', count: 0, target: 3, completedSlots: 0, goalPct: 0, completed: false },
    { name: '대덕구', count: 0, target: 3, completedSlots: 0, goalPct: 0, completed: false },
  ],
  visitedBakeryCount: 4,
  completedSlots: 4,
  totalSlots: 15,
  goalPct: 27,
  completedDistrictCount: 1,
}

test('1080x1350 SVG 문자열을 만든다', () => {
  const svg = buildStampCardSvg({ nickname: '홍길동', stamp: STAMP, targetPerDistrict: 3 })
  assert.ok(svg.startsWith('<svg'), 'svg 로 시작')
  assert.ok(svg.trimEnd().endsWith('</svg>'), 'svg 로 끝')
  assert.match(svg, /width="1080"/)
  assert.match(svg, /height="1350"/)
})

test('닉네임과 핵심 수치가 들어간다', () => {
  const svg = buildStampCardSvg({ nickname: '홍길동', stamp: STAMP, targetPerDistrict: 3 })
  assert.ok(svg.includes('홍길동님의 대전 빵 스탬프'))
  assert.ok(svg.includes('스탬프 4/15'))
  assert.ok(svg.includes('목표 달성률 27%'))
  for (const d of STAMP.perDistrict) assert.ok(svg.includes(d.name), `${d.name} 포함`)
})

test('닉네임이 없으면 "내 대전 빵 스탬프"', () => {
  const svg = buildStampCardSvg({ nickname: null, stamp: STAMP, targetPerDistrict: 5 })
  assert.ok(svg.includes('내 대전 빵 스탬프'))
  assert.ok(!svg.includes('님의 대전 빵 스탬프'))
})

test('닉네임의 특수문자를 이스케이프한다', () => {
  const svg = buildStampCardSvg({ nickname: '<b>&"x', stamp: STAMP, targetPerDistrict: 3 })
  assert.ok(!svg.includes('<b>'), '원본 태그가 그대로 들어가면 안 됨')
  assert.ok(svg.includes('&lt;b&gt;&amp;&quot;x'))
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './stampShareImage.js'` (또는 `buildStampCardSvg is not a function`).

- [ ] **Step 3: `src/lib/stampShareImage.js` 구현**

```js
import { STAMP_VIEWBOX, DISTRICT_PATHS } from '../components/mypage/daejeonStampPaths.js'

const W = 1080
const H = 1350
// 캔버스 래스터에는 CSS 변수가 안 먹으므로 styles.css 브랜드 색을 리터럴로 고정한다.
const BG = '#fdf6ec'
const INK = '#3d2b1f'
const ACCENT = '#d98a3d'
const BROWN = '#6b4a2b'
const MUTED = '#9a8778'
const TRACK = '#eaddcb'
const FONT =
  "-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif"

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  )

function fillOpacity(pct) {
  return (0.15 + (0.85 * pct) / 100).toFixed(3)
}

export function buildStampCardSvg({ nickname, stamp, targetPerDistrict }) {
  const trimmed = String(nickname ?? '').trim().slice(0, 12)
  const title = trimmed ? `${esc(trimmed)}님의 대전 빵 스탬프` : '내 대전 빵 스탬프'
  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.goalPct]))

  const mapPaths = DISTRICT_PATHS.map(
    ({ name, d }) =>
      `<path d="${d}" fill="${ACCENT}" fill-opacity="${fillOpacity(pctByName[name] ?? 0)}"` +
      ` stroke="${BROWN}" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
  ).join('')

  const mapLabels = DISTRICT_PATHS.map(({ name, cx, cy }) => {
    const dark = (pctByName[name] ?? 0) >= 55
    return (
      `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"` +
      ` font-size="11" font-weight="700" fill="${dark ? '#ffffff' : BROWN}">${esc(name)}</text>`
    )
  }).join('')

  const rows = stamp.perDistrict
    .map((d, i) => {
      const y = 1000 + i * 58
      const barW = Math.round((Math.min(100, d.goalPct) / 100) * 560)
      return (
        `<text x="90" y="${y + 22}" font-size="26" font-weight="700" fill="${INK}">${esc(d.name)}</text>` +
        `<rect x="230" y="${y + 3}" width="560" height="26" rx="13" fill="${TRACK}"/>` +
        (barW > 0
          ? `<rect x="230" y="${y + 3}" width="${barW}" height="26" rx="13" fill="${ACCENT}"/>`
          : '') +
        `<text x="990" y="${y + 22}" text-anchor="end" font-size="24" font-weight="700" fill="${BROWN}">` +
        `${d.completedSlots}/${d.target}</text>`
      )
    })
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"` +
    ` font-family="${FONT}">` +
    `<rect width="${W}" height="${H}" fill="${BG}"/>` +
    `<text x="${W / 2}" y="120" text-anchor="middle" font-size="48" font-weight="800" fill="${INK}">${title}</text>` +
    `<svg x="140" y="170" width="800" height="560" viewBox="${STAMP_VIEWBOX}" preserveAspectRatio="xMidYMid meet">` +
    `${mapPaths}${mapLabels}</svg>` +
    `<text x="${W / 2}" y="830" text-anchor="middle" font-size="72" font-weight="800" fill="${ACCENT}">` +
    `스탬프 ${stamp.completedSlots}/${stamp.totalSlots}</text>` +
    `<text x="${W / 2}" y="892" text-anchor="middle" font-size="36" font-weight="700" fill="${INK}">` +
    `목표 달성률 ${stamp.goalPct}%</text>` +
    `<text x="${W / 2}" y="945" text-anchor="middle" font-size="27" fill="${MUTED}">` +
    `${stamp.completedDistrictCount}/5개 구 목표 완료 · 목표 구마다 ${targetPerDistrict}곳</text>` +
    rows +
    `<text x="${W / 2}" y="${H - 48}" text-anchor="middle" font-size="26" font-weight="700" fill="${MUTED}">` +
    `빵모아 · 대전 빵집 스탬프 투어</text>` +
    `</svg>`
  )
}

// SVG 문자열 → PNG Blob. 외부 리소스가 없어 canvas taint 로 toBlob 이 throw 하지 않는다.
export function rasterizeStampCard(svgString) {
  return new Promise((resolve, reject) => {
    let url
    try {
      url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)))
    } catch (err) {
      reject(err)
      return
    }
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 1080
        canvas.height = 1350
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 1080, 1350)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('toBlob 가 null 을 반환'))),
          'image/png',
        )
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('SVG 이미지 로드 실패'))
    img.src = url
  })
}
```

`rasterizeStampCard`는 `document`/`Image`/`btoa`가 없는 node에서는 테스트하지 않는다(레포 관례: 브라우저 의존 미테스트). `buildStampCardSvg`만 테스트가 커버한다.

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm test`
Expected: PASS — 신규 4개 + 기존 전부(118 + 4 = 122). 회귀 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/stampShareImage.js src/lib/stampShareImage.test.js
git commit -m "feat: 스탬프 공유 카드 SVG 빌더 + PNG 래스터화 (이슈 #63 3단계)

buildStampCardSvg: 1080x1350 단일 SVG(외부 리소스 0). rasterizeStampCard:
SVG→canvas→PNG Blob. 색은 리터럴 hex(캔버스에 CSS 변수 미적용).

<표준 커밋 트레일러 2줄>"
```

---

### Task 5: `src/lib/stampShare.js` — 공유 오케스트레이션

**Files:**
- Create: `src/lib/stampShare.js`

**Interfaces:**
- Consumes: `src/lib/supabase.js`의 `supabase`(nullable). `src/lib/stampShareImage.js`의 `buildStampCardSvg`, `rasterizeStampCard` (Task 4). SQL RPC `ensure_share_code` (Task 1).
- Produces: `shareStampCard({ nickname: string|null, stamp, targetPerDistrict: number }) → Promise<{ ok: boolean, mode?: 'share'|'download'|'cancel', error?: Error }>`.

- [ ] **Step 1: `src/lib/stampShare.js` 구현**

브라우저·네트워크 의존만 있어 단위 테스트는 두지 않는다(레포 관례). 검증은 Step 2 빌드 + 태스크 7 이후 수동 QA.

```js
import { supabase } from './supabase'
import { buildStampCardSvg, rasterizeStampCard } from './stampShareImage'

// ensure_share_code RPC 로 내 공유 URL 을 만든다. 최초 호출 경합으로 unique 충돌이 나면
// 1회 재조회로 복구한다.
async function resolveShareUrl() {
  if (!supabase) throw new Error('supabase 미설정')
  const { data, error } = await supabase.rpc('ensure_share_code')
  if (!error && data) return `${window.location.origin}/s/${data}`

  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (uid) {
    const { data: row } = await supabase
      .from('profiles')
      .select('share_code')
      .eq('user_id', uid)
      .maybeSingle()
    if (row?.share_code) return `${window.location.origin}/s/${row.share_code}`
  }
  throw error || new Error('공유 코드를 만들지 못했어요.')
}

export async function shareStampCard({ nickname, stamp, targetPerDistrict }) {
  try {
    const shareUrl = await resolveShareUrl()
    const svg = buildStampCardSvg({ nickname, stamp, targetPerDistrict })
    const blob = await rasterizeStampCard(svg)
    const file = new File([blob], 'daejeon-bread-stamp.png', { type: 'image/png' })

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          text: '대전 빵 스탬프 도전 중! 나도 해볼래?',
          url: shareUrl,
        })
        return { ok: true, mode: 'share' }
      } catch (err) {
        if (err?.name === 'AbortError') return { ok: false, mode: 'cancel' }
        throw err
      }
    }

    // 폴백: PNG 다운로드 + 링크 복사 시도
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
    try {
      await navigator.clipboard?.writeText(shareUrl)
    } catch {
      /* 클립보드 실패는 무시 */
    }
    return { ok: true, mode: 'download' }
  } catch (error) {
    console.error('[스탬프공유]', error)
    return { ok: false, error }
  }
}
```

- [ ] **Step 2: 빌드로 검증**

Run: `npm run build`
Expected: 성공(에러 없음). import 경로·문법 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/stampShare.js
git commit -m "feat: shareStampCard — 공유 코드 확보→이미지→share/다운로드 (이슈 #63 3단계)

navigator.canShare 지원 시 파일 공유 시트, 미지원 시 PNG 다운로드 + 링크
클립보드 복사. 사용자 취소(AbortError)는 조용히.

<표준 커밋 트레일러 2줄>"
```

---

### Task 6: `VisitStampModal` 공유 버튼 + `VisitStampBand` prop 전달

**Files:**
- Modify: `src/components/mypage/VisitStampModal.jsx`
- Modify: `src/components/mypage/VisitStampBand.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `src/lib/stampShare.js`의 `shareStampCard` (Task 5).
- Produces: 없음(UI 말단).

- [ ] **Step 1: `VisitStampBand.jsx` — 모달에 `targetPerDistrict` 전달**

`src/components/mypage/VisitStampBand.jsx:66-73`의 `<VisitStampModal … />` 호출에 prop 한 줄 추가:

```jsx
      {open && (
        <VisitStampModal
          stamp={stamp}
          target={target}
          targetPerDistrict={target}
          onTargetChange={setTarget}
          editable={!targetUserId}
          nickname={nickname}
          onClose={() => setOpen(false)}
        />
      )}
```

- [ ] **Step 2: `VisitStampModal.jsx` — import + props + 상태**

파일 상단 import에 추가:

```jsx
import { shareStampCard } from '../../lib/stampShare'
```

props 구조분해(`src/components/mypage/VisitStampModal.jsx:14`)에 `targetPerDistrict` 추가:

```jsx
export default function VisitStampModal({ stamp, target, targetPerDistrict, onTargetChange, editable, nickname, onClose }) {
```

`useState` 선언부(`customValue` 아래)에 공유 상태 추가:

```jsx
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState('')
```

- [ ] **Step 3: `VisitStampModal.jsx` — 공유 버튼 마크업**

구별 목록 `</ul>`(`src/components/mypage/VisitStampModal.jsx:168`) 바로 아래, `</div>`(모달 본문 닫기) 직전에 삽입:

```jsx
        {editable && (
          <div className="visit-stamp-share">
            <button
              type="button"
              className="visit-stamp-share-btn"
              disabled={sharing}
              onClick={async () => {
                setSharing(true)
                setShareMsg('')
                const r = await shareStampCard({
                  nickname: nickname ?? null,
                  stamp,
                  targetPerDistrict: targetPerDistrict ?? target,
                })
                setSharing(false)
                if (r.mode === 'download') setShareMsg('이미지를 저장했어요. 링크도 복사했어요.')
                else if (!r.ok && r.mode !== 'cancel') setShareMsg('공유에 실패했어요. 잠시 후 다시 시도해 주세요.')
                else setShareMsg('')
              }}
            >
              {sharing ? '만드는 중…' : '스탬프 공유하기'}
            </button>
            {shareMsg && <p className="visit-stamp-share-msg">{shareMsg}</p>}
          </div>
        )}
```

- [ ] **Step 4: `src/styles.css` — 공유 버튼 규칙**

기존 `.visit-stamp-modal-*` 규칙 근처에 추가(기존 색 토큰만):

```css
.visit-stamp-share{ margin-top:14px; display:flex; flex-direction:column; gap:6px; }
.visit-stamp-share-btn{ width:100%; padding:11px 14px; border:0; border-radius:12px; background:var(--accent); color:#fff; font-weight:700; font-size:.92rem; cursor:pointer; }
.visit-stamp-share-btn:disabled{ opacity:.6; cursor:default; }
.visit-stamp-share-msg{ margin:0; font-size:.8rem; color:var(--muted); text-align:center; }
```

- [ ] **Step 5: 빌드로 검증**

Run: `npm run build`
Expected: 성공. 이어서 `npm test` — 기존 122개 그대로 통과(이 태스크는 테스트 추가 없음, 회귀만 확인).

- [ ] **Step 6: 커밋**

```bash
git add src/components/mypage/VisitStampModal.jsx src/components/mypage/VisitStampBand.jsx src/styles.css
git commit -m "feat: 스탬프 모달에 공유하기 버튼 (이슈 #63 3단계)

본인 모달(editable)에만 노출. shareStampCard 호출 → 공유 시트/다운로드.
친구 모달엔 없음.

<표준 커밋 트레일러 2줄>"
```

---

### Task 7: `/s/:code` 공개 페이지 + 라우팅

**Files:**
- Create: `src/pages/StampSharePage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `src/lib/supabase.js`의 `supabase`(nullable). `src/hooks/useAuth.js`의 `useAuth`(프로바이더 불필요, 독립 훅). `src/components/mypage/daejeonStampPaths.js`의 `STAMP_VIEWBOX`, `DISTRICT_PATHS`. SQL RPC `get_public_stamp` (Task 3).
- Produces: 없음(페이지 말단).

- [ ] **Step 1: `src/App.jsx` — `/s/` 경로 분기**

전체를 아래로 교체(현재 5줄):

```jsx
import LandingPage from './pages/LandingPage'
import StampSharePage from './pages/StampSharePage'

// 라우터 없음 — pathname 만 본다. vercel.json 이 /s/* 를 index.html 로 rewrite 한다.
export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/s/')) {
    const code = decodeURIComponent(window.location.pathname.slice('/s/'.length)).trim()
    return <StampSharePage code={code} />
  }
  return <LandingPage />
}
```

- [ ] **Step 2: `src/pages/StampSharePage.jsx` 생성**

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { STAMP_VIEWBOX, DISTRICT_PATHS } from '../components/mypage/daejeonStampPaths'

function fillOpacity(pct) {
  return 0.15 + (0.85 * pct) / 100
}

// 공유 링크(/s/:code)로 들어온 비로그인 방문자에게 그 사람의 스탬프 결과를 전부 보여주고
// 로그인으로 유도한다. get_public_stamp 는 anon 실행이 허용된다.
export default function StampSharePage({ code }) {
  const { user } = useAuth()
  const [view, setView] = useState({ status: 'loading', data: null })

  useEffect(() => {
    const alive = { current: true }
    if (!code || !supabase) {
      setView({ status: 'notfound', data: null })
      return
    }
    supabase.rpc('get_public_stamp', { p_code: code }).then(({ data, error }) => {
      if (!alive.current) return
      if (error || !data) setView({ status: 'notfound', data: null })
      else setView({ status: 'ok', data })
    })
    return () => {
      alive.current = false
    }
  }, [code])

  useEffect(() => {
    if (view.status !== 'ok') return
    const prev = document.title
    document.title = `${view.data.nickname}님의 대전 빵 스탬프 · 빵모아`
    return () => {
      document.title = prev
    }
  }, [view])

  if (view.status === 'loading') {
    return (
      <div className="stamp-share-page">
        <p className="stamp-share-loading">불러오는 중…</p>
      </div>
    )
  }

  if (view.status === 'notfound') {
    return (
      <div className="stamp-share-page">
        <div className="stamp-share-card">
          <p className="stamp-share-empty">이 링크는 만료됐거나 존재하지 않아요.</p>
          <a className="stamp-share-cta" href="/">빵모아 홈으로</a>
        </div>
      </div>
    )
  }

  const { nickname, targetPerDistrict, stamp } = view.data
  const pctByName = Object.fromEntries(stamp.perDistrict.map((d) => [d.name, d.goalPct]))

  return (
    <div className="stamp-share-page">
      <div className="stamp-share-card">
        <h1 className="stamp-share-title">{nickname}님의 대전 빵 스탬프</h1>

        <svg
          className="stamp-share-map"
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
          {DISTRICT_PATHS.map(({ name, cx, cy }) => {
            const dark = (pctByName[name] ?? 0) >= 55
            return (
              <text
                key={name + '-label'}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="700"
                fill={dark ? '#fff' : 'var(--brown)'}
                stroke={dark ? 'rgba(76,49,13,0.45)' : '#fff'}
                strokeWidth="2.5"
                strokeLinejoin="round"
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
              >
                {name}
              </text>
            )
          })}
        </svg>

        <p className="stamp-share-headline">
          스탬프 {stamp.completedSlots}/{stamp.totalSlots}
          <span> · 목표 달성률 {stamp.goalPct}%</span>
        </p>
        <p className="stamp-share-sub">
          {stamp.completedDistrictCount}/5개 구 목표 완료 · 방문한 빵집 {stamp.visitedBakeryCount}곳 ·
          목표 구마다 {targetPerDistrict}곳
        </p>

        <ul className="stamp-share-list">
          {stamp.perDistrict.map((d) => (
            <li key={d.name}>
              <span className="stamp-share-list-name">{d.name}</span>
              <span className="visit-stamp-bar">
                <span className="visit-stamp-bar-fill" style={{ width: `${d.goalPct}%` }} />
              </span>
              <span className="stamp-share-list-pct">
                {d.completedSlots}/{d.target}
              </span>
              <span className="stamp-share-list-check" aria-hidden="true">
                {d.completed ? '✓' : ''}
              </span>
            </li>
          ))}
        </ul>

        <a className="stamp-share-cta" href="/">
          {user ? '내 스탬프 보러가기' : '로그인하고 나도 대전 빵 스탬프 시작하기'}
        </a>
        <p className="stamp-share-pitch">대전 5개 구 빵집을 돌면서 스탬프를 채워보세요.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `src/styles.css` — 공개 페이지 규칙**

파일 끝 근처(다른 `.visit-stamp-*` 뒤)에 추가. `.visit-stamp-bar` / `.visit-stamp-bar-fill` 는 기존 규칙 재사용:

```css
.stamp-share-page{ min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--card2); }
.stamp-share-loading{ color:var(--muted); font-size:.95rem; }
.stamp-share-card{ width:100%; max-width:420px; background:var(--card); border:1px solid var(--line); border-radius:18px; padding:22px; display:flex; flex-direction:column; gap:12px; }
.stamp-share-title{ margin:0; font-size:1.15rem; font-weight:800; color:var(--ink); text-align:center; }
.stamp-share-map{ width:100%; height:auto; }
.stamp-share-headline{ margin:0; text-align:center; font-size:1.05rem; font-weight:800; color:var(--accent-deep); }
.stamp-share-headline span{ color:var(--ink); font-weight:700; }
.stamp-share-sub{ margin:0; text-align:center; font-size:.8rem; color:var(--muted); line-height:1.5; }
.stamp-share-list{ list-style:none; margin:4px 0 0; padding:0; display:flex; flex-direction:column; gap:8px; }
.stamp-share-list li{ display:grid; grid-template-columns:56px 1fr auto 16px; align-items:center; gap:8px; font-size:.82rem; color:var(--ink); }
.stamp-share-list-name{ font-weight:700; color:var(--brown); }
.stamp-share-list-pct{ color:var(--muted); font-variant-numeric:tabular-nums; }
.stamp-share-list-check{ color:var(--accent-deep); }
.stamp-share-empty{ margin:0; text-align:center; color:var(--muted); font-size:.9rem; padding:12px 0; }
.stamp-share-cta{ display:block; margin-top:6px; padding:13px 16px; border-radius:12px; background:var(--accent); color:#fff; font-weight:800; font-size:.95rem; text-align:center; text-decoration:none; }
.stamp-share-pitch{ margin:0; text-align:center; font-size:.78rem; color:var(--muted); }
```

`--accent-deep` 토큰이 styles.css에 없으면 `--brown`으로 치환한다(먼저 `grep -n "accent-deep" src/styles.css`로 확인 — 목표 모델 스펙이 이 토큰을 사용 목록에 넣었으므로 있을 가능성이 높다).

- [ ] **Step 4: 빌드 + 테스트로 검증**

Run: `npm run build` → 성공.
Run: `npm test` → 기존 122개 통과(회귀 없음).

- [ ] **Step 5: 커밋**

```bash
git add src/pages/StampSharePage.jsx src/App.jsx src/styles.css
git commit -m "feat: /s/:code 공개 스탬프 페이지 + 로그인 유도 CTA (이슈 #63 3단계)

라우터 없이 App.jsx pathname 분기. get_public_stamp(anon) 로 결과 전체 표시,
비로그인이면 '로그인하고 시작', 로그인 상태면 '내 스탬프 보러가기' CTA.
잘못된 코드는 안내 문구.

<표준 커밋 트레일러 2줄>"
```

---

### Task 8: 정적 OG 메타 + 이미지 에셋

**Files:**
- Modify: `index.html`
- Create: `public/og-stamp-default.svg`

**Interfaces:**
- Consumes: 없음.
- Produces: 없음(정적 메타).

- [ ] **Step 1: `public/og-stamp-default.svg` 생성 (1200×630)**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fdf6ec"/>
  <text x="600" y="270" text-anchor="middle" font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif" font-size="88" font-weight="800" fill="#3d2b1f">대전 빵 스탬프 투어</text>
  <text x="600" y="360" text-anchor="middle" font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif" font-size="40" font-weight="600" fill="#9a8778">5개 구 빵집을 돌며 스탬프를 채우고 친구와 공유하세요</text>
  <text x="600" y="470" text-anchor="middle" font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif" font-size="44" font-weight="800" fill="#d98a3d">빵모아</text>
</svg>
```

주: 일부 스크래퍼는 SVG OG 이미지를 렌더하지 않는다. 라스터 PNG(1200×630)로 교체하는 것은 후속 디자인 작업이며, 파트 A/B 기능 동작은 OG에 의존하지 않는다. 지금은 SVG를 참조한다.

- [ ] **Step 2: `index.html` — OG/twitter 메타 추가**

`<title>대전 빵집 지도</title>` 바로 아래에:

```html
    <meta name="description" content="대전 5개 구 빵집을 돌면서 스탬프를 채우고 친구와 공유하세요." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="빵모아" />
    <meta property="og:title" content="대전 빵 스탬프 투어" />
    <meta property="og:description" content="대전 5개 구 빵집을 돌면서 스탬프를 채우고 친구와 공유하세요." />
    <meta property="og:image" content="/og-stamp-default.svg" />
    <meta name="twitter:card" content="summary_large_image" />
```

- [ ] **Step 3: 빌드로 검증**

Run: `npm run build`
Expected: 성공. `dist/index.html`에 메타 태그가 포함되고 `dist/og-stamp-default.svg`가 복사됐는지 확인(`ls dist`).

- [ ] **Step 4: 커밋**

```bash
git add index.html public/og-stamp-default.svg
git commit -m "feat: 정적 OG 메타 + 기본 공유 이미지 (이슈 #63 3단계)

현재 index.html 에 OG 태그 전무 → 순수 추가. 앱 전역 동일 OG. 사용자별
동적 OG(og-stamp)는 후속 이슈.

<표준 커밋 트레일러 2줄>"
```

---

## 최종 검증 (모든 태스크 후)

- [ ] `npm test` → 122개(기존 118 + 신규 4) 전부 통과.
- [ ] `npm run build` → 성공.
- [ ] `git diff --check` → 공백 오류 없음.
- [ ] 사용자에게 태스크 1~3 SQL을 Supabase에 적용하도록 안내(범위: `share_code` 컬럼 + 함수 3개 + grant).
- [ ] 수동 QA (`http://localhost:5173`, SQL 적용 후):
  - 본인 스탬프 모달 → `스탬프 공유하기` → 지원 브라우저는 공유 시트에 PNG, 미지원은 다운로드 + 링크 복사 + "이미지를 저장했어요…" 문구.
  - 다른 브라우저/시크릿(비로그인)에서 `http://localhost:5173/s/<코드>` → 결과 카드 전체 표시, 숫자가 소유자 마이페이지와 일치, CTA `로그인하고 …`.
  - `http://localhost:5173/s/없는코드` → "만료됐거나 존재하지 않아요" + 홈 버튼.
  - 친구 스탬프 모달엔 공유 버튼 없음.
  - 로그인 상태에서 `/s/<코드>` → CTA가 `내 스탬프 보러가기`.
- [ ] 커밋·푸시 여부를 사용자에게 확인. (PR 생성 안 함.)

## Self-Review (작성자 체크 완료)

**Spec coverage:**
- §1.1 `share_code` 컬럼 → Task 1 Step 1. §1.2 `ensure_share_code` → Task 1 Step 2. §1.3 `classify_daejeon_district` → Task 2. §1.4 `get_public_stamp` → Task 3. §1.5 search_path 목록 → 각 태스크 마지막 `alter function` 줄.
- §2.1 `stampShareImage.js` → Task 4. §2.2 `stampShare.js` → Task 5. §2.3 모달 공유 버튼 → Task 6 Step 2~4. §2.4 밴드 prop → Task 6 Step 1.
- §3.1 `App.jsx` 분기 → Task 7 Step 1. §3.2 `StampSharePage` → Task 7 Step 2. §3.3 OG 메타 + 에셋 → Task 8.
- §4 데이터 흐름 → Task 5(자랑) + Task 7(열람) 조합으로 구현. §5 테스트 → Task 4 단위 + 각 태스크 빌드 + 최종 검증 수동 QA.
- §6 파일 요약 표의 10개 파일 전부 태스크에 매핑됨(`public/og-stamp-default.png` → `.svg`로 대체, 근거는 Task 8 Step 1 주).
- §7 SDD ledger 메모 → 이 계획 문서 존재 자체로 충족, 별도 태스크 불필요.

**Placeholder scan:** SQL의 링 좌표는 Task 2에 전량 기입(생략 없음). 모든 코드 스텝에 실제 코드 블록 포함. "적절한 에러 처리" 류 문구 없음. `<표준 커밋 트레일러 2줄>`은 Global Constraints에 verbatim 정의된 고정 텍스트를 가리킴(플레이스홀더 아님).

**Type consistency:**
- `buildStampCardSvg({ nickname, stamp, targetPerDistrict })` — Task 4 정의, Task 5에서 동일 시그니처로 호출.
- `rasterizeStampCard(svgString) → Promise<Blob>` — Task 4 정의, Task 5에서 `await rasterizeStampCard(svg)`.
- `shareStampCard({ nickname, stamp, targetPerDistrict }) → { ok, mode?, error? }` — Task 5 정의, Task 6에서 `r.mode === 'download'` / `r.ok` / `r.mode !== 'cancel'`로 소비(정의된 필드와 일치).
- `get_public_stamp` 반환의 `{ nickname, targetPerDistrict, stamp }` — Task 3 정의, Task 7 Step 2에서 `const { nickname, targetPerDistrict, stamp } = view.data`로 구조분해. `stamp.perDistrict[].{name,goalPct,completedSlots,target,completed}`, `stamp.{completedSlots,totalSlots,goalPct,completedDistrictCount,visitedBakeryCount}` 모두 Task 3 `jsonb_build_object` 키와 일치.
- RPC 인자명 `p_code` — Task 3 SQL 정의, Task 7 `supabase.rpc('get_public_stamp', { p_code: code })`.
- `ensure_share_code` 무인자 — Task 1 정의, Task 5 `supabase.rpc('ensure_share_code')`.
- `STAMP_VIEWBOX`, `DISTRICT_PATHS`(`{name,d,cx,cy}`) — 기존 `daejeonStampPaths.js` export, Task 4·7에서 동일 형태로 사용.
