# 방문 인증 좌표를 서버 신뢰 값으로 (이슈 #69)

**날짜:** 2026-09-03
**브랜치:** `fix/stamp` → PR base `develop` (#63·#68 작업은 PR #68로 `develop`에 병합됨; `fix/stamp`는 `develop` 팁에서 분기)
**관련 이슈:** #69 ([BE] 방문 인증 좌표를 서버 신뢰 값으로 검증 — 클라이언트 위조 차단)
**선행 스펙:** `docs/superpowers/specs/2026-09-01-visit-stamp-share-design.md`
("PR #68 코드리뷰 후 ruling"에서 이 이슈를 후속으로 분리)

## 배경 및 목표

`create_diary_entry` RPC의 거리 검증은 GPS 좌표(`p_lat/p_lng`)와 빵집 좌표(`p_bakery.lat/lng`)를
대조하는데 **둘 다 클라이언트가 보낸 값**이다. 앱에 빵집을 소유한 서버 테이블이 없어(외부 API 기반)
신뢰 가능한 빵집 좌표 출처가 없다. → RPC를 UI 없이 직접 호출해 두 인자에 같은 대전 좌표를 넣으면
거리 0으로 어떤 빵집이든 `verified = true`가 된다. #68에서 "두 좌표가 모두 대전 광역 bbox 안일 때만
검증" 임시 방어를 넣었지만, 실제 대전 좌표를 아는 호출자는 여전히 위조할 수 있다.

**목표:** `bakery_id`로 **서버가 보유한 신뢰 좌표**를 조회해 검증에 쓰고, 클라이언트가 보낸
`p_bakery.lat/lng`는 검증에서 배제한다. 신뢰 좌표를 못 구하면 `verified = false`로 저장한다(기록 자체는
계속 가능). 영향 범위는 본인 스탬프 조작뿐이고 보상 미연동이라, 완전 차단보다 "위조 경로를 닫고
미해결은 미인증 처리"가 이번 범위다.

## 결정 요약 (브레인스토밍 2026-09-03)

- **kakao 좌표 해석 = 재검색 후 ID 매칭.** Kakao Local엔 공식 place-by-id 엔드포인트가 없다. 서버
  REST 키로 키워드 검색(빵집명 + 대전 `rect` 한정)을 돌려 응답 `documents` 중 `doc.id`가 요청한
  `kakao:{id}`의 네이티브 id와 정확히 일치하는 항목의 좌표를 신뢰값으로 쓴다. 못 찾으면 미해결.
- **tour 좌표 해석 = KorService2 `detailCommon2`.** `contentId`로 조회해 `mapy/mapx`를 신뢰값으로 쓴다.
- **실행 위치 = Edge Function + 캐시.** 새 Edge Function `resolve-bakery-coords`가 외부 API를 조회해
  `bakery_coords`에 upsert한다. 프런트는 기록 저장 RPC **직전에** 이 함수를 호출한다.
  `create_diary_entry`는 `bakery_coords`만 읽어 거리를 판정한다(임시 bbox 게이트 제거).
- **기존 `verified = true` 백필 없음.** #68 bbox로 이미 대전 범위로 걸러졌고 보상 미연동이라 소급
  위조 이득이 없다. `schema.sql`에 사유 주석만 남기고 신규 기록부터 서버 좌표 기준으로 판정한다.

## 제외 사항

- 클라이언트 UI/기록 작성 흐름 변경 — `useDiaryEntries.addEntry` 내부에 함수 호출 1줄만 추가하고
  화면·모달·문구는 그대로 둔다.
- `get_public_stamp` / `computeVisitStamps`의 **구 분류**를 `bakery_coords` 기준으로 바꾸는 것 — 지금은
  `bakery.lat/lng`(클라 값)로 분류한다. 별도 하드닝 이슈로 분리(이 이슈는 `verified` 판정만 다룬다).
- `bakery_coords` TTL 재조회 스윕, 관리자 백필 배치, 좌표 변경 감지 — `fetched_at` 컬럼만 남겨 여지로 둔다.
- 이 기능에 금전/보상 연동 — 스펙 #63 ruling대로 이 검증이 끝나기 전엔 하지 않는다.
- DB/Edge Function 통합 테스트 — 레포 관례(브라우저·DB 의존은 테스트 안 함). 순수 JS 로직만 테스트.

---

## 1. DB — `bakery_coords` (`supabase/schema.sql`)

파일 맨 끝에 `-- ===== 이슈 #69: 방문 인증 좌표 서버 신뢰값 =====` 섹션을 추가한다. 전체 재실행이
안전하도록 모든 문장을 idempotent하게 쓴다.

```sql
create table if not exists bakery_coords (
  bakery_id  text primary key,                 -- 'tour:{contentid}' | 'kakao:{doc.id}'
  lat        double precision not null,
  lng        double precision not null,
  source     text not null check (source in ('tour', 'kakao')),
  fetched_at timestamptz not null default now()
);

alter table bakery_coords enable row level security;
-- 정책을 만들지 않는다 = authenticated/anon 직접 접근 전면 거부.
-- 읽기: create_diary_entry(security definer — 함수 소유자 권한이라 RLS 우회).
-- 쓰기: resolve-bakery-coords Edge Function(service-role 키 — RLS 우회).
```

- PK가 유일한 조회 경로(`where bakery_id = ?`)라 추가 인덱스 없음.
- `fetched_at`은 후속 TTL 재조회 스윕 여지용. 이번엔 읽지도 쓰지도 않는다(`default now()`만).
- `source`는 진단용(어느 경로로 채워졌는지). 검증 로직은 참조하지 않는다.

---

## 2. Edge Function `resolve-bakery-coords` (신설)

`supabase/functions/resolve-bakery-coords/`. `og-stamp`와 같은 패턴: `Deno.env.get`, 원시 `fetch`,
PostgREST 직접 호출(전용 supabase 클라이언트 미도입).

### 2.1 진입 · 인증

```
supabase/functions/resolve-bakery-coords/
  index.ts        -- 진입점. Deno.serve(handler).
  coordMatch.js   -- 순수 매칭 로직 (Deno API 미사용 — §7 테스트가 import).
```

`supabase/config.toml`에 추가:

```toml
[functions.resolve-bakery-coords]
verify_jwt = true
entrypoint = "./functions/resolve-bakery-coords/index.ts"
```

- `verify_jwt = true` 는 **JWT 서명만** 검증한다. 클라 번들에 실린 공개 `anon` 키도 유효한
  서명 JWT라 이것만으로는 익명 호출을 막지 못한다. 그래서 핸들러가 추가로 토큰 payload 의
  `role` 을 디코드해 `authenticated` 가 아니면 `{ resolved: false }` 로 즉시 거부한다(익명이
  서버 Kakao/관광공사 키를 태우거나 `bakery_coords` 를 쓰는 것 차단). 플랫폼이 서명을 이미
  확인했으므로 payload 신뢰는 안전하다. preflight `OPTIONS` 는 JWT 없이 통과시키므로 role
  확인보다 먼저 CORS 응답만 하고 끝낸다.
- 사용자 식별은 role 확인 외엔 하지 않는다(어떤 사용자가 호출하든 좌표는 `bakery_id`로만
  결정되고, 반환은 성공/실패 플래그뿐이라 사용자별 데이터가 없다).
- `og-stamp`(`verify_jwt = false`, `withSupabase({ auth: 'none' })`)와 정반대 — 명시적으로.

### 2.2 요청 / 응답 계약

**요청** `POST` body `{ "bakery_id": "kakao:12345678", "name": "성심당 본점" }`
- `bakery_id` 필수. `name`은 kakao 재검색어로만 쓰인다(위조해도 얻는 게 없음 — 결국 `doc.id`
  일치로 좌표를 고르므로 엉뚱한 이름은 "미해결"로 귀결).

**응답** 항상 `200`, body `{ "resolved": true | false }`
- `resolved: true` — `bakery_coords`에 행이 있음(이번 호출로 넣었거나 이미 있었음).
- `resolved: false` — 외부 API 실패 / 결과 없음 / ID 불일치 / 대전 bbox 밖. **에러를 던지지 않는다.**
- 프런트는 이 값을 보지 않고 무시한다(§4). 계약은 관측/디버깅·후속용.

### 2.3 순수 로직 — `coordMatch.js`

```js
// Deno API 미사용. supabase/functions 밖(src 테스트)에서도 import 한다.

// 출처: src/config/regions.js 의 대전 region.bbox. 변경 시 양쪽을 반드시 동기화.
export const DAEJEON_BBOX = { minLat: 36.18, maxLat: 36.5, minLng: 127.25, maxLng: 127.56 }

// 'kakao:123' -> { source:'kakao', nativeId:'123' } | null
export function parseBakeryId(bakeryId) {
  const m = /^(tour|kakao):(.+)$/.exec(String(bakeryId ?? '').trim())
  return m ? { source: m[1], nativeId: m[2] } : null
}

export function inDaejeon(lat, lng, bbox = DAEJEON_BBOX) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= bbox.minLat && lat <= bbox.maxLat &&
    lng >= bbox.minLng && lng <= bbox.maxLng
  )
}

// Kakao 키워드검색 documents[] 에서 nativeId 와 정확히 일치하는 항목의 좌표.
// (doc.x = lng, doc.y = lat)
export function pickKakaoMatch(documents, nativeId) {
  for (const d of documents ?? []) {
    if (String(d.id) !== String(nativeId)) continue
    const lat = parseFloat(d.y)
    const lng = parseFloat(d.x)
    return inDaejeon(lat, lng) ? { lat, lng } : null
  }
  return null
}

// KorService2 detailCommon2 item -> 좌표. (item.mapx = lng, item.mapy = lat)
export function pickTourCoord(item) {
  const lat = parseFloat(item?.mapy)
  const lng = parseFloat(item?.mapx)
  return inDaejeon(lat, lng) ? { lat, lng } : null
}
```

`inDaejeon` 게이트를 매칭 단계에도 두는 이유: 재검색이 동명 타지역 장소를 반환하거나 관광공사
좌표가 이상치일 때 "신뢰 좌표"로 캐시되는 것을 막는다. #68 bbox 게이트의 취지를 서버측으로 옮긴 것.

### 2.4 `index.ts` 흐름

1. body 파싱. `bakery_id` 없으면 `{ resolved: false }`.
2. `parseBakeryId` 실패하면 `{ resolved: false }`.
3. **캐시 확인:** `GET ${SUPABASE_URL}/rest/v1/bakery_coords?bakery_id=eq.{id}&select=bakery_id`
   (헤더 `apikey`/`Authorization: Bearer ${SERVICE_ROLE_KEY}`). 1건 이상이면 `{ resolved: true }` 즉시 반환.
4. **source별 조회** (각 호출 `AbortController` 6s 타임아웃, `try/catch`로 감싸 실패 시 아래 6으로):
   - `tour` — `GET https://apis.data.go.kr/B551011/KorService2/detailCommon2`
     `?serviceKey={TOUR_API_KEY}&MobileOS=ETC&MobileApp=DaejeonBreadMap&_type=json`
     `&contentId={nativeId}&numOfRows=1&pageNo=1`.
     `response.body.items.item`(단일 객체 가능) → `pickTourCoord`.
   - `kakao` — `GET https://dapi.kakao.com/v2/local/search/keyword.json`
     `?query={name}&size=15&page={1..3}&rect=127.25,36.18,127.56,36.5`
     헤더 `Authorization: KakaoAK ${KAKAO_REST_KEY}`. 최대 3페이지를 순회하며 각 페이지 `documents`에
     `pickKakaoMatch(documents, nativeId)` — 첫 일치에서 멈춘다. `name`이 비었으면 조회 생략(미해결).
5. **좌표 확보 시 upsert:**
   `POST ${SUPABASE_URL}/rest/v1/bakery_coords`
   헤더 `apikey`/`Authorization: Bearer ${SERVICE_ROLE_KEY}` /
   `Content-Type: application/json` / `Prefer: resolution=merge-duplicates`
   body `{ bakery_id, lat, lng, source, fetched_at: new Date().toISOString() }` → `{ resolved: true }`.
6. **그 외 전부** (외부 API 오류·타임아웃·결과 없음·ID 불일치·bbox 밖·upsert 실패) →
   `console.error('[resolve-bakery-coords] ...', err)` 후 `{ resolved: false }`.

### 2.5 시크릿 (§5에서 등록)

| 이름 | 용도 | 비고 |
|---|---|---|
| `KAKAO_REST_KEY` | Kakao Local 서버 조회 | **신규** — 클라(`VITE_KAKAO_REST_KEY`)와 별개 키 발급(이슈 요구) |
| `TOUR_API_KEY` | KorService2 서버 조회 | **전용 data.go.kr 키를 따로 발급**(자체 쿼터). 클라의 `VITE_TOUR_API_KEY`와 **같은 값 금지** — 여기서 쿼터가 소진되면 메인 빵집 목록까지 죽는다 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | `bakery_coords` 읽기/upsert | Supabase가 함수에 자동 주입 |

---

## 3. `create_diary_entry` 재작성 (`supabase/schema.sql`)

기존 정의를 `create or replace`로 교체한다. 시그니처·`returns`·`grant`/`revoke ... from public, anon`은
**변경 없음**. 바뀌는 것은 검증부뿐이다.

**제거:** `p_bakery -> 'lat'/'lng'` 추출 블록, `v_bakery_lat/lng between 36.0..36.7 / 127.0..127.9`
및 `v_visit_lat/lng between ...` 임시 bbox 게이트.

**추가:** `bakery_coords` 조회 → 있으면 거리 판정, 없으면 `verified = false`.

```sql
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
  -- 캐시 미스(resolve-bakery-coords 가 아직 못 채웠거나 좌표 미해결)면 v_verified 는 false 로 남고,
  -- 기록 자체는 그대로 저장된다.
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
```

- `p_bakery` jsonb는 지금처럼 통째로 저장한다(표시·구 분류가 계속 사용 — §제외 참고).
- 거리 임계 150m는 그대로.
- `bakery_coords`는 이 함수 정의보다 앞선 SQL 줄에서 생성돼야 한다(파일 끝 §1 섹션이 이 함수보다
  뒤이므로, `create_diary_entry` `replace`도 §1과 같은 새 섹션에 함께 두거나 §1을 함수 앞 섹션에
  배치한다 — 재실행 시 순서 안전하게).

## 4. 프런트 — `useDiaryEntries.addEntry` (`src/hooks/useDiaryEntries.js`)

```js
const addEntry = (bakery, text, location = null) => {
  if (!user) return Promise.resolve({ error: new Error('로그인이 필요해요.') })

  // 이슈 #69: RPC 는 bakery_coords(서버 신뢰 좌표)만 보고 verified 를 판정한다.
  // 저장 직전에 서버측 좌표 해석을 1회 시도해 캐시를 채운다. 실패해도(미해결/함수 오류)
  // 기록은 그대로 저장되며 그 경우 verified=false 가 된다 — 흐름을 막지 않는다.
  return supabase.functions
    .invoke('resolve-bakery-coords', {
      body: { bakery_id: bakery.id, name: bakery.name },
    })
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

- `functions.invoke`는 이 레포에서 첫 사용. `@supabase/supabase-js`에 내장(추가 의존성 없음).
- `bakery`는 정규화된 Bakery 객체라 `bakery.id`(`tour:`/`kakao:` 접두)와 `bakery.name`이 항상 있다
  (`RecommendCard` → `DiaryEntryModal onSubmit` → `addEntry(bakery, ...)`).
- UI·모달·성공/실패 문구 변화 없음. 사용자에겐 투명하다(약간의 지연만 추가).

## 5. 설정 · 시크릿 · 배포

- `supabase/config.toml` — §2.1 블록 추가.
- 시크릿 등록: `supabase secrets set KAKAO_REST_KEY=... TOUR_API_KEY=...`
  (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`는 자동 주입 — 등록 불필요).
