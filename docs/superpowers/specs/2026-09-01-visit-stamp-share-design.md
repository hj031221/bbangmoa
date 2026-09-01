# 방문 스탬프 — 공유 (이슈 #63, 3단계)

**날짜:** 2026-09-01
**브랜치:** `feature-stamp` (base: `develop`)
**선행 스펙:**
- `docs/superpowers/specs/2026-09-01-visit-stamp-widget-design.md` (1단계 위젯)
- `docs/superpowers/specs/2026-09-01-visit-stamp-goals-design.md` (사용자 설정 목표 모델 — **이 문서가 지표·표시 모델의 기준**)
**관련 이슈:** #63 ([FEAT] 마이페이지 방문 스탬프 + 방문 인증 + 공유)

## 배경 및 목표

1·2단계로 마이페이지에 구별 방문 스탬프 위젯과 방문 인증(GPS 150m)이 들어갔다. 3단계는 이 스탬프를
**밖으로 내보내 신규 유입 → 로그인 전환 깔때기**로 쓴다. 사용자가 원하는 것은 세 가지다.

1. **자랑** — 내 스탬프 화면을 사진(PNG)으로 저장/공유한다.
2. **열람** — 링크를 받은 사람이 우리 사이트 안에서 그 사람의 스탬프 결과 화면을 직접 본다(로그인 불필요).
3. **전환** — 그 결과 화면에서 로그인으로 유도한다.

로그인·회원 시스템은 이미 있다(`useAuth`, `profiles`, 친구 기능). 이 스펙에서 새로 만드는 것은
공유 코드, 공개 집계 조회 경로, `/s/:code` 공개 페이지, 이미지 카드 생성뿐이다.

## 최종 리뷰 후 ruling (2026-09-01)

아래 ruling은 이 문서의 초기 브레인스토밍 결정과 충돌할 때 우선한다.

- **공개 코드**: 이슈 #63의 계약대로 새 링크는 `profiles.friend_code`를 재사용한다. 초기 구현에서 이미
  `share_code`를 만든 환경과 발송된 링크만 깨지지 않도록 DB 조회에서 legacy `share_code`를 함께 허용한다.
  새 클라이언트는 `ensure_share_code()`를 호출하지 않는다.
- **OG 범위**: 동적 OG를 이번 3단계에 포함한다. 공개 `og-stamp` Supabase Edge Function은
  `get_public_stamp` 집계만 읽어 1200×630 PNG를 만들고, Vercel `/s/:code` 응답이 code별 절대
  `og:image` URL을 서버에서 주입한다. 함수 배포 전에는 정적 PNG를 사용한다.
- **공유 실행**: 모달이 열린 동안 사이트 폰트가 내장된 PNG와 공개 링크를 병렬 준비한다. 실제 클릭은
  준비된 파일로 `navigator.share()`를 즉시 호출한다. 링크 준비 실패는 PNG 공유/저장을 막지 않는다.
- **카드 디자인**: 사이트의 `학교안심 둥근미소` WOFF2와 크림·코랄·브라운 토큰을 SVG에 내장한다.
  중앙 정렬 템플릿 대신 큰 달성률과 지도, 구별 기록을 비대칭 기록지 레이아웃으로 구성한다.
- **폴백 메시지**: 클립보드 쓰기 성공 여부를 반환해 실제 복사됐을 때만 복사 완료를 안내한다.

## 초기 브레인스토밍 결정 (위 ruling으로 일부 대체됨)

- **OG 범위**: 이번 라운드는 파트 A(이미지 카드) + 파트 B(공개 링크)만. 사용자별 **동적 OG 이미지
  (`og-stamp` Edge/서버리스 함수)는 후속 이슈**로 분리. 지금은 정적 기본 OG 이미지 1장.
- **공개 코드**: `friend_code`를 재사용하지 않고 **`profiles.share_code` 전용 컬럼을 신설**한다.
  `friend_code`는 현재 `find_user_by_friend_code`가 `authenticated` 전용이고 schema.sql에 "낯선 사람에게
  노출 금지" 원칙이 명시돼 있다(PR #57에서 유출 수정). 공유는 별도 토큰으로 그 신뢰 경계를 건드리지
  않고, 나중에 "링크 재발급"으로 무효화할 여지를 남긴다.
