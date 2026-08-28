# 마이페이지 프로필 사진 업로드 — 설계 (이슈 #50)

**날짜:** 2026-08-28
**브랜치:** `feature/profile-avatar` (base: `develop`)
**관련 이슈:** #50 ([FEAT] 마이페이지 프로필 사진 업로드), #48(전체 배치에서 분리), #24(친구 기능 — `profiles` 테이블 도입)

## 배경 및 목표

마이페이지 프로필 카드(`ProfileCard.jsx`)의 `.mypage-avatar`는 현재 닉네임 이니셜만 렌더한다(코드 주석에 "이미지 업로드 없음" 명시). 이번 작업으로 갤러리/파일에서 프로필 사진을 골라 올리고, 본인·친구 화면 전반에서 그 사진을 보여주는 흐름을 구현한다.

Supabase Storage 버킷 신설 + `profiles` 스키마 변경이 포함된 신규 기능이다.

## 브레인스토밍으로 확정된 결정

- **Storage provisioning**: `supabase/schema.sql`에 스크립트로 추가한다(기존 "SQL Editor에 붙여넣고 실행" 패턴 유지, 재현 가능). 버킷은 **public**.
- **아바타 참조 저장 방식**: 고정 경로 `avatars/{user_id}/avatar.jpg` + `upsert`, public URL 뒤에 `?v=<timestamp>` 캐시버스터를 붙여 `user_metadata.avatar_url` 및 `profiles.avatar_url`에 저장한다. (유저당 객체 1개, 고아 파일 없음, resolver 단순)
- **친구 아바타 노출 범위**: 친구 목록(`FriendsPanel`) + 친구 상세 헤더(`MyPage` friendDetail) + 홈 미리보기 칩(`FriendsPreview`) 전부.
- **사진 제거 기능 포함**: 편집 모드에 "사진 제거" 액션 — `avatar_url`을 `null`로 미러링하고 Storage 객체 삭제, 이니셜로 되돌아간다.
- **이미지 처리**: 클라이언트 canvas로 정사각 center-crop + 장변 512px 축소, `image/jpeg` 품질 0.85로 재인코딩. 입력 파일은 `image/*` 타입 + ≤2MB만 허용.

## 제외 사항 (이슈 원문 + 이번 논의)

- 이미지 크롭 UI(원형 마스크 드래그) — 중앙 크롭/축소만.
- 기본 아바타 프리셋 선택.
- signed URL 방식 — public 버킷으로 충분(아바타는 민감 정보 아님).
- 여러 장 보관/이력 — 유저당 1장(`avatar.jpg`)만.

## 1. 데이터 모델 & 권한 (Supabase)

`supabase/schema.sql` 맨 끝에 `-- ===== 이슈 #50: 프로필 아바타 =====` 섹션을 추가한다. 파일은 전체를 재실행해도 안전해야 하므로 모든 문장을 idempotent하게 작성한다.

### 1.1 `profiles.avatar_url` 컬럼

```sql
alter table profiles add column if not exists avatar_url text;
```

- nullable. 값이 없으면 이니셜 폴백.
- `handle_new_user_profile` 트리거는 수정 불필요(컬럼이 nullable, 신규 가입자는 아바타 없음).
- `profiles_select_self_or_related` 정책이 이미 본인 + 요청관계 상대의 `profiles` row 조회를 허용하므로, 친구는 별도 정책 없이 `avatar_url`을 읽는다. 비친구는 RLS로 차단된다(닉네임과 동일).

### 1.2 update 권한 확장

기존 `schema.sql`은 보안 강화를 위해 `profiles`의 update 권한을 `nickname` 컬럼으로만 제한해 두었다(line 228–229). `avatar_url`을 추가한다.

```sql
revoke update on profiles from authenticated;
grant update (nickname, avatar_url) on profiles to authenticated;
```

- `profiles_update_own` 정책(`using / with check (auth.uid() = user_id)`)은 그대로. `friend_code`는 여전히 컬럼 grant에서 빠져 있어 자가 편집 불가.

### 1.3 Storage 버킷 + 정책

