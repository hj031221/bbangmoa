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
