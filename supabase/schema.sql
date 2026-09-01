-- 빵모아 계정 연동 (구글/카카오 로그인) 후 "찜한 빵집" 저장용 테이블.
-- Supabase 프로젝트 생성 후 SQL Editor 에 그대로 붙여넣어 실행하세요.
-- (CLI/마이그레이션 도구는 아직 이 프로젝트에 연결돼 있지 않아 수동 실행 방식입니다.)

create table if not exists saved_bakeries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bakery_id text not null,
  bakery jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, bakery_id)
);

alter table saved_bakeries enable row level security;

-- 본인 데이터만 조회/추가/삭제 가능 (다른 사용자의 찜 목록은 볼 수도 건드릴 수도 없음)
create policy "saved_bakeries_select_own" on saved_bakeries
  for select using (auth.uid() = user_id);

create policy "saved_bakeries_insert_own" on saved_bakeries
  for insert with check (auth.uid() = user_id);

create policy "saved_bakeries_delete_own" on saved_bakeries
  for delete using (auth.uid() = user_id);

-- CP6-3: "대전한바퀴" 코스 저장용 테이블 (관광모아+빵모아 결합 코스).
create table if not exists saved_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '대전한바퀴',
  travel_mode text not null default 'car',
  stops jsonb not null, -- [{ type:'attraction'|'bakery', id, name, lat, lng, order }]
  origin jsonb,         -- 저장 시점 출발지 스냅샷 { lat, lng, label, source }
  created_at timestamptz not null default now()
);

alter table saved_courses enable row level security;

create policy "saved_courses_select_own" on saved_courses
  for select using (auth.uid() = user_id);

create policy "saved_courses_insert_own" on saved_courses
  for insert with check (auth.uid() = user_id);

create policy "saved_courses_delete_own" on saved_courses
  for delete using (auth.uid() = user_id);

-- 이슈 #60: 저장된 코스 이름 나중에 수정하기 — update 정책이 없어 RLS가 기본 거부하므로
-- 프론트에서 renameCourse를 호출해도 항상 권한 오류로 실패했다.
create policy "saved_courses_update_own" on saved_courses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 마이페이지 "기록장": 빵집 상세에서 남기는 짧은 기록. 사진 첨부는 이번 범위에서 제외.
create table if not exists diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bakery_id text not null,
  bakery jsonb not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table diary_entries enable row level security;

create policy "diary_entries_select_own" on diary_entries
  for select using (auth.uid() = user_id);

create policy "diary_entries_insert_own" on diary_entries
  for insert with check (auth.uid() = user_id);

create policy "diary_entries_update_own" on diary_entries
  for update using (auth.uid() = user_id);

create policy "diary_entries_delete_own" on diary_entries
  for delete using (auth.uid() = user_id);

-- ===== 이슈 #24: 친구코드 기반 친구 기능 =====

-- 공개 프로필 — auth.users 는 클라이언트에서 타인 조회가 불가능해 별도 테이블이 필요하다.
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  friend_code text not null unique,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- 랜덤 8자리 코드 생성 (0/O/1/I 등 헷갈리는 문자 제외)
create or replace function generate_friend_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  exists_code boolean;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from profiles where friend_code = code) into exists_code;
    exit when not exists_code;
  end loop;
  return code;
end;
$$;

-- 신규 가입자: auth.users insert 시 profiles 행 자동 생성
create or replace function handle_new_user_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into profiles (user_id, nickname, friend_code)
  values (new.id, new.raw_user_meta_data->>'nickname', generate_friend_code())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function handle_new_user_profile();

-- 기존 가입자 백필 (이 스크립트를 처음 실행할 때 1회 반영됨, 이후엔 no-op)
insert into profiles (user_id, nickname, friend_code)
select id, raw_user_meta_data->>'nickname', generate_friend_code()
from auth.users
on conflict (user_id) do nothing;

-- 친구 요청/관계. 수락 시 새 행을 만들지 않고 status 만 바뀐다.
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

alter table friend_requests enable row level security;

create policy "friend_requests_select_involved" on friend_requests
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friend_requests_insert_as_requester" on friend_requests
  for insert with check (auth.uid() = requester_id);

create policy "friend_requests_update_addressee_accept" on friend_requests
  for update using (auth.uid() = addressee_id) with check (status = 'accepted');

