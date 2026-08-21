# 친구코드 기반 친구 기능 — 설계 (이슈 #24)

**날짜:** 2026-08-21
**브랜치:** `feature-friends`
**관련 이슈:** #24 ([FE] 마이페이지 친구목록 — 친구코드 기반 기능 신규 구현), #22(마이페이지 UI 개편에서 4번째 컬럼 자리를 미리 만들어둠)

## 배경 및 목표

마이페이지 홈의 친구목록 패널(`FriendsPreview.jsx`)은 현재 "친구 기능은 준비 중이에요" 자리표시자다. 이번 작업으로 친구코드 발급 → 코드/링크로 친구 요청 → 상호 수락 → 친구의 찜한 빵/코스/기록장을 읽기 전용으로 열람하는 흐름을 구현한다.

이슈 본문에 명시적으로 미정이던 항목:
- **친구 성립 방식**: 상호 수락으로 확정(사용자 확인 완료). 코드를 아는 것만으로 상대 데이터를 볼 수 없어야 하므로 요청 → 수락 2단계.
- **UI 시안**: 없음 — 기존 마이페이지 패널 스타일(`.mypage-preview-*`, `.mypage-panel*`)을 그대로 따른다.
- 추가 요구사항(브레인스토밍 중 확정): 코드 직접 입력 외에 **초대 링크 공유**로도 친구 추가 가능해야 함(에브리타임 스타일).

## 제외 사항 (이슈 원문 + 이번 논의로 확정)

- 친구 간 실시간 알림/채팅.
- 친구가 남긴 기록장에 댓글/좋아요 등 상호작용.
- 친구의 찜한 빵/코스/기록장에 대한 **편집** 권한 — 읽기 전용만.
- 아바타 이미지 업로드 — 기존 이니셜 placeholder 그대로 사용.
- 프로필/공개 여부 세분화 설정(카테고리별 공개 on/off 등) — 친구 성립 시 3개 카테고리 전부 열람 허용, 별도 토글 없음.

## 1. 데이터 모델 (Supabase)

### 왜 `profiles` 테이블이 필요한가

닉네임은 현재 `auth.users.raw_user_meta_data`에만 있다. `auth` 스키마는 PostgREST(클라이언트 API)에 노출되지 않고, RLS로도 다른 사용자의 `auth.users` 행을 읽을 방법이 없다. 친구의 닉네임을 보여주려면 공개적으로 읽을 수 있는 별도 테이블이 필요하다.

### 신규 테이블

```sql
-- 친구 기능용 공개 프로필 — auth.users 는 클라이언트에서 타인 조회 불가라 별도 테이블 필요.
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

-- 기존 가입자 백필 (스키마 적용 시 1회)
insert into profiles (user_id, nickname, friend_code)
select id, raw_user_meta_data->>'nickname', generate_friend_code()
from auth.users
on conflict (user_id) do nothing;

-- 본인 또는 요청 관계(대기/수락 불문)가 있는 상대만 조회 가능
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
```

```sql
-- 친구 요청/관계. 수락 시 새 행을 만들지 않고 status 만 변경한다.
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

-- 수락은 받는 사람만
create policy "friend_requests_update_addressee_accept" on friend_requests
  for update using (auth.uid() = addressee_id) with check (status = 'accepted');

-- 취소/거절/친구끊기 = 관계된 누구나 삭제
create policy "friend_requests_delete_involved" on friend_requests
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);
```

> 주의: `unique (requester_id, addressee_id)`는 방향까지 유일해서, A→B 요청이 거절(삭제)된 뒤 B→A로 다시 보내는 건 막지 않는다(의도된 동작). 같은 방향 재요청 방지 + 반대 방향 동시 요청(A→B 대기 중에 B→A) 처리는 앱 레벨에서 `find_user_by_friend_code` 이후 기존 관계를 먼저 조회해 안내 메시지로 막는다(아래 4절).

### 친구 관계 헬퍼 + 기존 3개 테이블 RLS 확장

```sql
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

drop policy if exists "saved_bakeries_select_own" on saved_bakeries;
create policy "saved_bakeries_select_own_or_friend" on saved_bakeries
  for select using (auth.uid() = user_id or is_friends_with(user_id));

drop policy if exists "saved_courses_select_own" on saved_courses;
create policy "saved_courses_select_own_or_friend" on saved_courses
  for select using (auth.uid() = user_id or is_friends_with(user_id));

drop policy if exists "diary_entries_select_own" on diary_entries;
create policy "diary_entries_select_own_or_friend" on diary_entries
  for select using (auth.uid() = user_id or is_friends_with(user_id));
```

insert/update/delete 정책은 기존 그대로(본인만) 유지 — 열람만 확장한다.

### 코드로 상대 찾기 (RPC)

친구가 아닌 상대는 RLS로 못 찾으므로, 정확히 일치하는 코드 하나만 반환하는 RPC를 별도로 둔다.