- 배포: `supabase functions deploy resolve-bakery-coords`.
- `README.md`의 환경변수/Supabase 섹션에 서버 전용 Kakao REST 키 발급·등록 절차를 한 단락 추가.
- 로컬: `supabase functions serve resolve-bakery-coords --env-file supabase/functions/.env.local`
  (`.env.local`은 `.gitignore` 확인 후 추가).

## 6. 기존 `verified = true` 백필 — 하지 않음

`schema.sql` §1 섹션에 주석으로 근거를 남긴다:

```sql
-- 기존 verified=true 기록은 소급 재검증하지 않는다. #68 의 대전 광역 bbox 게이트로 이미
-- 대전 범위 좌표만 통과했고, 이 기능엔 아직 금전/보상이 없어 과거 데이터 위조 이득이 없다.
-- 신규 기록부터 bakery_coords 기준으로 판정한다. (필요해지면 별도 재검증 스크립트 이슈.)
```

## 7. 테스트

`src/lib/resolveBakeryCoords.test.js` (신설) — `node --test` 관례. `coordMatch.js`를
`../../supabase/functions/resolve-bakery-coords/coordMatch.js`로 import(파리티 테스트가
`../../supabase/schema.sql`을 읽는 전례와 동일).

| 케이스 | 기대 |
|---|---|
| `parseBakeryId('kakao:123')` / `'tour:741957'` | `{source,nativeId}` |
| `parseBakeryId('foo')` / `''` / `null` / `'kakao:'` | `null` |
| `inDaejeon(36.35, 127.42)` | `true` |
| `inDaejeon(37.56, 126.97)` (서울) / `inDaejeon(0,0)` / `NaN` | `false` |
| `pickKakaoMatch([{id:'123',x:'127.42',y:'36.35'}], '123')` | `{lat:36.35, lng:127.42}` |
| `pickKakaoMatch([{id:'999',...}], '123')` (ID 불일치) | `null` |
| `pickKakaoMatch([{id:'123',x:'126.97',y:'37.56'}], '123')` (대전 밖) | `null` |
| `pickKakaoMatch([], '123')` / `pickKakaoMatch(null, '123')` | `null` |
| `pickTourCoord({mapx:'127.42', mapy:'36.35'})` | `{lat:36.35, lng:127.42}` |
| `pickTourCoord({mapx:'0', mapy:'0'})` / `{}` | `null` |