create policy "friend_requests_delete_involved" on friend_requests
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- 본인 또는 요청 관계(대기/수락 불문)가 있는 상대만 프로필 조회 가능
create policy "profiles_select_self_or_related" on profiles
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from friend_requests
      where (requester_id = auth.uid() and addressee_id = profiles.user_id)
         or (requester_id = profiles.user_id and addressee_id = auth.uid())
    )
  );

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = user_id);

-- 친구 관계 판정 헬퍼
create or replace function is_friends_with(other_user uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from friend_requests
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = other_user)
        or (requester_id = other_user and addressee_id = auth.uid()))
  );
$$;

-- 기존 3개 테이블: "본인만" → "본인 또는 수락된 친구" 로 select 정책 교체 (insert/update/delete 는 그대로 본인만)
drop policy if exists "saved_bakeries_select_own" on saved_bakeries;
create policy "saved_bakeries_select_own_or_friend" on saved_bakeries
  for select using (auth.uid() = user_id or is_friends_with(user_id));

drop policy if exists "saved_courses_select_own" on saved_courses;
create policy "saved_courses_select_own_or_friend" on saved_courses
  for select using (auth.uid() = user_id or is_friends_with(user_id));

drop policy if exists "diary_entries_select_own" on diary_entries;
create policy "diary_entries_select_own_or_friend" on diary_entries
  for select using (auth.uid() = user_id or is_friends_with(user_id));

-- 친구가 아닌 상대는 RLS 로 못 찾으므로, 코드 정확히 일치하는 1건만 반환하는 RPC.
create or replace function find_user_by_friend_code(code text)
returns table(user_id uuid, nickname text)
language sql
security definer
stable
as $$
  select user_id, nickname from profiles where friend_code = upper(code);
$$;

-- ===== 최종 리뷰 반영: RLS 보안 강화 =====

-- 수락 정책의 WITH CHECK 가 status 만 검증해서, addressee 가 자신의 pending 행의
-- requester_id/addressee_id 를 바꿔치기해 동의 없이 친구 관계를 위조할 수 있었음.
-- WITH CHECK 에 auth.uid()=addressee_id 를 추가하고, update 권한을 status 컬럼만으로 제한.
drop policy if exists "friend_requests_update_addressee_accept" on friend_requests;
create policy "friend_requests_update_addressee_accept" on friend_requests
  for update using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id and status = 'accepted');

revoke update on friend_requests from authenticated;
grant update (status) on friend_requests to authenticated;

-- profiles_update_own 에 WITH CHECK 가 없어 본인 행의 아무 컬럼이나(friend_code 포함) 바꿀 수 있었음.
-- 자가 편집된 코드는 RPC 의 upper(code) 조회 규칙과 충돌하므로 update 권한을 nickname 만으로 제한.
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke update on profiles from authenticated;
grant update (nickname) on profiles to authenticated;

-- 함수 생성 시 기본으로 EXECUTE 가 PUBLIC 에 부여돼 비로그인(anon) 요청도 코드를 스캔해
-- 남의 닉네임을 조회할 수 있었음 — 로그인 사용자에게만 실행 권한을 준다.
revoke execute on function find_user_by_friend_code(text) from public, anon;
grant execute on function find_user_by_friend_code(text) to authenticated;

-- 실사용 중 발견: auth.users insert 트리거(handle_new_user_profile)가 GoTrue 쪽 연결의
-- search_path 에 public 이 없는 상태로 실행돼 "relation profiles does not exist" 로
-- 신규 가입 자체가 막히는 버그가 실제로 발생함(최종 리뷰에서는 lint 수준 Minor로만 분류했었음).
-- 트리거 체인에 관련된 함수 전부에 search_path 를 명시적으로 고정.
alter function generate_friend_code() set search_path = public, pg_temp;
alter function handle_new_user_profile() set search_path = public, pg_temp;
alter function is_friends_with(uuid) set search_path = public, pg_temp;
alter function find_user_by_friend_code(text) set search_path = public, pg_temp;

-- ===== 이슈 #50: 마이페이지 프로필 아바타 =====
-- 아래 storage.* 문장은 소유자 권한이 필요하다 — 반드시 Supabase 대시보드 SQL Editor 에서 실행할 것.