- **이미지 생성**: 새 의존성 없이 **자체 완결 SVG 문자열 → `<canvas>` → PNG Blob**. 카드 전체를 한
  장의 SVG로 그려 외부 리소스가 없으므로 canvas taint가 없다.
- **로그인 유도 방식**: 공개 페이지는 **결과를 전부 보여주고**(게이트·블러 없음) 하단에 강한 CTA
  버튼 하나. 친구추가 모달 자동 노출 없음.
- **라우팅**: 라우터를 도입하지 않는다. `App.jsx`에서 `window.location.pathname`을 분기한다
  (`useInviteLink`가 `window.location.search`를 직접 읽는 기존 패턴과 동일). `vercel.json`은 이미
  `/s/...`를 `index.html`로 rewrite하므로 수정 불필요.
- **SVG 지도 컴포넌트 추출 안 함**: 밴드·모달의 5구 SVG는 방금(목표 모델 PR) 라벨 색·`paint-order`가
  튜닝됐다. 공유 카드 SVG는 React 컴포넌트가 아니라 문자열 빌더라 어차피 공유가 안 되고, 공개 페이지
  1곳을 위해 밴드/모달을 건드리는 회귀 위험이 이득보다 크다. `DISTRICT_PATHS` 데이터 모듈
  (`daejeonStampPaths.js`)과 `fillOpacity` 2줄 헬퍼는 지금처럼 각 소비처에 로컬로 둔다(레포 전례).
- **코드 생성 로직**: `generate_friend_code()`를 리팩터하지 않고 `ensure_share_code()` 안에 동일한
  8자리 루프를 인라인한다(주석으로 출처 표기). 트리거 체인에 얽힌 함수를 안 건드린다.

## 제외 사항

- 공개 페이지의 결과 게이트/블러/부분 공개 — 전체 공개로 확정.
- 공개 페이지에서의 친구추가 자동 유도·딥링크 — 범위 밖(CTA는 `/`로만).
- `share_code` 재발급/비활성화 UI — 이번엔 지연 생성만. 컬럼과 RPC 구조는 후속 재발급을 막지 않게 둔다.
- 공개 RPC 레이트리밋 — `share_code`가 32^8 공간이라 열거가 비현실적. 후속 여지로만 기록.
- 컴포넌트/페이지/RPC의 단위 테스트 — 레포 관례(브라우저·DB 의존은 테스트 안 함). `lib` 순수 함수만.
- `diary_entries.visit_district` 컬럼 등 write 시 구 사전계산 — 채택 안 함(§1.3 대안 검토 참고).

---

## 1. DB (`supabase/schema.sql`)

파일 맨 끝에 `-- ===== 이슈 #63 3단계: 공유 =====` 섹션을 추가한다. 전체 재실행이 안전하도록 모든
문장을 idempotent하게 쓴다. 기존 컬럼 추가 패턴(`stamp_target` 등)과 `security definer` +
`set search_path = public, pg_temp` 관례를 따른다.

### 1.1 `profiles.share_code`

```sql
alter table profiles add column if not exists share_code text unique;
```

- nullable. 첫 공유 때 지연 생성. 기존/신규 행 백필 없음(트리거 수정 불필요).
- `authenticated`의 컬럼 단위 update grant 목록에 **추가하지 않는다** — 현재
  `grant update (nickname, avatar_url, avatar_version, stamp_target) on profiles to authenticated;`
  를 그대로 둔다. `share_code`는 오직 §1.2 RPC로만 설정된다.
- `profiles_select_self_or_related` RLS는 변경하지 않는다. 공개 조회는 §1.4 `security definer` RPC로만
  이뤄지고, RPC가 컬럼(닉네임·집계 수치)만 골라 반환한다(메모리 원칙: profiles RLS 확장 금지).

### 1.2 `ensure_share_code()` — 지연 생성

```sql
create or replace function ensure_share_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- generate_friend_code() 와 동일 문자셋
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
```

- `security definer`라 컬럼 update grant를 우회해 `share_code`를 쓸 수 있다(사용자 직접 쓰기는 여전히 불가).
- 멱등: 이미 코드가 있으면 그 값을 그대로 반환한다. 동시 최초 호출이 겹쳐 `unique` 충돌이 나면
  호출부에서 1회 재시도(§2.2)하거나, 함수에 `on conflict` 없는 단순 재조회로 충분(경합 창이 극히 좁음).

