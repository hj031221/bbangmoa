# 마이페이지 프로필 사진 업로드 — 설계 (이슈 #50)

**날짜:** 2026-08-28
**브랜치:** `feature/profile-avatar` (base: `develop`)
**관련 이슈:** #50 ([FEAT] 마이페이지 프로필 사진 업로드), #48(전체 배치에서 분리), #24(친구 기능 — `profiles` 테이블 도입)

## 배경 및 목표

마이페이지 프로필 카드(`ProfileCard.jsx`)의 `.mypage-avatar`는 현재 닉네임 이니셜만 렌더한다(코드 주석에 "이미지 업로드 없음" 명시). 이번 작업으로 갤러리/파일에서 프로필 사진을 골라 올리고, 본인·친구 화면 전반에서 그 사진을 보여주는 흐름을 구현한다.

Supabase Storage 버킷 신설 + `profiles` 스키마 변경이 포함된 신규 기능이다.

## 브레인스토밍으로 확정된 결정

- **Storage provisioning**: `supabase/schema.sql`에 스크립트로 추가한다(기존 "SQL Editor에 붙여넣고 실행" 패턴 유지, 재현 가능). 버킷은 **public**.
- **아바타 참조 저장 방식**: 고정 경로 `avatars/{user_id}/avatar.jpg` + `upsert`, public URL 뒤에 `?v=<timestamp>` 캐시버스터를 붙여 `user_metadata.avatar_url`(자기 화면 원본) 및 `profiles.avatar_url`(친구 화면 미러)에 저장한다. (유저당 객체 1개, 고아 파일 없음, resolver 단순)
- **친구 아바타 노출 범위**: 친구 목록(`FriendsPanel`) + 친구 상세 헤더(`MyPage` friendDetail) + 홈 미리보기 칩(`FriendsPreview`) 전부.
- **사진 제거 기능 포함**: 편집 모드에 "사진 제거" 액션 — `avatar_url`을 `null`로 미러링하고 Storage 객체 삭제, 이니셜로 되돌아간다.
- **이미지 처리**: 클라이언트에서 `createImageBitmap`(EXIF 방향 보정) → canvas 정사각 center-crop → `image/jpeg` 품질 0.85 재인코딩. 입력 파일은 `image/*` + ≤2MB만 허용(UX 조기 차단). 자세한 변환 규칙은 §2.2.

## 검수 반영으로 확정된 결정

- **Storage 서버 제한(§1.3)**: 정책 조건은 폴더 prefix가 아니라 **정확한 파일명** `name = auth.uid()::text || '/avatar.jpg'`. 버킷에 `allowed_mime_types = ['image/jpeg']`, `file_size_limit` 설정. 클라이언트 타입·크기 검증은 UX용이고, 서버 정책이 실제 강제선이다.
- **원본(source of truth)과 부분 성공(§3)**: 닉네임과 동일한 모델 — `user_metadata.avatar_url`이 **자기 화면 원본**, `profiles.avatar_url`은 **친구 화면 미러**. 쓰기 순서 = Storage 업로드 → `updateUser`(원본) → `profiles` update(미러). 미러 단계만 실패하면 비치명적 경고를 노출하고 "재시도"로 미러만 다시 쓴다. 롤백은 하지 않는다(고정 경로 + upsert라 다음 성공 업로드가 고아 바이트를 덮어씀). 제거도 같은 순서·같은 기준.
- **저장·취소 모델(§4.1)**: 사진 변경·제거도 **임시 상태로만 보관**하고, 편집 폼의 단일 "저장" 버튼에서 닉네임과 함께 커밋한다. "취소"는 로컬 미리보기와 제거 예약을 모두 폐기(네트워크 호출 없음). 저장 시 사진 단계를 먼저 처리하고 성공해야 닉네임 단계로 진행한다.
- **화면 즉시 갱신(§3)**: `updateAvatar`/`removeAvatar`/`updateNickname` 성공 시 훅이 `setUser(result.data.user)`로 로컬 `user`를 즉시 갱신한다(`onAuthStateChange` 이벤트에 의존하지 않음).

## 제외 사항 (이슈 원문 + 이번 논의)

- 이미지 크롭 UI(원형 마스크 드래그) — 중앙 크롭/축소만.
- 기본 아바타 프리셋 선택.
- signed URL / private 버킷 방식 — public 버킷 유지(프라이버시 범위는 §9).
- 여러 장 보관/이력 — 유저당 1장(`avatar.jpg`)만.
- 부분 실패에 대한 자동 재동기화 큐/백그라운드 잡 — 수동 "재시도"만.

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

