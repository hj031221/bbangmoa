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