### 1.3 `classify_daejeon_district(lat, lng)` — 좌표 → 구

`src/lib/districtFromPoint.js`의 홀짝 ray-casting을 PL/pgSQL로 포팅한다.

```sql
create or replace function classify_daejeon_district(p_lat float8, p_lng float8)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  -- 출처: src/data/daejeonDistricts.js 의 DISTRICT_RINGS. 좌표 변경 시 양쪽을 반드시 동기화.
  -- 순회 순서(동구→중구→서구→유성구→대덕구)가 경계 공유 지점의 귀속을 결정하므로
  -- jsonb '객체'가 아니라 '배열'로 저장해 순서를 보존한다.
  -- 구현 계획에서 DISTRICT_RINGS 5개 링의 전체 좌표(약 85점)를 아래에 그대로 붙여넣는다.
  v_rings jsonb := '[
    {"name":"동구","ring":[[36.41936,127.51778], … ]},
    {"name":"중구","ring":[ … ]},
    {"name":"서구","ring":[ … ]},
    {"name":"유성구","ring":[ … ]},
    {"name":"대덕구","ring":[ … ]}
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
      v_yi := (v_ring -> v_i -> 0)::text::float8;  -- ring 좌표는 [lat, lng]
      v_xi := (v_ring -> v_i -> 1)::text::float8;
      v_yj := (v_ring -> v_j -> 0)::text::float8;
      v_xj := (v_ring -> v_j -> 1)::text::float8;
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
```

- 링 데이터 전체(5폴리곤, 약 85점)를 리터럴로 복제한다. 행정경계라 사실상 불변이고, JS 원본에
  "동기화 주의" 주석을 남긴다. `daejeon_district_rings` 테이블/PostGIS는 도입하지 않는다.
- **대안 검토**: ① 조회 시 SQL 재분류(채택) ② `diary_entries.visit_district` 컬럼을
  `create_diary_entry`에서 계산 + 기존 행 백필 ③ PostGIS `ST_Contains`.
  ②③은 스키마·확장 부담이 크고 ray-casting 중복은 ①②가 동일하다. ①이 가장 가볍다.

### 1.4 `get_public_stamp(code)` — 공개 집계 조회

```sql
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
    return null;              -- 공개 페이지가 "링크를 찾을 수 없어요" 처리
  end if;

  v_target := least(20, greatest(1, coalesce(v_target, 3)));  -- 클라 clampTarget 과 동일
  v_total_slots := v_target * 5;

  -- verified 기록에서 '빵집 좌표'로 구를 판정하고(소유자 본인 화면과 동일 기준),
  -- 구별 서로 다른 빵집 수를 센다.
  with visited as (
    select distinct
      classify_daejeon_district(
        (bakery ->> 'lat')::float8, (bakery ->> 'lng')::float8
      ) as district,
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
      n as name,
      coalesce(c.cnt, 0) as count,
      v_target as target,
      least(coalesce(c.cnt, 0), v_target) as completed_slots,
      round(least(coalesce(c.cnt, 0), v_target)::numeric / v_target * 100)::int as goal_pct,
      coalesce(c.cnt, 0) >= v_target as completed
    from unnest(v_names) with ordinality as names(n, ord)
    left join counted c on c.district = names.n
    order by names.ord
  )
  select
    jsonb_agg(jsonb_build_object(
      'name', name, 'count', count, 'target', target,
      'completedSlots', completed_slots, 'goalPct', goal_pct, 'completed', completed
    )),
    sum(completed_slots)::int,
    sum(count)::int,
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
```

- **비로그인 실행 허용**이 이 함수의 목적이다(`anon` grant). 다른 3단계 함수와 정반대.
- 반환 `stamp` 객체는 프런트 `computeVisitStamps()` 반환과 **필드명·구조가 정확히 일치**한다
  (`perDistrict[{name,count,target,completedSlots,goalPct,completed}]`,
  `visitedBakeryCount / completedSlots / totalSlots / goalPct / completedDistrictCount`).
  공개 페이지가 재가공 없이 같은 렌더링 로직에 그대로 넣는다.