버킷 레벨에서 MIME·용량을 강제하고, 정책은 **유저당 정확히 한 경로**(`{uid}/avatar.jpg`)만 허용한다. 클라이언트 검증(§3)은 UX용 조기 차단일 뿐 실제 강제선은 여기다.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 1048576,           -- 1 MiB (리사이즈 결과는 보통 ~100KB, 넉넉한 상한)
      allowed_mime_types = array['image/jpeg'];

-- 정책 조건: bucket + "정확한 파일명"이 본인 것. 폴더 prefix 가 아니라 name 전체를 고정.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg');

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using      (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg')
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg');

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg');
```

- `select` 정책은 두지 않는다 — public 버킷이라 public CDN URL로 누구나 읽는다(§9).
- 정확한 파일명 고정 → 임의 파일명(`{uid}/foo.png`, `{uid}/avatar.png` 등)·타인 경로 업로드는 정책에서 거부. JPEG 외 MIME·1MiB 초과는 버킷 설정에서 거부.
- `upsert:true` 재업로드는 `insert` 가 아니라 `update` 경로를 타므로 `avatars_update_own` 이 필요하다.

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
// 파일을 정사각 center-crop 후 image/jpeg Blob 으로 반환. maxSize(기본 512)보다 작으면 확대하지 않는다.
export async function resizeToSquareJpeg(file, maxSize = 512) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) // EXIF 방향 보정
  try {
    const side = Math.min(bitmap.width, bitmap.height)        // 짧은 변 기준 정사각
    const out  = Math.min(maxSize, side)                      // 업스케일 금지
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 얻지 못했어요.')
    ctx.fillStyle = '#fff'                                    // 투명 PNG → 흰 배경
    ctx.fillRect(0, 0, out, out)
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out)
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    if (!blob) throw new Error('이미지 인코딩 실패')
    return blob
  } finally {
    bitmap.close()                                            // 성공·throw 모두에서 해제
  }
}
```

변환 규칙(검수 반영):

- **업스케일 안 함** — 원본이 512px보다 작으면 그 정사각 크기 그대로. 항상 512×512로 확대하지 않는다.
- **투명 영역** — JPEG는 알파를 못 담으므로 `drawImage` 전에 캔버스를 흰색(`#fff`)으로 채운다.
- **EXIF 방향** — `createImageBitmap(file, { imageOrientation: 'from-image' })`로 모바일 회전 사진을 바로 세운다. (미지원 환경 대비 `<img>` + `URL.createObjectURL` 폴백은 선택 구현 — 주 타깃 브라우저는 지원)
- **`createImageBitmap`은 Blob을 직접 받으므로 이 함수 안에서는 `createObjectURL`을 쓰지 않는다.** 미리보기용 `createObjectURL`은 `ProfileCard`에서만 쓰고 성공·실패·언마운트 모든 경로에서 `revokeObjectURL` (§4.1).
- 깨진 파일 → `createImageBitmap` reject, `toBlob` null → throw. 호출부(`updateAvatar`)에서 catch해 인라인 에러.
- DOM/canvas 의존이라 `npm test`(node) 대상에서 제외, `npm run build` + 수동 검증으로 커버.

## 3. `useAuth` — `updateAvatar` / `removeAvatar`

`updateNickname`과 동일한 반환 규약(`{ data, error }` 또는 `{ error }`)을 따른다. **원본/미러**: `user_metadata.avatar_url` = 자기 화면 원본, `profiles.avatar_url` = 친구 화면 미러(닉네임과 동일). 쓰기 순서는 Storage → 원본(`updateUser`) → 미러(`profiles`). 성공한 `updateUser` 결과로 `setUser(result.data.user)`를 호출해 화면을 즉시 갱신한다(`onAuthStateChange`에 의존하지 않음).

```js
const updateAvatar = async (file) => {
  if (!supabase) return { error: new Error('로그인이 필요해요.') }
  // 클라이언트 검증은 UX 조기 차단 — 실제 강제선은 버킷 정책(allowed_mime_types / file_size_limit).
  if (!file?.type?.startsWith('image/')) return { error: new Error('이미지 파일만 올릴 수 있어요.') }
  if (file.size > 2 * 1024 * 1024) return { error: new Error('2MB 이하 이미지만 올릴 수 있어요.') }

  let blob
  try { blob = await resizeToSquareJpeg(file, 512) }
  catch (e) { console.error('[프로필] 이미지 처리 실패', e); return { error: new Error('이미지를 처리하지 못했어요.') } }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('로그인이 필요해요.') }
  const path = `${user.id}/avatar.jpg`

  // 1) Storage — 고정 경로 + upsert. 이 단계 실패면 이후 상태 변화 없음(고아 바이트도 다음 성공 업로드가 덮어씀).
  const { error: upErr } = await supabase.storage
    .from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (upErr) { console.error('[프로필] 아바타 업로드 실패', upErr); return { error: upErr } }

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}` // 고정 경로라 캐시버스터 필수

  // 2) 원본(자기 화면). 실패면 롤백 없이 에러 반환 — 사용자에게 아직 아무것도 안 바뀐 것처럼 보임.
  const result = await supabase.auth.updateUser({ data: { avatar_url: url } })
  if (result.error) { console.error('[프로필] 아바타 저장 실패', result.error); return result }
  setUser(result.data.user) // 즉시 반영

  // 3) 미러(친구 화면). 실패해도 자기 화면은 정상 → 비치명적. 호출부에서 "재시도" 노출.
  const { error: profileError } = await supabase
    .from('profiles').update({ avatar_url: url }).eq('user_id', user.id)
  if (profileError) {
    console.error('[프로필] 아바타 친구용 동기화 실패', profileError)
    return { ...result, error: profileError, partial: 'mirror' } // partial: 미러만 실패했음을 표시
  }
  return result
}