RPC 거리 판정·Edge Function I/O는 DB/네트워크 의존이라 자동 테스트하지 않는다. 대신 아래 수동 검증을
PR 설명에 기록한다:

1. `bakery_coords`에 행이 없는 새 `kakao:` 빵집으로 기록 작성 → `verified = false`.
2. `resolve-bakery-coords`를 실존 `kakao:` 빵집으로 호출 → `bakery_coords`에 행 생성 확인.
3. 같은 빵집에 실제 근처(≤150m) GPS로 기록 작성 → `verified = true`, `verified_at` 채워짐.
4. 같은 빵집에 먼 GPS(>150m)로 작성 → `verified = false`.
5. RPC를 직접 호출해 `p_bakery.lat/lng`에 GPS와 동일 좌표를 넣어도 `bakery_coords` 좌표로만
   판정됨 확인(위조 차단).

## 8. 구현 순서 (개략 — 상세는 implementation plan)

1. `schema.sql` — `bakery_coords` 테이블 + `create_diary_entry` 교체 + 백필 주석. (수동 실행 파일)
2. `coordMatch.js` + `resolveBakeryCoords.test.js` → `npm test` 통과.
3. `resolve-bakery-coords/index.ts` + `config.toml` 엔트리.
4. `useDiaryEntries.js` — `functions.invoke` 추가.
5. `README.md` 환경변수 절 갱신.
6. 시크릿 등록 + 함수 배포 + §7 수동 검증.

## 부록 — 대전 bbox 동기화

`DAEJEON_BBOX`(`coordMatch.js`)는 `src/config/regions.js`의 대전 `region.bbox`
`{ minLat: 36.18, maxLat: 36.5, minLng: 127.25, maxLng: 127.56 }`와 같은 값이다. `regions.js`를 고치면
`coordMatch.js`도 함께 고친다(파리티 테스트로 강제하지는 않음 — 두 파일 상단 주석으로만 표시).