- **노출 금지**: 기록 원문(`text`), `visit_lat/visit_lng`, 빵집 id·이름·목록, `friend_code`, `user_id`.
  닉네임과 집계 수치만 반환한다.
- 빵집 좌표(`bakery` jsonb) 기준으로 분류하는 이유: 소유자 본인의 밴드/모달도
  `computeVisitStamps`가 `e.bakery.lat/lng`로 분류하므로, 공개 숫자가 본인 화면과 어긋나지 않게 한다.
- `stable` + 세트 기반 단일 쿼리. 사용자당 기록 수십 건 × 5폴리곤이라 비용 무시 가능.

### 1.5 함수 search_path 고정

기존 파일 끝의 `alter function … set search_path` 목록 관례에 맞춰 신규 3개도 명시한다(이미 정의에
포함했으나 재실행 시 일관성 위해 목록에도 추가).

```sql
alter function ensure_share_code() set search_path = public, pg_temp;
alter function classify_daejeon_district(float8, float8) set search_path = public, pg_temp;
alter function get_public_stamp(text) set search_path = public, pg_temp;
```

---

## 2. 프런트 — 이미지 카드 (파트 A)

### 2.1 `src/lib/stampShareImage.js` (신설)

순수 함수. `daejeonStampPaths.js`의 `STAMP_VIEWBOX` / `DISTRICT_PATHS`만 의존.

```js
buildStampCardSvg({ nickname, stamp, targetPerDistrict }) → string   // 1080×1350 SVG 문자열
rasterizeStampCard(svgString) → Promise<Blob>                         // image/png
```

**`buildStampCardSvg`**
- 루트 `<svg xmlns width="1080" height="1350" viewBox="0 0 1080 1350">`.
- 색은 **리터럴 hex**로 박는다(캔버스 래스터에는 CSS `var(--…)`가 안 먹는다). styles.css의
  브랜드 색과 눈으로 맞춘 상수를 이 파일 상단에 모아둔다(`BG`, `INK`, `ACCENT`, `BROWN`, `MUTED`).
- `font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif"`.
  웹폰트 임베드 안 함 — 래스터 시 기기 기본 한글 산세리프로 렌더된다(허용).
- 레이아웃(위→아래):
  1. 상단 타이틀 `{nickname}님의 대전 빵 스탬프` (닉네임 과다 길이는 `textLength`+`lengthAdjust` 또는
     JS단에서 12자 말줄임).
  2. 큰 5구 지도: `DISTRICT_PATHS`의 `d`를 그대로 그리고 구별 `fill-opacity`는 로컬
     `fillOpacity(goalPct)` (밴드/모달과 동일 식 `0.15 + 0.85*pct/100`), `fill="#<ACCENT>"`,
     `stroke="#<BROWN>"`. 구 이름 라벨은 `DISTRICT_PATHS`의 `cx,cy`에 `<text>`.
  3. 중앙 강조: `스탬프 {completedSlots}/{totalSlots}` (대), 그 아래 `목표 달성률 {goalPct}%` (중).
  4. `{completedDistrictCount}/5개 구 목표 완료` · `목표: 구마다 {targetPerDistrict}곳`.
  5. 구별 5줄: 구 이름 / 트랙+채움 `rect`(폭 `goalPct%`) / `{completedSlots}/{target}`.
  6. 하단 워터마크 `빵모아 · 대전 빵집 스탬프 투어`.
- 문자열은 안전하게 조립: 삽입되는 닉네임·수치는 `&<>"` 이스케이프 헬퍼를 거친다.

**`rasterizeStampCard`**
- `const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))`
  (한글 포함 UTF-8 안전 base64).
- `const img = new Image(); img.src = url; await img.decode()`.
- `canvas 1080×1350` → `ctx.drawImage(img, 0, 0, 1080, 1350)` → `canvas.toBlob(resolve, 'image/png')`.
- 외부 리소스가 없어 `toBlob`이 taint로 throw하지 않는다. 실패 시 reject.

### 2.2 `src/lib/stampShare.js` (신설)

```js
shareStampCard({ nickname, stamp, targetPerDistrict }) → Promise<{ ok, mode, error? }>
```