const removeAvatar = async () => {
  if (!supabase) return { error: new Error('로그인이 필요해요.') }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('로그인이 필요해요.') }

  const result = await supabase.auth.updateUser({ data: { avatar_url: null } })
  if (result.error) { console.error('[프로필] 아바타 제거 실패', result.error); return result }
  setUser(result.data.user)

  // 원본(참조)이 지워졌으므로 Storage 객체 삭제는 미러 성공 여부와 무관하게 먼저 best-effort 로 실행.
  // (미러만 실패해 재시도하는 경로에서 공개 이미지가 Storage 에 잔류하지 않게)
  const { error: rmErr } = await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`])
  if (rmErr) console.error('[프로필] 아바타 객체 삭제 실패(무시)', rmErr)

  const { error: profileError } = await supabase
    .from('profiles').update({ avatar_url: null }).eq('user_id', user.id)
  if (profileError) {
    console.error('[프로필] 아바타 제거 동기화 실패', profileError)
    return { ...result, error: profileError, partial: 'mirror' }
  }
  return result
}

// partial:'mirror' 재시도용 — 현재 원본(user_metadata.avatar_url) 값을 profiles 미러에 다시 쓴다.
// 설정/제거 양쪽 커버(제거면 값이 null). Storage 객체는 updateAvatar/removeAvatar 가 이미 처리했으므로 안 건드림.
const syncAvatarMirror = async () => {
  if (!supabase) return { error: new Error('로그인이 필요해요.') }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('로그인이 필요해요.') }
  const url = user.user_metadata?.avatar_url ?? null
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id)
  if (error) { console.error('[프로필] 아바타 미러 재동기화 실패', error); return { error } }
  return { error: null }
}
```

- 훅 반환 객체에 `updateAvatar`, `removeAvatar`, `syncAvatarMirror` 추가, 상단 주석 반환 목록에도 추가.
- **일관성**: `updateNickname`도 성공 시 `setUser(result.data.user)`를 호출하도록 같이 수정한다(현재는 이벤트 의존). 위험 낮고 즉시 반영이 확실해짐.
- 반환값의 `partial: 'mirror'`는 "원본은 저장됐고 친구용 미러만 실패" 신호 — `ProfileCard`가 비치명적 안내 + "재시도"(`syncAvatarMirror()`)를 띄운다.

## 4. 렌더링 지점

URL이 있으면 `<img>`, 없으면 기존 이니셜 `<span>`. 이니셜 로직은 그대로 두고 조건부로 감싼다.

### 4.1 `src/components/mypage/ProfileCard.jsx` (본인, 편집 UI)

- 상단 주석의 "아바타는 이니셜 placeholder(이미지 업로드 없음)" 문구 갱신.
- `useAuth()`에서 `updateAvatar`, `removeAvatar`도 구조분해.
- 비편집 모드: `getAvatarUrl(user)` 있으면 `.mypage-avatar`에 `<img>`, 없으면 기존 이니셜.

**편집 폼 상태 모델(검수 반영 — 사진도 임시 상태, 단일 저장 버튼에서 닉네임과 함께 커밋):**

편집 모드 진입 시 로컬 상태:

| 상태 | 의미 |
|---|---|
| `draft` (기존) | 닉네임 초안 |
| `pendingFile: File \| null` | 새로 고른 사진(아직 업로드 안 함) |
| `pendingRemove: boolean` | "사진 제거" 눌렀음 |
| `previewUrl: string \| null` | `pendingFile`의 `URL.createObjectURL` (미리보기용) |
| `saving`, `formError` | 저장 진행/에러 |