```sql
create or replace function find_user_by_friend_code(code text)
returns table(user_id uuid, nickname text)
language sql
security definer
stable
as $$
  select user_id, nickname from profiles where friend_code = upper(code);
$$;
```

## 2. 닉네임 동기화

`useAuth.js`의 `updateNickname`이 기존 `supabase.auth.updateUser({ data: { nickname } })`에 더해 `supabase.from('profiles').update({ nickname }).eq('user_id', user.id)`도 호출한다. 본인 화면 표시(`getDisplayName.js`)는 그대로 `user_metadata` 우선순위를 유지하므로 기존 동작 변경 없음 — 친구가 볼 닉네임만 `profiles`에서 갱신된다.

## 3. 프론트엔드 데이터 계층

### `src/hooks/useFriends.js` (신규)

```
useFriends() → {
  friendCode,            // 내 코드 (profiles 조회)
  friends,                // 수락된 친구 목록 [{ id: friend_requests.id, userId, nickname }]
  incomingRequests,       // 받은 대기 요청 [{ id, userId, nickname }]
  outgoingRequests,       // 보낸 대기 요청 [{ id, userId, nickname }]
  loading,
  sendRequestByCode(code) → { error },   // find_user_by_friend_code → 기존 관계 확인 → insert
  acceptRequest(id),
  rejectRequest(id),      // = delete (친구 아님 상태)
  cancelRequest(id),      // = delete (보낸 요청 취소, rejectRequest 와 동일 구현, 이름만 구분)
  removeFriend(id),       // = delete (수락된 관계 삭제)
}
```

`sendRequestByCode` 에러 케이스(문자열 메시지로 반환, 컴포넌트가 그대로 표시):
- 코드 형식 불일치/존재하지 않음 → "존재하지 않는 친구코드예요."
- 내 코드 입력 → "내 코드는 입력할 수 없어요."
- 이미 친구 → "이미 친구예요."
- 이미 요청 대기 중(양방향) → "이미 요청을 보냈어요." / "상대가 이미 요청을 보냈어요, 받은 요청함을 확인하세요."

### 기존 훅 확장

`useSavedBakeries` / `useSavedCourses` / `useDiaryEntries` 에 선택적 두 번째 인자(또는 옵션 객체) `targetUserId`를 추가한다. 있으면 로그인한 본인 대신 그 id로 쿼리하고(친구 조회는 항상 로그인 상태이므로 로컬스토리지 분기는 타지 않음), 훅이 제공하는 mutate 함수(`toggleSave`/`removeCourse`/`updateEntry`/`removeEntry`)는 friend 모드에서는 호출부(읽기 전용 컴포넌트)가 아예 렌더링하지 않는다 — RLS도 어차피 막아준다.

## 4. UI

### ProfileCard.jsx

닉네임/편집 버튼 아래에:
```
친구코드  AB3D9F2K   [복사]
                     [초대 링크 복사]
```
"복사"는 코드 텍스트만, "초대 링크 복사"는 `${location.origin}/?friend=${code}`를 클립보드에 복사(`navigator.clipboard.writeText`). 둘 다 클릭 시 버튼 라벨이 잠깐 "복사됨!"으로 바뀌는 정도의 피드백만 준다.

### FriendsPreview.jsx (기존 자리표시자 교체)

다른 3개 미리보기와 동일한 `.mypage-preview-panel` 톤. 친구 수 + 최대 4명 이름 칩. 비어있으면 "아직 추가한 친구가 없어요." 받은 요청이 있으면 배지("2")로 헤더에 표시(수락 대기중임을 홈에서 바로 인지).

### FriendsPanel.jsx (신규, 헤더 클릭 시 전체 화면)

순서대로:
1. 코드 입력창 + "친구 추가" 버튼 (제출 시 `sendRequestByCode`, 에러/성공 인라인 메시지)
2. 받은 요청 목록 — 있을 때만 섹션 노출. 닉네임 + 수락/거절 버튼.
3. 보낸 요청 목록 — 있을 때만. 닉네임 + 취소 버튼(muted 스타일).
4. 친구 목록 — 이니셜 아바타 + 닉네임 카드. 클릭 시 상세 진입. 카드 안에 "친구 끊기" 보조 버튼.

### 친구 상세 (MyPage.jsx 내 상태 확장)

`MyPage.jsx`에 `friendId`/`friendName` state 추가. 친구 카드 클릭 → `setFriendId`. 상세 화면은 "OOO님의 마이페이지" 헤더 + 찜한 빵/코스/기록장 3버튼(개편 전 방식 재사용 — 자주 안 쓰는 보조 화면이라 미리보기 그리드까지는 만들지 않는다) → 클릭 시 기존 `SavedBakeriesPanel`/`SavedCoursesPanel`/`DiaryPanel`에 `targetUserId={friendId} readOnly` 로 진입. 각 패널 안 뒤로가기는 3버튼 화면으로, 거기서 한 번 더 누르면 친구 목록으로 돌아간다(`friendId` 초기화).