1. `const { data: code, error } = await supabase.rpc('ensure_share_code')`.
   - `error` && 메시지가 unique 위반이면 1회 재조회(`select share_code …`)로 복구, 아니면 실패 반환.
   - `const shareUrl = ` `${window.location.origin}/s/${code}` .
2. `const blob = await rasterizeStampCard(buildStampCardSvg({ nickname, stamp, targetPerDistrict }))`.
   `const file = new File([blob], 'daejeon-bread-stamp.png', { type: 'image/png' })`.
3. `if (navigator.canShare?.({ files: [file] }))` →
   `await navigator.share({ files: [file], text: '대전 빵 스탬프 도전 중! 나도 해볼래?', url: shareUrl })`
   → `{ ok: true, mode: 'share' }`. `AbortError`(사용자 취소)는 `{ ok: false, mode: 'cancel' }`로 조용히.
4. 아니면 폴백: `a.href = URL.createObjectURL(blob); a.download = file.name; a.click()` + `URL.revokeObjectURL`.
   추가로 `navigator.clipboard?.writeText(shareUrl)` 시도. → `{ ok: true, mode: 'download' }`.
5. 어느 단계든 예기치 못한 throw는 `console.error('[스탬프공유]', err)` 후 `{ ok:false, error }`.

### 2.3 `src/components/mypage/VisitStampModal.jsx` (수정)

- props에 `targetPerDistrict`를 받는다(= 현재 `target`). `VisitStampBand`에서 전달.
- `editable`(본인)일 때만, 구별 목록 아래에 `공유하기` 버튼 1개.
  - 클릭 → 로컬 `sharing` 상태 `true`, 버튼 `disabled` + 라벨 `만드는 중…`.
  - `const nick = nickname ?? '나'` 를 넘겨 `shareStampCard({ nickname: nick === '나' ? '내' : nickname, stamp, targetPerDistrict })`
    — 타이틀이 `내 대전 빵 스탬프` / `{닉네임}님의 대전 빵 스탬프`로 자연스럽게. (문구는 구현 시 정리.)
  - 결과 `mode`에 따라 짧은 인라인 안내(`다운로드했어요. 링크도 복사했어요.` / 실패 문구). 토스트 시스템이
    없으면 버튼 옆 `<span>` 한 줄로.
- 친구 모달(`editable={false}`)엔 버튼 없음(기존과 동일).

### 2.4 `src/components/mypage/VisitStampBand.jsx` (수정)

- `<VisitStampModal … targetPerDistrict={target} />` 한 줄 추가 전달. 그 외 변경 없음.

---

## 3. 프런트 — 공개 링크 페이지 (파트 B)

### 3.1 `src/App.jsx` (수정)

```jsx
import LandingPage from './pages/LandingPage'
import StampSharePage from './pages/StampSharePage'

export default function App() {
  const path = window.location.pathname
  if (path.startsWith('/s/')) {
    const code = decodeURIComponent(path.slice('/s/'.length)).trim()
    return <StampSharePage code={code} />
  }
  return <LandingPage />
}
```

- 라우터 없음. `vercel.json`의 `/((?!tourapi/|assets/|.*\..*).*) → /index.html` rewrite가 `/s/CODE`를
  이미 SPA로 넘긴다(수정 불필요). 로컬 `vite`도 SPA fallback으로 동작.
- 코드가 빈 문자열이면 `StampSharePage`가 "없음" 상태를 렌더.

### 3.2 `src/pages/StampSharePage.jsx` (신설)

- 마운트 시 `supabase.rpc('get_public_stamp', { p_code: code })`. **로그인 불필요**(anon 키로 호출).
  `useDiaryEntries`의 `alive` 가드 패턴으로 stale 응답 무시.
- 상태 분기:
  - 로딩: 중앙 스피너/스켈레톤.
  - `data == null` 또는 error: `이 링크는 만료됐거나 존재하지 않아요.` + `빵모아 홈으로` 버튼(`href="/"`).
  - 성공: 아래 카드.