- 아바타 미리보기 우선순위: `pendingFile`(→`previewUrl`) → `pendingRemove`(→이니셜) → 현재 `getAvatarUrl(user)` → 이니셜.
- **"사진 바꾸기"**: 숨긴 `<input type="file" accept="image/*">` 트리거 → `onChange`에서 `pendingFile` 설정, `pendingRemove=false`, 이전 `previewUrl` revoke 후 새로 생성. (여기서는 네트워크 호출 없음)
- **"사진 제거"**: 현재 아바타가 있거나 `pendingFile`이 있을 때만 노출. `pendingRemove=true`, `pendingFile=null`, `previewUrl` revoke.
- **"저장"(`submit`)** 순서:
  1. 닉네임 검증: `trimmed = draft.trim()`. 비어 있으면 중단(기존 동작), 아무것도 커밋 안 함.
  2. `setSaving(true)`.
  3. **사진 단계** (`pendingFile` 또는 `pendingRemove`일 때만): `pendingFile`이면 `updateAvatar(pendingFile)`, 아니면 `removeAvatar()`.
     - 에러(`res.error` 있고 `res.partial !== 'mirror'`): `formError` 표시, **편집 모드 유지**, pending 상태 보존(재시도 가능), 닉네임 단계로 진행하지 않음, `setSaving(false)`.
     - `res.partial === 'mirror'`: 원본은 저장됨 → pending 상태는 클리어(성공 처리)하되 "친구에게 보이는 데 지연될 수 있어요" 비치명적 안내 표시, 닉네임 단계는 계속.
  4. **닉네임 단계** (`trimmed !== name`일 때만): `updateNickname(trimmed)`.
     - 에러: `formError` 표시, 편집 모드 유지, `setSaving(false)`. (사진은 이미 커밋됐고 pending은 클리어된 상태 → 재시도 시 닉네임만 다시 시도)
  5. 전부 성공: pending 상태 클리어, `previewUrl` revoke, `setEditing(false)`, `setSaving(false)`.
- **`partial: 'mirror'` 안내 + 재시도**: 사진 단계가 `partial:'mirror'`를 반환하면 "친구에게 보이는 데 지연될 수 있어요 · 재시도" 표시. 재시도 버튼 → `syncAvatarMirror()`. 성공 시 안내 제거, 실패 시 안내 유지(재클릭 가능). 재시도 중 버튼 disable.
- **"취소" 및 부분 성공 이후 상태**:
  - 저장 버튼을 누르기 **전** 취소: 모든 임시 변경(`pendingFile`/`pendingRemove`/`draft`) 폐기, `previewUrl` revoke, **네트워크 호출 없음**.
  - 저장 중 **사진 단계가 이미 성공**한 경우: 이후 닉네임이 실패하거나 사용자가 취소해도 **서버에 반영된 사진은 유지된다**(사진은 되돌리지 않음).
  - 취소는 아직 커밋되지 않은 로컬 상태만 폐기한다.
- 사진 단계 진행 중 버튼 disable + "저장 중…"(기존 문구 재사용).
- 에러 인라인 메시지는 `.friend-form-message` 재사용.
- `useEffect` cleanup에서 `previewUrl` revoke(언마운트·값 변경 모두 커버).

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
| `supabase/schema.sql` | 이슈 #50 섹션: `avatar_url` 컬럼, update grant 확장, `avatars` public 버킷(MIME·용량 제한) + `storage.objects` 정책(정확 파일명) |
| `src/lib/avatarUrl.js` | **신규** — `getAvatarUrl` resolver |
| `src/lib/avatarUrl.test.js` | **신규** — resolver 단위 테스트 |
| `src/lib/avatarImage.js` | **신규** — `resizeToSquareJpeg` canvas 리사이즈 |
| `src/hooks/useAuth.js` | `updateAvatar`, `removeAvatar`, `syncAvatarMirror` 추가; `updateNickname`에 `setUser` |
| `src/hooks/useFriends.js` | 친구 `profiles` select에 `avatar_url`, entry에 `avatarUrl` |
| `src/components/mypage/ProfileCard.jsx` | 아바타 `<img>` 렌더 + 편집 모드 업로드/제거 UI |
| `src/components/mypage/FriendsPanel.jsx` | 친구 목록 아바타 `<img>` |
| `src/components/mypage/FriendsPreview.jsx` | 미리보기 칩 아바타 |
| `src/pages/MyPage.jsx` | friend 객체/헤더에 아바타 전달·표시 |
| `src/styles.css` | 아바타 `img` 채움, 칩 재구성, 소형 사이즈 |