### 초대 링크 진입 처리

라우터가 없는 SPA이므로 `LandingPage.jsx` 최상단(또는 신규 `useInviteLink.js` 훅)에서 마운트 시 1회:

```
const code = new URLSearchParams(location.search).get('friend')
```

- **코드 없음** → 아무 것도 안 함.
- **로그인 상태 + 코드 있음** → `find_user_by_friend_code`로 닉네임 조회 → 확인 모달("OOO님에게 친구 요청을 보낼까요?") → 확인 시 `sendRequestByCode` 재사용. 처리 직후 `history.replaceState(null, '', location.pathname)`로 쿼리 제거.
- **비로그인 + 코드 있음** → `sessionStorage.setItem('bbangmoa_pending_friend_code', code)` 후 배너("로그인하면 OO님과 친구가 될 수 있어요 — 상단에서 로그인해주세요")만 표시. 로그인 완료(useAuth의 user 값 변화) 감지 시 `sessionStorage`에서 꺼내 같은 확인 모달 플로우 재개, 처리 후 삭제.
- 코드가 애초에 유효하지 않으면(조회 결과 없음) "유효하지 않은 초대 링크예요" 메시지 후 쿼리 제거.

## 5. 에러 처리 요약

| 상황 | 처리 |
| --- | --- |
| 존재하지 않는 코드 | 인라인 메시지, insert 시도 안 함 |
| 내 코드 입력 | 인라인 메시지 |
| 이미 친구 / 이미 대기중 | 인라인 메시지(방향별 문구 구분) |
| RPC/쿼리 실패(네트워크 등) | `console.error` + "잠시 후 다시 시도해주세요" 공통 메시지 (기존 앱 패턴) |
| 유효하지 않은 초대 링크 | 배너 메시지 후 쿼리 제거 |

## 6. 테스트 계획

- 순수 로직(코드 정규화 `upper(code)` 대응하는 프론트 검증, 초대 링크 URL 생성/파싱 함수)은 `npm test`에 유닛 테스트 추가.
- RLS/트리거/RPC는 자동화 테스트 도구가 없는 기존 프로젝트 관례상 Supabase SQL Editor 적용 후 두 계정(시크릿창 2개)으로 수동 검증: 요청→수락→친구 데이터 열람 성공, 미수락 상태에서 열람 실패(RLS 차단), 친구 데이터에 대한 write 시도 실패.
- dev 서버에서 UI 플로우(코드 입력, 링크 복사→다른 창에서 열기→모달→수락, 친구 상세 read-only 진입) 시각 확인.

## 7. 작업 파일 (예상)

| 파일 | 내용 |
| --- | --- |
| `supabase/schema.sql` | 위 SQL 전체 추가(테이블/트리거/RPC/정책) |
| `src/hooks/useFriends.js` *(신규)* | 친구 요청/목록 CRUD |
| `src/hooks/useInviteLink.js` *(신규)* | 초대 링크 쿼리 파라미터 처리 |
| `src/hooks/useAuth.js` | `updateNickname`에 profiles 동기화 추가 |
| `src/hooks/useSavedBakeries.js`, `useSavedCourses.js`, `useDiaryEntries.js` | `targetUserId` 옵션 추가 |
| `src/components/mypage/ProfileCard.jsx` | 친구코드/초대 링크 표시+복사 |
| `src/components/mypage/FriendsPreview.jsx` | 실제 친구 미리보기로 교체 |
| `src/components/mypage/FriendsPanel.jsx` *(신규)* | 코드 입력/요청함/친구 목록 |
| `src/components/mypage/SavedBakeriesPanel.jsx`, `SavedCoursesPanel.jsx`, `DiaryPanel.jsx` | `targetUserId`/`readOnly` prop 추가 |
| `src/pages/MyPage.jsx` | `friendId`/`friendName` state, 친구 상세 라우팅 분기 |
| `src/pages/LandingPage.jsx` | 초대 링크 처리 훅 연결, 로그인 상태 감지 후 재개 |
| `src/styles.css` | 친구목록/친구 상세/초대 모달 스타일 |

## 자가 점검

- 플레이스홀더/모호한 표현 없음.
- `friend_requests`의 unique 제약이 방향성을 가지므로, 반대 방향 동시 요청은 DB가 아니라 앱 로직(`sendRequestByCode`)이 기존 관계 조회로 막는다는 점을 3절/표에 명시함 — 일관성 확인됨.
- 범위: 이슈 #24 + 이번 세션에서 확정한 링크 공유 요구사항까지만 포함, 실시간 알림/댓글/공개범위 세분화는 명시적 제외.