- **결과 카드**(읽기 전용, 전체 공개):
  - 제목 `{nickname}님의 대전 빵 스탬프`.
  - 5구 SVG: `daejeonStampPaths`의 `STAMP_VIEWBOX`/`DISTRICT_PATHS` + 로컬 `fillOpacity(goalPct)` +
    구 이름 라벨. (모달의 SVG 블록과 같은 형태를 이 파일에 로컬로 둔다 — 컴포넌트 추출 안 함.)
  - 요약: `스탬프 {completedSlots}/{totalSlots}` · `목표 달성률 {goalPct}%` ·
    `{completedDistrictCount}/5개 구 목표 완료` · `방문한 빵집 {visitedBakeryCount}곳` ·
    `목표: 구마다 {targetPerDistrict}곳`.
  - 구별 5줄: 이름 / 진행 바(`width: goalPct%`) / `{completedSlots}/{target}` / `completed`면 ✓.
  - `document.title = ` `${nickname}님의 대전 빵 스탬프 · 빵모아` 로 설정(effect, 언마운트 시 복원).
- **CTA**(강조, 카드 하단 고정 느낌):
  - `useAuth()`의 `user`가 있으면 `내 스탬프 보러가기` → `href="/"`.
  - 없으면 `로그인하고 나도 대전 빵 스탬프 시작하기` → `href="/"` (랜딩에서 로그인 진입).
  - 부제 한 줄: `대전 5개 구 빵집을 돌면서 스탬프를 채워보세요.`

### 3.3 정적 OG — `index.html` (수정) + 에셋

`<head>`에 추가:

```html
<meta property="og:type" content="website" />
<meta property="og:site_name" content="빵모아" />
<meta property="og:title" content="대전 빵 스탬프 투어" />
<meta property="og:description" content="대전 5개 구 빵집을 돌면서 스탬프를 채우고 친구와 공유하세요." />
<meta property="og:image" content="/og-stamp-default.png" />
<meta name="twitter:card" content="summary_large_image" />
```

- 현재 `index.html`에 OG 태그가 전무하다 → 순수 추가. 모든 경로가 같은 `index.html`을 받으므로 앱
  전역에 동일 OG가 적용된다(의도된 절충 — 개인화는 후속 동적 OG).
- `public/og-stamp-default.png` (1200×630) 신규 에셋. 대전 5구 실루엣 + "대전 빵 스탬프 투어" + 빵모아
  로고. 디자인 러프 1장이면 충분(코드 블로커 아님). 필요 시 `buildStampCardSvg` 골격을 1200×630
  빈-상태로 재사용해 빌드 타임에 1회 생성해 커밋해도 된다.

---

## 4. 데이터 흐름

```
[자랑]  VisitStampModal(본인) "공유하기"
          → shareStampCard()
              → supabase.rpc('ensure_share_code')  → share_code (없으면 생성)
              → buildStampCardSvg({nickname, stamp, targetPerDistrict})  → SVG 문자열
              → rasterizeStampCard(svg)  → PNG Blob
              → navigator.share({files,url})  |  다운로드 + 링크 복사

[열람]  받은 사람이 https://우리도메인/s/<share_code> 열기
          → App.jsx: pathname "/s/" 분기 → <StampSharePage code=... />
          → supabase.rpc('get_public_stamp', { p_code })   (비로그인 OK)
              → profiles.share_code 로 사용자 해석 (없으면 null)
              → verified 기록의 bakery 좌표 → classify_daejeon_district() → 구
              → 구별 빵집 중복 제거 → stamp_target 으로 슬롯 계산
              → { nickname, targetPerDistrict, stamp:{ computeVisitStamps 와 동일 shape } }
          → 결과 카드(전체) 렌더 + CTA

[전환]  CTA "로그인하고 나도 시작" → "/" (랜딩 → 로그인 → 마이페이지에서 본인 스탬프)
```

---

## 5. 테스트 / 검증

### 단위 (`npm test`, `node --test "src/**/*.test.js"`)

- `src/lib/stampShareImage.test.js` (신설)
  - `buildStampCardSvg`가 `<svg …>`로 시작해 `</svg>`로 끝난다. `width="1080" height="1350"`.
  - 전달한 `nickname`, `스탬프 {completedSlots}/{totalSlots}`, `목표 달성률 {goalPct}%` 문자열이 결과에 포함.
  - `perDistrict` 5개 구 이름이 모두 포함.
  - 특수문자 닉네임(`<b>&"`)이 이스케이프돼 들어간다.