```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- `select` 정책은 두지 않는다 — public 버킷이라 public CDN URL로 누구나 읽는다.
- 본인 경로(`{uid}/...`)에만 insert/update/delete 가능 → 타인 파일 덮어쓰기 불가.

## 2. 신규 모듈

### 2.1 `src/lib/avatarUrl.js` — URL resolver

```js
// user 객체(user_metadata.avatar_url) 또는 profile row(avatar_url)에서 아바타 URL 하나를 뽑는다.
// displayName.js 와 같은 우선순위 폴백 패턴.
export function getAvatarUrl(userOrProfile) {
  if (!userOrProfile) return null
  return userOrProfile.user_metadata?.avatar_url || userOrProfile.avatar_url || null
}
```

- 순수 함수 → 단위 테스트 `src/lib/avatarUrl.test.js` 추가 (`displayName.test.js`와 동일 스타일: null 입력, user_metadata 우선, profile row 폴백, 둘 다 없으면 null).

### 2.2 `src/lib/avatarImage.js` — 클라이언트 리사이즈

```js
// 파일을 정사각 center-crop + 장변 size(기본 512) 축소해서 image/jpeg Blob 으로 반환.
export function resizeToSquareJpeg(file, size = 512) { /* Image + canvas, toBlob('image/jpeg', 0.85) */ }
```

- `URL.createObjectURL(file)` → `Image.onload` → 짧은 변 기준 정사각 crop → `canvas` `size x size` → `toBlob`.
- 로드 실패(깨진 파일)·`toBlob` null → reject.
- DOM/canvas 의존이라 node `--test` 대상에서 제외, `npm run build`와 수동 검증으로 커버.

## 3. `useAuth` — `updateAvatar` / `removeAvatar`

`updateNickname`과 동일한 반환 규약(`{ data, error }` 또는 `{ error }`)을 따르고, `user`는 기존처럼 `onAuthStateChange`(USER_UPDATED)로 자동 갱신된다.

```js
const updateAvatar = async (file) => {
  if (!supabase) return { error: new Error('로그인이 필요해요.') }
  if (!file?.type?.startsWith('image/')) return { error: new Error('이미지 파일만 올릴 수 있어요.') }
  if (file.size > 2 * 1024 * 1024) return { error: new Error('2MB 이하 이미지만 올릴 수 있어요.') }

  let blob
  try { blob = await resizeToSquareJpeg(file, 512) }
  catch (e) { return { error: new Error('이미지를 처리하지 못했어요.') } }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('로그인이 필요해요.') }
  const path = `${user.id}/avatar.jpg`

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (upErr) { console.error('[프로필] 아바타 업로드 실패', upErr); return { error: upErr } }

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}` // 고정 경로라 캐시버스터 필요

  const result = await supabase.auth.updateUser({ data: { avatar_url: url } })
  if (result.error) return result

  const { error: profileError } = await supabase
    .from('profiles').update({ avatar_url: url }).eq('user_id', user.id)
  if (profileError) { console.error('[프로필] 아바타 동기화 실패', profileError); return { ...result, error: profileError } }
  return result
}

const removeAvatar = async () => {
  if (!supabase) return { error: new Error('로그인이 필요해요.') }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('로그인이 필요해요.') }

  const result = await supabase.auth.updateUser({ data: { avatar_url: null } })
  if (result.error) return result

  const { error: profileError } = await supabase
    .from('profiles').update({ avatar_url: null }).eq('user_id', user.id)
  if (profileError) { console.error('[프로필] 아바타 제거 동기화 실패', profileError); return { ...result, error: profileError } }

  const { error: rmErr } = await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`])
  if (rmErr) console.error('[프로필] 아바타 객체 삭제 실패(무시)', rmErr) // 참조는 이미 지워졌으므로 치명적 아님
  return result
}
```

- 훅 반환 객체에 `updateAvatar`, `removeAvatar` 추가.
- 훅 상단 주석의 반환 목록에 두 함수 추가.

## 4. 렌더링 지점

URL이 있으면 `<img>`, 없으면 기존 이니셜 `<span>`. 이니셜 로직은 그대로 두고 조건부로 감싼다.

### 4.1 `src/components/mypage/ProfileCard.jsx` (본인, 편집 UI)

- 상단 주석의 "아바타는 이니셜 placeholder(이미지 업로드 없음)" 문구 갱신.
- `useAuth()`에서 `updateAvatar`, `removeAvatar`도 구조분해.
- `getAvatarUrl(user)` 결과가 있으면 `.mypage-avatar`에 `<img>` 렌더, 없으면 기존 이니셜.
- 편집 모드(`editing`)에 아바타 영역 추가:
  - `<input type="file" accept="image/*" ref>` (숨김) + "사진 바꾸기" 버튼으로 트리거 → 모바일에서 갤러리/카메라 시트 자동.
  - 선택 즉시 로컬 미리보기(`URL.createObjectURL`), 저장 버튼 눌러야 실제 업로드. 또는 선택 즉시 업로드 + 로딩 표시 중 택1 — **선택 즉시 미리보기 → 저장 시 커밋**으로 통일(닉네임 저장 흐름과 일관).
  - 현재 아바타가 있으면 "사진 제거" 버튼 → `removeAvatar()`.
  - 업로드/제거 중 `avatarBusy` 상태로 버튼 disable + "올리는 중…" 표시.
  - 에러는 닉네임과 동일하게 `console.error` + 인라인 메시지(`.friend-form-message` 재사용).
- 언마운트 시 `createObjectURL` revoke.

### 4.2 `src/hooks/useFriends.js`

- `profiles` 조회 2곳 중 **친구 닉네임 조회**(line 59–62)의 select에 `avatar_url` 추가: `.select('user_id, nickname, avatar_url')`.
- `nicknameById` 옆에 `avatarById` 맵 구성.
- `toEntry`에 `avatarUrl: avatarById[otherIdOf(r)] ?? null` 추가.
- 내 코드 조회(line 30–34)는 그대로(`friend_code`만).

### 4.3 `src/components/mypage/FriendsPanel.jsx`

- 친구 목록 항목의 `.friend-avatar`: `f.avatarUrl` 있으면 `<img>`, 없으면 기존 `{f.nickname?.[0] || '?'}`.
- 받은/보낸 요청 목록은 이번 범위 밖(텍스트 유지).

### 4.4 `src/pages/MyPage.jsx`

- `onSelectFriend`가 넘기는 객체에 `avatarUrl` 포함: `onSelectFriend({ userId, nickname, avatarUrl })` (FriendsPanel에서 `f.avatarUrl` 전달).
- `friend` state에 `avatarUrl` 보관.
- friendDetail 헤더(`<h3>{friend.nickname}님의 마이페이지</h3>`) 앞에 작은 아바타(`.friend-detail-avatar` 또는 `.friend-avatar` 재사용): `friend.avatarUrl` 있으면 `<img>`, 없으면 이니셜.

### 4.5 `src/components/mypage/FriendsPreview.jsx`

- `friends.slice(0, 4)` 칩을 `{f.nickname}` 텍스트만 → 작은 원형 아바타(있으면) + 이름으로 재구성.
- `useFriends()`에서 이미 `friends` 엔트리에 `avatarUrl`이 실려 오므로 추가 조회 불필요.

## 5. 스타일 (`src/styles.css`)

- 기존 아바타 원(`.mypage-avatar`, `.friend-avatar`)에 자식 `img` 채움 규칙:
  `.mypage-avatar img, .friend-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }`
- `.mypage-preview-friend-chip`을 `display: inline-flex; align-items: center; gap` 으로 바꾸고 `.mypage-preview-friend-chip img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }`.
- friendDetail 헤더 아바타용 소형 사이즈 클래스(약 28–32px) 추가.
- ProfileCard 편집 모드 아바타 액션 영역(버튼 정렬) — 기존 `.mypage-nickname-actions` 패턴 참고.

## 6. 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `supabase/schema.sql` | 이슈 #50 섹션: `avatar_url` 컬럼, grant 확장, `avatars` 버킷 + storage 정책 |
| `src/lib/avatarUrl.js` | **신규** — `getAvatarUrl` resolver |
| `src/lib/avatarUrl.test.js` | **신규** — resolver 단위 테스트 |
| `src/lib/avatarImage.js` | **신규** — `resizeToSquareJpeg` canvas 리사이즈 |
| `src/hooks/useAuth.js` | `updateAvatar`, `removeAvatar` 추가 |
| `src/hooks/useFriends.js` | 친구 `profiles` select에 `avatar_url`, entry에 `avatarUrl` |
| `src/components/mypage/ProfileCard.jsx` | 아바타 `<img>` 렌더 + 편집 모드 업로드/제거 UI |
| `src/components/mypage/FriendsPanel.jsx` | 친구 목록 아바타 `<img>` |
| `src/components/mypage/FriendsPreview.jsx` | 미리보기 칩 아바타 |
| `src/pages/MyPage.jsx` | friend 객체/헤더에 아바타 전달·표시 |
| `src/styles.css` | 아바타 `img` 채움, 칩 재구성, 소형 사이즈 |

## 7. 테스트 / 검증

- `npm run build` — 통과.
- `node --test` — 기존 테스트 + 신규 `avatarUrl.test.js` 통과.
- Supabase(수동): `schema.sql` 재실행 후
  - 본인 업로드 → 즉시 반영, 새로고침 후에도 유지.
  - 사진 교체 → `?v=` 캐시버스터로 새 이미지 즉시 표시.
  - 사진 제거 → 이니셜로 복귀, Storage 객체 삭제 확인.
  - 친구가 내 아바타를 친구 목록/상세/미리보기에서 조회.
  - 비친구는 `profiles.avatar_url` 조회 차단(RLS).
  - 타인 경로(`{다른uid}/avatar.jpg`) 업로드 시도 → storage 정책으로 거부.
  - `image/*` 아닌 파일 / 2MB 초과 → 인라인 에러, 업로드 안 됨.
  - 모바일에서 파일 선택 시 갤러리/카메라 시트 노출.

## 8. 리스크 / 주의

- **`storage.objects` 정책 생성 권한**: Supabase SQL Editor는 소유자 권한으로 실행되므로 `create policy on storage.objects`가 가능하다. 로컬 psql 등 다른 경로로 실행 시 권한 문제가 날 수 있음 — README/주석에 "SQL Editor에서 실행" 명시.
- **캐시버스터 URL 길이**: `?v=<13자리>`만 붙으므로 `text` 컬럼에 문제 없음.
- **기존 사용자 백필 불필요**: 아바타 없던 사용자는 `avatar_url = null` → 이니셜 폴백으로 기존과 동일.
- **`onAuthStateChange` 미갱신 케이스**: `updateUser` 후 USER_UPDATED 이벤트가 오지 않는 드문 상황 대비, `updateAvatar`/`removeAvatar` 성공 시 `ProfileCard`가 반환값으로도 낙관적 갱신할지 여부는 구현 시 판단(닉네임 흐름과 동일하게 이벤트 의존이 기본).