## 7. 테스트 / 검증

- `npm run build` — 통과.
- `npm test` (= `node --test "src/**/*.test.js"`) — 기존 테스트 + 신규 `avatarUrl.test.js` 통과.
- Supabase(수동): `schema.sql` 재실행 후
  - 본인 업로드 → 즉시 반영, 새로고침 후에도 유지.
  - 사진 교체 → `?v=` 캐시버스터로 새 이미지 즉시 표시.
  - 사진 제거 → 이니셜로 복귀, Storage 객체 삭제 확인.
  - 친구가 내 아바타를 친구 목록/상세/미리보기에서 조회.
  - 비친구는 `profiles.avatar_url` 문자열 조회 차단(RLS). (이미지 바이트 자체는 public — §9)
  - **Storage 정책 거부 케이스**: 타인 경로(`{다른uid}/avatar.jpg`), 임의 파일명(`{내uid}/foo.png`, `{내uid}/avatar.png`), 허용 안 된 MIME(`image/png`·`image/gif` 업로드), `file_size_limit` 초과 — 모두 거부되는지.
  - 클라이언트: `image/*` 아닌 파일 / 2MB 초과 → 인라인 에러, 업로드 시도 안 함.
  - 작은 이미지(예: 128×128) 업로드 → 확대되지 않고 128×128로 저장.
  - 투명 PNG 업로드 → 흰 배경으로 채워져 저장.
  - 회전 정보(EXIF orientation) 있는 모바일 사진 → 똑바로 표시.
  - 저장·취소: 사진만 바꾸고 취소 → 아무 변화 없음 / 사진+닉네임 바꾸고 저장 → 둘 다 반영 / 닉네임 비우고 저장 → 사진도 커밋 안 됨 / 사진 성공 후 닉네임 실패 상태에서 취소 → 사진은 서버에 유지.
  - 미러 실패 시뮬레이션(`profiles` 쓰기 차단) 후 `syncAvatarMirror()` 재시도 → 친구 화면 동기화 회복.
  - 모바일: 파일 선택기가 정상 호출되고 사진 선택·반영이 가능한지(갤러리/카메라 시트 노출 자체는 OS·브라우저 소관이라 검증 대상 아님).

## 8. 리스크 / 주의

- **`storage.objects` 정책·버킷 설정 권한**: Supabase SQL Editor는 소유자 권한으로 실행되므로 `create policy on storage.objects` 및 `storage.buckets` 갱신이 가능하다. 로컬 psql 등 다른 경로로 실행 시 권한 문제가 날 수 있음 — `schema.sql` 주석에 "SQL Editor에서 실행" 명시.
- **캐시버스터 URL 길이**: `?v=<13자리>`만 붙으므로 `text` 컬럼에 문제 없음.
- **기존 사용자 백필 불필요**: 아바타 없던 사용자는 `avatar_url = null` → 이니셜 폴백으로 기존과 동일.
- **부분 성공(원본 OK / 미러 실패)**: `partial: 'mirror'` 신호 → 비치명적 안내 + `syncAvatarMirror()` 재시도(미러만 다시 쓰기). 제거 시 Storage 객체는 `removeAvatar`가 미러 실패와 무관하게 이미 삭제하므로, 재시도는 미러 갱신만 하면 된다. 자동 재동기화 큐는 범위 밖.
- **`createImageBitmap` 미지원 브라우저**: 주 타깃(모던 크롬/사파리/파이어폭스)은 지원. 필요 시 `<img>`+`createObjectURL` 폴백은 후속.

## 9. 프라이버시 범위 (public 버킷)

- 프로필 사진은 **공개 가능한 정보**로 취급한다.
- `profiles` RLS의 비친구 차단은 **`avatar_url` 문자열 값 조회**에만 적용된다.
- 버킷이 public이므로, 이미지 URL을 알거나 경로(`avatars/{uid}/avatar.jpg`)를 추측할 수 있으면 이미지 파일 자체는 열람 가능하다. 파일명이 `{uid}/avatar.jpg`로 고정이라 상대 UUID를 아는 사용자는 URL을 구성할 수 있다(비친구에게 UUID가 노출되는 경로는 없지만, 난독화에 의존하지 않는다).
- **이미지 바이트의 완전한 비공개는 보장하지 않는다.** 완전 비공개가 필요해지면 private 버킷 + signed URL로 전환해야 하며, 그 경우 친구 목록 렌더마다 서명 URL 발급 비용이 추가된다(현 범위 밖).