- 기존 `visitStamps.test.js`, `districtFromPoint.test.js`, `daejeonStampPaths.test.js` — 변경 없음, 회귀만 확인.
- `rasterizeStampCard`(canvas), `stampShare`(navigator/supabase), `StampSharePage`(DB) — 레포 관례상 단위 테스트 없음.

### SQL 파리티 (수동, Supabase SQL 에디터)

- `select classify_daejeon_district(36.3315,127.4348)` → `동구`,
  `(36.3277,127.4276)` → `중구`, `(36.3515,127.3781)` → `서구`,
  `(36.3540,127.3360)` → `유성구`, `(36.4350,127.4200)` → `대덕구`,
  `(37.5665,126.9780)` → `null`. (좌표는 `districtFromPoint.test.js`와 동일 세트, 실제 링과 대조해 확정.)
- `select get_public_stamp('<내 share_code>')` 반환의 `stamp`가 내 마이페이지 밴드/모달 숫자와 일치.
- `select get_public_stamp('ZZZZZZZZ')`(없는 코드) → `null`.

### 빌드

- `npm run build` 통과. 번들 경고(500kB 초과), LF/CRLF 경고는 기존과 동일한 비차단.

### 수동 QA (`http://localhost:5173`)

- 본인 스탬프 모달 → `공유하기`:
  - `navigator.canShare({files})` 지원 브라우저 → 공유 시트에 PNG.
  - 미지원 → PNG 다운로드 + 링크 클립보드 복사 + 안내 문구.
  - 취소(AbortError) 시 에러 표시 없이 조용히.
- 다른 브라우저/시크릿 창(비로그인)에서 `http://localhost:5173/s/<코드>`:
  - 결과 카드 전체 표시, 숫자가 소유자 화면과 일치, 구별 채움/라벨 정상.
  - CTA `로그인하고 …` → `/`.
- `http://localhost:5173/s/없는코드` → "만료됐거나 존재하지 않아요" + 홈 버튼.
- 친구의 스탬프 모달에는 `공유하기` 버튼 없음.
- 로그인 상태에서 `/s/<코드>` → CTA가 `내 스탬프 보러가기`.
- 배포 후: 카카오톡/OG 디버거에 배포 URL 입력 → 정적 OG 이미지·제목 노출 확인.

### DB 적용

- 3단계 SQL(`share_code` 컬럼 + `ensure_share_code` / `classify_daejeon_district` / `get_public_stamp`
  함수 + grant)의 **범위와 이유를 사용자에게 안내**하고, 실제 Supabase 반영은 사용자가 수행한다.
  `schema.sql`은 전체 재실행이 안전하도록 idempotent하게 작성한다.

## 6. 파일 요약

| 파일 | 변경 |
|---|---|
| `supabase/schema.sql` | `share_code` 컬럼 + 함수 3개 + grant (맨 끝 새 섹션) |
| `src/lib/stampShareImage.js` | 신설 — `buildStampCardSvg`, `rasterizeStampCard` |
| `src/lib/stampShareImage.test.js` | 신설 |
| `src/lib/stampShare.js` | 신설 — `shareStampCard` |
| `src/pages/StampSharePage.jsx` | 신설 — `/s/:code` 공개 페이지 |
| `src/App.jsx` | `/s/` pathname 분기 |
| `src/components/mypage/VisitStampModal.jsx` | 본인 모달에 `공유하기` 버튼, `targetPerDistrict` prop |
| `src/components/mypage/VisitStampBand.jsx` | `targetPerDistrict={target}` 전달 |
| `index.html` | 정적 OG/twitter 메타 |
| `public/og-stamp-default.png` | 신규 에셋 (1200×630) |
| `src/styles.css` | `.stamp-share-*`(공개 페이지), 공유 버튼, 안내 문구 규칙. 기존 색 토큰만 사용 |

## 7. SDD ledger 메모

이 브랜치의 `.superpowers/sdd/2026-09-01-visit-stamp-*/progress.md` ledger는 노트북 로컬에만 있고
(gitignore) 이 작업 머신에는 없다. 3단계 진행 상황은 이 스펙과 그 구현 계획
(`docs/superpowers/plans/2026-09-01-visit-stamp-share.md`)에 남긴다. 노트북에서 이어질 때 기존 ledger에
같은 형식으로 3단계 항목을 추가한다 — ledger를 삭제하거나 되돌리지 않는다.