alter table profiles add column if not exists avatar_url text;
-- 업로드 시각(ms) — 경로가 {uid}/avatar.jpg 로 고정이라 친구 화면 URL 에도 캐시버스터가 필요하다.
alter table profiles add column if not exists avatar_version bigint;

-- 기존엔 update 권한이 nickname 컬럼으로만 제한돼 있었다. avatar_url/avatar_version 을 추가한다.
revoke update on profiles from authenticated;
grant update (nickname, avatar_url, avatar_version) on profiles to authenticated;

-- 보안 리뷰 지적(이슈 #50): 기존엔 '^https://[a-z0-9]+\.supabase\.co/.../avatars/' 정규식이라
-- (1) 우리 프로젝트가 아닌 임의의 *.supabase.co 프로젝트를 호스트로 허용했고
-- (2) 경로를 본인 uid 로 고정하지 않아 남의 avatars/{uid}/avatar.jpg 도 그대로 통과했다.
-- 둘 다 로그인 사용자가 API 를 직접 호출하면 친구 화면에 외부 추적 이미지나 타인 사진을 심을 수 있는 구멍이었다.
-- 호스트를 SQL 에 하드코딩하는 대신, avatar_url 에는 전체 URL이 아니라 storage 객체 "경로"만 저장하고
-- 이 경로가 본인 고정 경로({uid}/avatar.jpg)와 정확히 일치하는지만 검사한다 —
-- 클라이언트가 자기 SUPABASE_URL 로 공개 URL 을 조립하므로 외부 호스트를 DB 에 넣을 방법 자체가 없다.
--
-- auth.uid() 가 아니라 이 행의 user_id 컬럼과 비교한다: SQL Editor/service-role 컨텍스트에선
-- auth.uid() 가 null 이고, Postgres CHECK 는 조건이 null 이면(false 가 아니면) 통과시키므로
-- auth.uid() 기준이면 그런 컨텍스트에서 어떤 값이든(과거의 전체 URL 포함) 그대로 통과해버린다.
-- user_id 는 각 행의 NOT NULL 기본키라 항상 값이 있어 이 구멍이 없다.
-- 새 제약을 걸기 전에, 예전 정규식 시절 전체 URL 형태로 저장된 값을 먼저 정리한다(존재한다면).
update profiles
set avatar_url = null
where avatar_url is not null and avatar_url <> user_id::text || '/avatar.jpg';

alter table profiles drop constraint if exists profiles_avatar_url_origin;
alter table profiles add constraint profiles_avatar_url_origin
  check (avatar_url is null or avatar_url = user_id::text || '/avatar.jpg');

-- 아바타 저장용 public 버킷. MIME/용량은 버킷 레벨에서 강제(클라이언트 검증은 UX 용).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 1048576,           -- 1 MiB (리사이즈 결과는 보통 ~100KB)
      allowed_mime_types = array['image/jpeg'];

-- 유저당 "정확히 한 경로"({uid}/avatar.jpg)만 허용. 폴더 prefix 가 아니라 name 전체를 고정한다.
-- 공개 CDN URL 로 바이트를 읽는 익명 경로엔 정책이 필요 없다(프로필 사진은 공개 정보 — §9).
-- 아래 avatars_select_own 은 authenticated API 경로(upsert/remove 의 RETURNING)에만 적용된다.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg');

-- upload(upsert) / remove() 는 RETURNING 을 쓰므로 본인 파일에 대한 select 정책이 필요하다
-- (public 버킷의 바이트 공개 범위(§9)는 그대로 — 이건 authenticated API 경로에만 적용).
drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg');

-- upsert:true 재업로드는 insert 가 아니라 update 경로를 타므로 이 정책이 필요하다.
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using      (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg')
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg');

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg');

-- ===== 이슈 #51: 기록장 좋아요·댓글 =====

create table if not exists diary_likes (
  entry_id uuid not null references diary_entries(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);

alter table diary_likes enable row level security;

create table if not exists diary_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references diary_entries(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table diary_comments enable row level security;

-- diary_comments 는 entry_id 로 PK 가 아니라 매번 필터링되므로 조회 성능을 위해 인덱스가 필요하다
-- (diary_likes 는 (entry_id, user_id) 복합 PK 라 entry_id 단독 조회도 이미 그 인덱스로 커버된다).
create index if not exists diary_comments_entry_id_idx on diary_comments(entry_id);

-- 300자 제한은 원래 입력창의 maxLength 뿐이었다 — Supabase API 를 직접 호출하면 그대로 우회되므로
-- (실제 방어선은 RLS/제약조건이지 클라이언트 검증이 아니다) DB 에도 같은 제약을 건다.
-- btrim 으로 공백만 있는 댓글도 함께 막는다(클라이언트도 trim() 하지만 마찬가지로 우회 가능).
alter table diary_comments drop constraint if exists diary_comments_text_length;
alter table diary_comments add constraint diary_comments_text_length
  check (char_length(btrim(text)) between 1 and 300);

-- entry 를 볼 수 있는 사람(본인 또는 수락된 친구)인지 판정 — like/comment 정책에서 공용으로 쓴다.
create or replace function can_see_entry(entry uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from diary_entries
    where id = entry
      and (user_id = auth.uid() or is_friends_with(user_id))
  );
$$;
alter function can_see_entry(uuid) set search_path = public, pg_temp;

-- select/insert 는 그 entry를 볼 수 있는 사람만. delete 는 본인이 쓴 것만
-- (entry 소유자가 남의 좋아요/댓글을 지우는 기능은 이번 스코프에서 제외 — 필요해지면 별도 이슈).
drop policy if exists "diary_likes_select_visible" on diary_likes;
create policy "diary_likes_select_visible" on diary_likes
  for select using (can_see_entry(entry_id));

drop policy if exists "diary_likes_insert_own" on diary_likes;
create policy "diary_likes_insert_own" on diary_likes
  for insert with check (auth.uid() = user_id and can_see_entry(entry_id));

drop policy if exists "diary_likes_delete_own" on diary_likes;
create policy "diary_likes_delete_own" on diary_likes
  for delete using (auth.uid() = user_id);

drop policy if exists "diary_comments_select_visible" on diary_comments;
create policy "diary_comments_select_visible" on diary_comments
  for select using (can_see_entry(entry_id));

drop policy if exists "diary_comments_insert_own" on diary_comments;
create policy "diary_comments_insert_own" on diary_comments
  for insert with check (auth.uid() = user_id and can_see_entry(entry_id));

drop policy if exists "diary_comments_delete_own" on diary_comments;
create policy "diary_comments_delete_own" on diary_comments
  for delete using (auth.uid() = user_id);

-- 재검증 반영: 댓글 작성자가 "글 주인의 친구"이지만 "보는 사람의 친구"는 아닐 수 있다
-- (예: A 글에 A의 친구 C가 댓글을 달고, A의 다른 친구 B가 그 글을 봄 — B 와 C는 서로 친구가 아님).
-- 이 경우 diary_comments 자체는 can_see_entry 로 B 에게 보이지만, 기존 profiles RLS(직접 친구
-- 관계만)가 C 의 닉네임/아바타 조회를 막아 '이름 없음' + 빈 아바타로만 보였다.
--
-- PR #57 리뷰에서 지적된 대로, profiles SELECT 정책 자체를 넓히는 방식은 RLS 가 행 단위라
-- friend_code(친구 추가 모델의 전제 — §"친구 요청" 참고)까지 낯선 사람에게 노출시킨다.
-- 대신 find_user_by_friend_code 와 동일하게, 필요한 컬럼만 반환하는 security definer 함수로
-- 댓글 작성자 프로필만 좁게 공개한다 — profiles 행 자체의 가시성은 원래대로 유지.
create or replace function get_diary_comment_authors(p_entry_id uuid)
returns table(user_id uuid, nickname text, avatar_url text, avatar_version bigint)
language sql
security definer
stable
as $$
  select p.user_id::uuid, p.nickname::text, p.avatar_url::text, p.avatar_version::bigint
  from profiles p
  where can_see_entry(p_entry_id)
    and p.user_id in (
      select dc.user_id from diary_comments dc where dc.entry_id = p_entry_id
    );
$$;
alter function get_diary_comment_authors(uuid) set search_path = public, pg_temp;

revoke execute on function get_diary_comment_authors(uuid) from public, anon;
grant execute on function get_diary_comment_authors(uuid) to authenticated;

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

-- ===== 이슈 #63 2단계: 방문 인증 =====

alter table diary_entries add column if not exists visit_lat double precision;
alter table diary_entries add column if not exists visit_lng double precision;
alter table diary_entries add column if not exists verified boolean not null default false;
alter table diary_entries add column if not exists verified_at timestamptz;

-- 일반 API 사용자는 인증 관련 값을 직접 쓰지 못한다. 본문 수정만 허용하고,
-- 새 기록의 인증 여부와 방문 좌표는 아래 security definer RPC만 결정한다.
revoke insert, update on diary_entries from authenticated;
grant insert (user_id, bakery_id, bakery, text) on diary_entries to authenticated;
grant update (text, updated_at) on diary_entries to authenticated;

drop policy if exists "diary_entries_insert_own" on diary_entries;
create policy "diary_entries_insert_own" on diary_entries
  for insert with check (auth.uid() = user_id and verified = false);

-- 친구에게 기록은 보여주되 캡처한 실제 위치는 노출하지 않는다.
revoke select on diary_entries from authenticated, anon;
grant select (
  id, user_id, bakery_id, bakery, text, created_at, updated_at, verified, verified_at
) on diary_entries to authenticated;

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

  if jsonb_typeof(p_bakery -> 'lat') = 'number'
    and jsonb_typeof(p_bakery -> 'lng') = 'number' then
    v_bakery_lat := (p_bakery ->> 'lat')::double precision;
    v_bakery_lng := (p_bakery ->> 'lng')::double precision;
  end if;

  if p_lat between -90 and 90
    and p_lng between -180 and 180 then
    v_visit_lat := p_lat;
    v_visit_lng := p_lng;

    if v_bakery_lat between -90 and 90
      and v_bakery_lng between -180 and 180 then
      v_distance_m := 6371000 * 2 * asin(sqrt(least(1, greatest(0,
        power(sin(radians(v_visit_lat - v_bakery_lat) / 2), 2)
        + cos(radians(v_bakery_lat)) * cos(radians(v_visit_lat))
        * power(sin(radians(v_visit_lng - v_bakery_lng) / 2), 2)
      ))));
      v_verified := v_distance_m <= 150;
    end if;
  end if;

  return query
    insert into diary_entries (
      user_id, bakery_id, bakery, text,
      visit_lat, visit_lng, verified, verified_at
    ) values (
      v_user_id, p_bakery ->> 'id', p_bakery, btrim(p_text),
      v_visit_lat, v_visit_lng, v_verified, case when v_verified then now() else null end
    )
    returning diary_entries.id, diary_entries.verified, diary_entries.verified_at;
end;
$$;

revoke execute on function create_diary_entry(jsonb, text, double precision, double precision)
  from public, anon;
grant execute on function create_diary_entry(jsonb, text, double precision, double precision)
  to authenticated;

-- ===== 이슈 #63 3단계: 공유 =====

-- 초기 3단계 시안은 share_code를 별도 생성했지만, 최종 계약은 기존 friend_code 재사용이다.
-- 이미 초기 SQL을 적용한 환경과 발송된 링크를 깨지 않기 위해 nullable legacy 컬럼/함수는 남기되,
-- 새 클라이언트는 더 이상 ensure_share_code를 호출하거나 share_code를 생성하지 않는다.
alter table profiles add column if not exists share_code text unique;

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

  update profiles set share_code = coalesce(share_code, v_code)
    where user_id = v_uid
    returning share_code into v_code;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  return v_code;
end;
$$;

revoke execute on function ensure_share_code() from public, anon;
grant execute on function ensure_share_code() to authenticated;

alter function ensure_share_code() set search_path = public, pg_temp;

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
revoke execute on function classify_daejeon_district(float8, float8) from public;
grant execute on function classify_daejeon_district(float8, float8) to anon, authenticated;

-- 비로그인 방문자가 공유 링크로 받는 공개 집계. 새 링크는 friend_code를 사용하고,
-- 초기 3단계 시안에서 생성된 share_code도 기존 링크 호환 목적으로 함께 허용한다.
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
    where friend_code = upper(btrim(p_code))
       or share_code = upper(btrim(p_code))
    order by (friend_code = upper(btrim(p_code))) desc
    limit 1;

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
    'nickname', coalesce(nullif(btrim(v_nickname), ''), '이름 없음'),
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
