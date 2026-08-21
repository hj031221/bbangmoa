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
