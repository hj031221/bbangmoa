# 마이페이지 프로필 사진 업로드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마이페이지에서 프로필 사진(아바타)을 갤러리/파일에서 올리고, 본인·친구 화면 전반에 표시한다.

**Architecture:** 클라이언트에서 이미지를 정사각 512px JPEG로 리사이즈해 Supabase Storage `avatars` public 버킷의 고정 경로 `{uid}/avatar.jpg`에 upsert한다. public URL(+캐시버스터)을 `user_metadata.avatar_url`(자기 화면 원본)과 `profiles.avatar_url`(친구 화면 미러)에 저장한다. 렌더링 지점은 URL이 있으면 `<img>`, 없으면 기존 이니셜로 폴백한다. 사진/닉네임 변경은 편집 폼의 임시 상태로 두고 단일 "저장" 버튼에서 함께 커밋한다.

**Tech Stack:** React 18, Vite 5, `@supabase/supabase-js` v2, `node --test` (순수 함수만), plain CSS.

**Spec:** `docs/superpowers/specs/2026-08-28-profile-avatar-design.md`

## Global Constraints

- **테스트 실행:** `npm test` = `node --test "src/**/*.test.js"`. 순수 함수만 테스트 대상(DOM/canvas/Supabase 의존 코드는 `npm run build` + 수동 검증).
- **빌드:** 모든 태스크는 `npm run build` 통과로 끝난다.
- **아바타 저장 경로:** 정확히 `avatars/{user_id}/avatar.jpg` (유저당 1객체, `upsert:true`).
- **캐시버스터:** public URL 뒤에 `?v=${Date.now()}` 필수(고정 경로라 캐시 갱신 안 되면 옛 이미지가 남음).
- **원본/미러:** `user_metadata.avatar_url` = 자기 화면 원본, `profiles.avatar_url` = 친구 화면 미러. 쓰기 순서 Storage → 원본 → 미러. 미러만 실패하면 `{ ...result, error, partial: 'mirror' }` 반환.
- **이미지 규칙:** 정사각 center-crop, 장변 `min(512, 짧은변)` (업스케일 금지), 투명 영역은 흰색(`#fff`) 배경, `image/jpeg` 품질 0.85, EXIF 방향 보정.
- **클라이언트 입력 검증(UX):** `type.startsWith('image/')` + `size ≤ 2MB`. 실제 강제선은 버킷의 `allowed_mime_types`/`file_size_limit`.
- **커밋 메시지 꼬리말:** 각 커밋 본문 끝에 아래 2줄.
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01F2sePC7pYGBqPH2at8qen6
  ```
- **브랜치:** `feature/profile-avatar` (이미 체크아웃됨, base `develop`).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/lib/avatarUrl.js` (신규) | user 객체 또는 friend entry에서 아바타 URL 하나를 뽑는 순수 resolver |
| `src/lib/avatarUrl.test.js` (신규) | resolver 단위 테스트 |
| `src/lib/avatarImage.js` (신규) | `resizeToSquareJpeg(file, maxSize)` — canvas 리사이즈/재인코딩 |
| `supabase/schema.sql` (수정) | `#50` 섹션: `avatar_url` 컬럼, update grant 확장, `avatars` 버킷 + storage 정책 |
| `src/hooks/useAuth.js` (수정) | `updateAvatar` / `removeAvatar` / `syncAvatarMirror`, `updateNickname`에 `setUser` |
| `src/hooks/useFriends.js` (수정) | 친구 `profiles` select에 `avatar_url`, entry에 `avatarUrl` |
| `src/components/mypage/ProfileCard.jsx` (수정) | 아바타 `<img>` 렌더 + 편집 모드 업로드/제거/저장/취소/재시도 UI |
| `src/components/mypage/FriendsPanel.jsx` (수정) | 친구 목록 아바타, `onSelectFriend`에 `avatarUrl` 전달 |
| `src/pages/MyPage.jsx` (수정) | `friend` 객체·상세 헤더에 아바타 |
| `src/components/mypage/FriendsPreview.jsx` (수정) | 홈 미리보기 칩에 소형 아바타 |
| `src/styles.css` (수정) | 아바타 원 `img` 채움, 칩 재구성, 소형 사이즈, 편집 액션 영역 |

---

## Task 1: `getAvatarUrl` resolver (순수 함수, TDD)

**Files:**
- Create: `src/lib/avatarUrl.js`
- Test: `src/lib/avatarUrl.test.js`

**Interfaces:**
- Consumes: 없음.
- Produces: `getAvatarUrl(userOrProfile: object | null) => string | null` — `userOrProfile.user_metadata?.avatar_url`(truthy) → `userOrProfile.avatar_url`(truthy) → `null`.

- [ ] **Step 1: Write the failing test**

`src/lib/avatarUrl.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getAvatarUrl } from './avatarUrl.js'

test('getAvatarUrl: user_metadata.avatar_url 이 최우선', () => {
  const user = { user_metadata: { avatar_url: 'https://x/a.jpg' }, avatar_url: 'https://x/b.jpg' }
  assert.equal(getAvatarUrl(user), 'https://x/a.jpg')
})

test('getAvatarUrl: user_metadata 없으면 최상위 avatar_url (친구 entry)', () => {
  assert.equal(getAvatarUrl({ avatar_url: 'https://x/b.jpg' }), 'https://x/b.jpg')
})

test('getAvatarUrl: user_metadata.avatar_url 이 빈 문자열이면 폴백', () => {
  const user = { user_metadata: { avatar_url: '' }, avatar_url: 'https://x/b.jpg' }
  assert.equal(getAvatarUrl(user), 'https://x/b.jpg')
})

test('getAvatarUrl: 아무 값도 없으면 null', () => {
  assert.equal(getAvatarUrl({ user_metadata: {} }), null)
})

test('getAvatarUrl: 인자가 null 이면 null', () => {
  assert.equal(getAvatarUrl(null), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/avatarUrl.test.js`
Expected: FAIL — `Cannot find module './avatarUrl.js'` 또는 `getAvatarUrl is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/avatarUrl.js`:
```js
// user 객체(user_metadata.avatar_url) 또는 친구 목록 entry(avatar_url)에서 아바타 이미지 URL 하나를 뽑는다.
// 값이 없으면 null → 호출부가 이니셜로 폴백. displayName.js 와 같은 우선순위 폴백 패턴.
export function getAvatarUrl(userOrProfile) {
  if (!userOrProfile) return null
  return userOrProfile.user_metadata?.avatar_url || userOrProfile.avatar_url || null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/avatarUrl.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Run full test + build**

Run: `npm test && npm run build`
Expected: 전체 테스트 PASS, 빌드 성공.

- [ ] **Step 6: Commit**

```bash
git add src/lib/avatarUrl.js src/lib/avatarUrl.test.js
git commit -m "feat: 아바타 URL resolver getAvatarUrl (이슈 #50)"
```

---

## Task 2: `resizeToSquareJpeg` 이미지 유틸 (DOM/canvas, 빌드 검증)

**Files:**
- Create: `src/lib/avatarImage.js`

**Interfaces:**
- Consumes: 없음.
- Produces: `resizeToSquareJpeg(file: File | Blob, maxSize = 512) => Promise<Blob>` — `image/jpeg` Blob. 실패(깨진 파일 / 2d 컨텍스트 없음 / 인코딩 실패) 시 `throw Error`.

> node `--test`는 `document`/`createImageBitmap`이 없어 이 파일을 테스트하지 않는다. 검증은 `npm run build` + Task 9의 브라우저 수동 체크.

- [ ] **Step 1: Create the file**

`src/lib/avatarImage.js`:
```js
// 프로필 아바타용 클라이언트 리사이즈: 파일을 정사각 center-crop 후 image/jpeg Blob 으로 반환한다.
// maxSize(기본 512)보다 원본이 작으면 확대하지 않는다. 투명 영역은 흰 배경으로 채운다.
export async function resizeToSquareJpeg(file, maxSize = 512) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) // EXIF 방향 보정
  try {
    const side = Math.min(bitmap.width, bitmap.height) // 짧은 변 기준 정사각
    const out = Math.min(maxSize, side)                // 업스케일 금지
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 얻지 못했어요.')
    ctx.fillStyle = '#fff' // 투명 PNG → 흰 배경 (JPEG 는 알파 미지원)
    ctx.fillRect(0, 0, out, out)
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
      0, 0, out, out,
    )
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) throw new Error('이미지 인코딩에 실패했어요.')
    return blob
  } finally {
    bitmap.close() // 성공·throw 모두에서 해제
  }
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: 빌드 성공(구문/임포트 오류 없음).

- [ ] **Step 3: Commit**

```bash
git add src/lib/avatarImage.js
git commit -m "feat: 아바타 이미지 리사이즈 유틸 resizeToSquareJpeg (이슈 #50)"
```

---

## Task 3: `supabase/schema.sql` — 이슈 #50 섹션

**Files:**
- Modify: `supabase/schema.sql` (파일 맨 끝에 추가; 현재 마지막 줄은 `alter function find_user_by_friend_code(text) set search_path = public, pg_temp;`)

**Interfaces:**
- Consumes: 기존 `profiles` 테이블 + `profiles_update_own` 정책.
- Produces: `profiles.avatar_url text` 컬럼, `authenticated`의 `update (nickname, avatar_url)` grant, `avatars` public 버킷(`file_size_limit=1048576`, `allowed_mime_types={image/jpeg}`), `storage.objects`의 `avatars_insert_own` / `avatars_update_own` / `avatars_delete_own` 정책.

> 자동 테스트 없음. 실제 반영은 사용자가 Supabase SQL Editor에서 실행(Task 9 체크리스트).

- [ ] **Step 1: Append the section**

`supabase/schema.sql` 맨 끝에 빈 줄 하나 두고 아래를 붙인다:
```sql

-- ===== 이슈 #50: 마이페이지 프로필 아바타 =====
-- 아래 storage.* 문장은 소유자 권한이 필요하다 — 반드시 Supabase 대시보드 SQL Editor 에서 실행할 것.

alter table profiles add column if not exists avatar_url text;

-- 기존엔 update 권한이 nickname 컬럼으로만 제한돼 있었다. avatar_url 을 추가한다.
revoke update on profiles from authenticated;
grant update (nickname, avatar_url) on profiles to authenticated;

-- 아바타 저장용 public 버킷. MIME/용량은 버킷 레벨에서 강제(클라이언트 검증은 UX 용).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 1048576,           -- 1 MiB (리사이즈 결과는 보통 ~100KB)
      allowed_mime_types = array['image/jpeg'];

-- 유저당 "정확히 한 경로"({uid}/avatar.jpg)만 허용. 폴더 prefix 가 아니라 name 전체를 고정한다.
-- select 정책은 두지 않는다 — public 버킷이라 public CDN URL 로 누구나 읽는다(프로필 사진은 공개 정보).
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar.jpg');

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
```

- [ ] **Step 2: Sanity check the diff**

Run: `git diff supabase/schema.sql`
Expected: 위 블록만 추가됨. 기존 라인(특히 line 228–229의 `revoke update on profiles` / `grant update (nickname)`)은 그대로 — 파일은 위에서 아래로 전체 재실행되므로 이 섹션의 재-grant가 최종 상태를 결정한다.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: profiles.avatar_url + avatars 스토리지 버킷/정책 (이슈 #50)"
```

---

## Task 4: `useAuth` — `updateAvatar` / `removeAvatar` / `syncAvatarMirror`

**Files:**
- Modify: `src/hooks/useAuth.js`

**Interfaces:**
- Consumes: `resizeToSquareJpeg` (Task 2), `supabase` (`src/lib/supabase.js`).
- Produces (훅 반환 객체에 추가):
  - `updateAvatar(file: File) => Promise<{ data?, error?: Error, partial?: 'mirror' }>`
  - `removeAvatar() => Promise<{ data?, error?: Error, partial?: 'mirror' }>`
  - `syncAvatarMirror() => Promise<{ error: Error | null }>`
  - 성공 시 내부에서 `setUser(result.data.user)` 호출(즉시 반영). `updateNickname`도 동일하게 수정.

> 자동 테스트 없음(Supabase 목 인프라 없음). 검증은 `npm run build` + `npm test` 회귀 + Task 9 수동.

- [ ] **Step 1: Add the import**

`src/hooks/useAuth.js` 상단, 기존 `import { supabase, supabaseEnabled } from '../lib/supabase'` 다음 줄에 추가:
```js
import { resizeToSquareJpeg } from '../lib/avatarImage'
```

- [ ] **Step 2: Add `setUser` to `updateNickname`**

`updateNickname` 안에서, `if (!result || result.error) return result ?? { error: new Error('로그인이 필요해요.') }` 바로 다음 줄에 추가:
```js
  setUser(result.data.user) // onAuthStateChange 이벤트에 의존하지 않고 즉시 반영
```

- [ ] **Step 3: Add the three functions**

`updateNickname` 함수 정의 바로 다음(= `return { user, loading, ... }` 직전)에 추가:
```js
  // 프로필 아바타 업로드. avatars 버킷 {uid}/avatar.jpg 에 upsert 하고
  // user_metadata.avatar_url(자기 화면 원본) → profiles.avatar_url(친구 화면 미러) 순으로 저장한다.
  // 미러 단계만 실패하면 { ...result, error, partial: 'mirror' } 로 신호한다(비치명적).
  const updateAvatar = async (file) => {
    if (!supabase) return { error: new Error('로그인이 필요해요.') }
    // 클라이언트 검증은 UX 조기 차단 — 실제 강제선은 버킷 정책(allowed_mime_types / file_size_limit).
    if (!file?.type?.startsWith('image/')) return { error: new Error('이미지 파일만 올릴 수 있어요.') }
    if (file.size > 2 * 1024 * 1024) return { error: new Error('2MB 이하 이미지만 올릴 수 있어요.') }

    let blob
    try {
      blob = await resizeToSquareJpeg(file, 512)
    } catch (e) {
      console.error('[프로필] 이미지 처리 실패', e)
      return { error: new Error('이미지를 처리하지 못했어요.') }
    }

    const { data: { user: current } } = await supabase.auth.getUser()
    if (!current) return { error: new Error('로그인이 필요해요.') }
    const path = `${current.id}/avatar.jpg`

    // 1) Storage — 고정 경로 + upsert. 이 단계 실패면 이후 상태 변화 없음.
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (upErr) {
      console.error('[프로필] 아바타 업로드 실패', upErr)
      return { error: upErr }
    }

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${pub.publicUrl}?v=${Date.now()}` // 고정 경로라 캐시버스터 필수

    // 2) 원본(자기 화면). 실패면 롤백 없이 에러 반환.
    const result = await supabase.auth.updateUser({ data: { avatar_url: url } })
    if (result.error) {
      console.error('[프로필] 아바타 저장 실패', result.error)
      return result
    }
    setUser(result.data.user)

    // 3) 미러(친구 화면). 실패해도 자기 화면은 정상 → 비치명적.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('user_id', current.id)
    if (profileError) {
      console.error('[프로필] 아바타 친구용 동기화 실패', profileError)
      return { ...result, error: profileError, partial: 'mirror' }
    }
    return result
  }

  // 아바타 제거 → 이니셜로 복귀. 참조(원본)를 먼저 지우고, Storage 객체 삭제는
  // 미러 성공 여부와 무관하게 best-effort 로 실행한다(미러만 실패해 재시도해도 공개 이미지가 잔류하지 않게).
  const removeAvatar = async () => {
    if (!supabase) return { error: new Error('로그인이 필요해요.') }
    const { data: { user: current } } = await supabase.auth.getUser()
    if (!current) return { error: new Error('로그인이 필요해요.') }

    const result = await supabase.auth.updateUser({ data: { avatar_url: null } })
    if (result.error) {
      console.error('[프로필] 아바타 제거 실패', result.error)
      return result
    }
    setUser(result.data.user)

    const { error: rmErr } = await supabase.storage.from('avatars').remove([`${current.id}/avatar.jpg`])
    if (rmErr) console.error('[프로필] 아바타 객체 삭제 실패(무시)', rmErr)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('user_id', current.id)
    if (profileError) {
      console.error('[프로필] 아바타 제거 동기화 실패', profileError)
      return { ...result, error: profileError, partial: 'mirror' }
    }
    return result
  }

  // partial:'mirror' 재시도용 — 현재 원본(user_metadata.avatar_url) 값을 profiles 미러에 다시 쓴다.
  // 설정/제거 양쪽 커버(제거면 값이 null). Storage 객체는 update/removeAvatar 가 이미 처리했다.
  const syncAvatarMirror = async () => {
    if (!supabase) return { error: new Error('로그인이 필요해요.') }
    const { data: { user: current } } = await supabase.auth.getUser()
    if (!current) return { error: new Error('로그인이 필요해요.') }
    const url = current.user_metadata?.avatar_url ?? null
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('user_id', current.id)
    if (error) {
      console.error('[프로필] 아바타 미러 재동기화 실패', error)
      return { error }
    }
    return { error: null }
  }
```

- [ ] **Step 4: Export them**

`return { user, loading, signInWithGoogle, signInWithKakao, signOut, updateNickname }` 를
```js
  return {
    user, loading, signInWithGoogle, signInWithKakao, signOut,
    updateNickname, updateAvatar, removeAvatar, syncAvatarMirror,
  }
```
로 바꾸고, 파일 상단 JSDoc 주석의 반환 목록에 `updateAvatar / removeAvatar / syncAvatarMirror : 프로필 아바타 업로드·제거·미러 재동기화` 한 줄 추가.

- [ ] **Step 5: Build + regression tests**

Run: `npm run build && npm test`
Expected: 빌드 성공, 기존 테스트 전부 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAuth.js
git commit -m "feat: useAuth 아바타 업로드/제거/미러재시도 (이슈 #50)"
```

---

## Task 5: `useFriends` — 친구 entry에 `avatarUrl`

**Files:**
- Modify: `src/hooks/useFriends.js`

**Interfaces:**
- Consumes: 기존 `profiles` 조회.
- Produces: `friends` / `incomingRequests` / `outgoingRequests` 각 entry에 `avatarUrl: string | null` 필드 추가. (`toEntry` 반환 형태가 `{ id, userId, nickname, avatarUrl }` 로 확장됨)

- [ ] **Step 1: Widen the select**

친구 닉네임 조회 부분(`const { data: profiles, error: nicknamesError } = await supabase.from('profiles').select('user_id, nickname').in('user_id', otherIds)`):
```js
      const { data: profiles, error: nicknamesError } = await supabase
        .from('profiles')
        .select('user_id, nickname, avatar_url')
        .in('user_id', otherIds)
```

- [ ] **Step 2: Build the avatar map**

`nicknameById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.nickname]))` 바로 다음 줄에 추가:
```js
      avatarById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.avatar_url]))
```
그리고 `let nicknameById = {}` 선언 옆에 `let avatarById = {}` 추가.

- [ ] **Step 3: Add to `toEntry`**

```js
    const toEntry = (r) => ({
      id: r.id,
      userId: otherIdOf(r),
      nickname: nicknameById[otherIdOf(r)] || '이름 없음',
      avatarUrl: avatarById[otherIdOf(r)] ?? null,
    })
```

- [ ] **Step 4: Build + regression tests**

Run: `npm run build && npm test`
Expected: 빌드 성공, 기존 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFriends.js
git commit -m "feat: useFriends 친구 entry 에 avatarUrl (이슈 #50)"
```

---

## Task 6: `ProfileCard` 비편집 아바타 렌더 + CSS `img` 채움

**Files:**
- Modify: `src/components/mypage/ProfileCard.jsx`
- Modify: `src/styles.css` (`.mypage-avatar` 규칙 근처, line ~774)

**Interfaces:**
- Consumes: `getAvatarUrl` (Task 1).
- Produces: 없음(내부 렌더만).

- [ ] **Step 1: Import + compute URL**

`src/components/mypage/ProfileCard.jsx`:
- import 추가: `import { getAvatarUrl } from '../../lib/avatarUrl'`
- `const initial = name?.[0] || '?'` 다음 줄에: `const savedAvatarUrl = getAvatarUrl(user)`
- 상단 주석(7–9행) 첫 문장 "아바타는 이니셜 placeholder(이미지 업로드 없음)"을
  "아바타는 avatars 버킷의 이미지(getAvatarUrl)로 렌더하고, 없으면 이니셜로 폴백" 으로 교체.

- [ ] **Step 2: Conditional avatar in JSX**

`<div className="mypage-avatar" aria-hidden="true">{initial}</div>` 를:
```jsx
      <div className="mypage-avatar" aria-hidden="true">
        {savedAvatarUrl ? <img src={savedAvatarUrl} alt="" /> : initial}
      </div>
```

- [ ] **Step 3: CSS `img` fill rule**

`src/styles.css` 의 `.mypage-avatar{ ... }` 줄 바로 다음에 추가:
```css
.mypage-avatar img, .friend-avatar img{ width:100%; height:100%; object-fit:cover; border-radius:inherit; display:block; }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: 성공. (아바타 없는 사용자는 여전히 이니셜 표시 — 회귀 없음)

- [ ] **Step 5: Commit**

```bash
git add src/components/mypage/ProfileCard.jsx src/styles.css
git commit -m "feat: ProfileCard 아바타 이미지 렌더 (이슈 #50)"
```

---

## Task 7: `ProfileCard` 편집 모드 — 업로드/제거/저장/취소/재시도

**Files:**
- Modify: `src/components/mypage/ProfileCard.jsx` (전체 교체)
- Modify: `src/styles.css` (편집 액션 영역)

**Interfaces:**
- Consumes: `useAuth().updateAvatar / removeAvatar / syncAvatarMirror / updateNickname` (Task 4), `getAvatarUrl` (Task 1).
- Produces: 없음.

**동작 규약(스펙 §4.1):**
- 편집 진입 시 사진 변경은 `pendingFile`(새 파일) / `pendingRemove`(제거 예약) 임시 상태로만 둔다.
- 미리보기 우선순위: `pendingFile`(→`previewUrl`) → `pendingRemove`(→이니셜) → `savedAvatarUrl` → 이니셜.
- "저장": ① 변경 없으면 그냥 닫기 ② 사진 단계 먼저(에러면 편집 유지·pending 보존·중단; `partial:'mirror'`면 pending 클리어 + 경고 표시 후 계속) ③ 닉네임 변경분만 저장(에러면 편집 유지).
- "취소": 임시 상태만 폐기, 네트워크 호출 없음. **이미 커밋된 사진은 되돌리지 않는다.**
- `partial:'mirror'` 경고에 "재시도" → `syncAvatarMirror()`.
- `previewUrl`은 값 변경·언마운트 모두에서 `URL.revokeObjectURL`.

- [ ] **Step 1: Replace the whole file**

`src/components/mypage/ProfileCard.jsx` 전체를 아래로 교체:
```jsx
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFriends } from '../../hooks/useFriends'
import { getDisplayName } from '../../lib/displayName'
import { getAvatarUrl } from '../../lib/avatarUrl'
import { buildInviteLink } from '../../lib/inviteLink'

// 마이페이지 왼쪽 프로필 카드. 아바타 이미지 업로드(갤러리/파일) + 닉네임 편집.
// 아바타는 avatars 버킷 {uid}/avatar.jpg 에 저장되고 user_metadata.avatar_url(자기 화면 원본) +
// profiles.avatar_url(친구 화면 미러) 에 URL 이 미러링된다. getAvatarUrl 이 최우선으로 읽는다.
// 사진/닉네임 변경은 편집 모드에서 임시 상태로만 두고 "저장" 버튼에서 함께 커밋한다.
export default function ProfileCard() {
  const { user, updateNickname, updateAvatar, removeAvatar, syncAvatarMirror } = useAuth()
  const { friendCode } = useFriends()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [mirrorWarning, setMirrorWarning] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingRemove, setPendingRemove] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)
  const [copied, setCopied] = useState('') // 'code' | 'link' | ''
  const [copyError, setCopyError] = useState('')
  const copiedTimeoutRef = useRef(null)

  const name = getDisplayName(user)
  const initial = name?.[0] || '?'
  const savedAvatarUrl = getAvatarUrl(user)

  // 편집 모드 미리보기 우선순위: 새로 고른 파일 → 제거 예약 → 저장된 아바타 → 이니셜
  const shownAvatarUrl = pendingFile ? previewUrl : pendingRemove ? null : savedAvatarUrl

  // previewUrl 은 값이 바뀌거나 언마운트될 때 해제한다.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // 복사 결과(성공 라벨/실패 메시지)는 같은 타이머 하나로만 정리한다.
  const showCopied = (which) => {
    setCopied(which)
    setCopyError('')
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
    copiedTimeoutRef.current = setTimeout(() => setCopied(''), 1500)
  }
  const showCopyError = () => {
    setCopied('')
    setCopyError('복사에 실패했어요.')
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
    copiedTimeoutRef.current = setTimeout(() => setCopyError(''), 1500)
  }

  const clearPending = () => {
    setPendingFile(null)
    setPendingRemove(false)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const startEdit = () => {
    setDraft(name === '내 계정' ? '' : name)
    setFormError('')
    setMirrorWarning(false)
    clearPending()
    setEditing(true)
  }

  const cancelEdit = () => {
    clearPending()
    setFormError('')
    setEditing(false)
  }

  const pickFile = () => fileInputRef.current?.click()

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 고를 수 있게 초기화
    if (!file) return
    setFormError('')
    setPendingRemove(false)
    setPendingFile(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const markRemove = () => {
    setFormError('')
    setPendingFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPendingRemove(true)
  }

  const retryMirror = async () => {
    setRetrying(true)
    const { error } = await syncAvatarMirror()
    setRetrying(false)
    if (!error) setMirrorWarning(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = draft.trim()
    const nickChanged = !!trimmed && trimmed !== name
    const photoChanged = !!pendingFile || pendingRemove
    if (!nickChanged && !photoChanged) {
      setEditing(false)
      return
    }
    setSaving(true)
    setFormError('')

    // 1) 사진 단계 — pending 이 있을 때만. 성공해야 닉네임 단계로 넘어간다.
    if (photoChanged) {
      const res = pendingFile ? await updateAvatar(pendingFile) : await removeAvatar()
      if (res?.error && res.partial !== 'mirror') {
        setSaving(false)
        setFormError(res.error.message || '사진을 저장하지 못했어요.')
        return // pending 유지 → 재시도 가능
      }
      clearPending()
      setMirrorWarning(res?.partial === 'mirror')
    }

    // 2) 닉네임 단계 — 값이 바뀐 경우에만.
    if (nickChanged) {
      const { error } = await updateNickname(trimmed)
      if (error) {
        setSaving(false)
        setFormError('닉네임을 저장하지 못했어요.')
        return
      }
    }

    setSaving(false)
    setEditing(false)
  }

  const copyCode = async () => {
    if (!friendCode) return
    try {
      await navigator.clipboard.writeText(friendCode)
    } catch (err) {
      console.error('[프로필] 코드 복사 실패', err)
      showCopyError()
      return
    }
    showCopied('code')
  }

  const copyLink = async () => {
    if (!friendCode) return
    try {
      await navigator.clipboard.writeText(buildInviteLink(window.location.origin, friendCode))
    } catch (err) {
      console.error('[프로필] 초대 링크 복사 실패', err)
      showCopyError()
      return
    }
    showCopied('link')
  }

  const avatarUrlToShow = editing ? shownAvatarUrl : savedAvatarUrl

  return (
    <div className="mypage-profile">
      <div className="mypage-avatar" aria-hidden="true">
        {avatarUrlToShow ? <img src={avatarUrlToShow} alt="" /> : initial}
      </div>
      {editing ? (
        <form className="mypage-nickname-form" onSubmit={submit}>
          <div className="mypage-avatar-actions">
            <button type="button" className="ghost-btn" onClick={pickFile} disabled={saving}>
              사진 바꾸기
            </button>
            {(savedAvatarUrl || pendingFile) && !pendingRemove && (
              <button type="button" className="ghost-btn" onClick={markRemove} disabled={saving}>
                사진 제거
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onFileChange}
            />
          </div>
          <input
            className="mypage-nickname-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <div className="mypage-nickname-actions">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button type="button" className="ghost-btn" onClick={cancelEdit} disabled={saving}>
              취소
            </button>
          </div>
          {formError && <p className="friend-form-message">{formError}</p>}
        </form>
      ) : (
        <>
          <h3 className="mypage-name">{name}</h3>
          <button type="button" className="ghost-btn" onClick={startEdit}>
            프로필 편집
          </button>
        </>
      )}
      {mirrorWarning && (
        <p className="friend-form-message">
          친구에게 보이는 데 잠시 지연될 수 있어요.{' '}
          <button type="button" className="ghost-btn" onClick={retryMirror} disabled={retrying}>
            {retrying ? '재시도 중…' : '재시도'}
          </button>
        </p>
      )}
      {friendCode && (
        <div className="mypage-friend-code">
          <span className="mypage-friend-code-label">친구코드 {friendCode}</span>
          <div className="mypage-friend-code-actions">
            <button type="button" className="ghost-btn" onClick={copyCode}>
              {copied === 'code' ? '복사됨!' : '코드 복사'}
            </button>
            <button type="button" className="ghost-btn" onClick={copyLink}>
              {copied === 'link' ? '복사됨!' : '초대 링크 복사'}
            </button>
          </div>
          {copyError && <p className="friend-form-message">{copyError}</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: CSS for the avatar action row**

`src/styles.css` 의 `.mypage-nickname-actions{ ... }` 줄 바로 다음에 추가:
```css
.mypage-avatar-actions{ display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
```

- [ ] **Step 3: Build + regression tests**

Run: `npm run build && npm test`
Expected: 빌드 성공, 기존 테스트 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/mypage/ProfileCard.jsx src/styles.css
git commit -m "feat: ProfileCard 편집 모드 아바타 업로드/제거/재시도 (이슈 #50)"
```

---

## Task 8: 친구 아바타 — FriendsPanel / MyPage 상세 / FriendsPreview

**Files:**
- Modify: `src/components/mypage/FriendsPanel.jsx`
- Modify: `src/pages/MyPage.jsx`
- Modify: `src/components/mypage/FriendsPreview.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `useFriends()` entry의 `avatarUrl` (Task 5).
- Produces: `onSelectFriend` 콜백 인자가 `{ userId, nickname, avatarUrl }` 로 확장됨.

- [ ] **Step 1: FriendsPanel — 목록 아바타 + `onSelectFriend` 인자**

`src/components/mypage/FriendsPanel.jsx`:
- `onClick={() => onSelectFriend({ userId: f.userId, nickname: f.nickname })}` →
  `onClick={() => onSelectFriend({ userId: f.userId, nickname: f.nickname, avatarUrl: f.avatarUrl })}`
- 아바타 span:
```jsx
                  <span className="friend-avatar" aria-hidden="true">
                    {f.avatarUrl ? <img src={f.avatarUrl} alt="" /> : (f.nickname?.[0] || '?')}
                  </span>
```

- [ ] **Step 2: MyPage — friend 상세 헤더 아바타**

`src/pages/MyPage.jsx`:
- `const [friend, setFriend] = useState(null) // { userId, nickname } | null` 주석을 `// { userId, nickname, avatarUrl } | null` 로.
- friendDetail 패널 헤더에서 `<h3>{friend.nickname}님의 마이페이지</h3>` 앞에 추가:
```jsx
          <span className="friend-avatar friend-avatar-sm" aria-hidden="true">
            {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" /> : (friend.nickname?.[0] || '?')}
          </span>
```

- [ ] **Step 3: FriendsPreview — 칩 아바타**

`src/components/mypage/FriendsPreview.jsx` 의 칩 렌더:
```jsx
            {friends.slice(0, 4).map((f) => (
              <span key={f.id} className="mypage-preview-friend-chip">
                {f.avatarUrl && <img src={f.avatarUrl} alt="" />}
                {f.nickname}
              </span>
            ))}
```

- [ ] **Step 4: CSS — 칩 재구성 + 소형 사이즈**

`src/styles.css`:
- `.mypage-preview-friend-chip{ ... }` 규칙에 `display:inline-flex; align-items:center; gap:6px;` 추가(기존 배경/패딩/폰트 속성은 유지).
- 그 다음 줄에 추가:
```css
.mypage-preview-friend-chip img{ width:18px; height:18px; border-radius:50%; object-fit:cover; }
.friend-avatar-sm{ width:28px; height:28px; font-size:.78rem; }
```
(`.friend-avatar img` 채움 규칙은 Task 6에서 이미 추가됨 — `.friend-avatar-sm`도 `friend-avatar` 클래스를 함께 가지므로 적용된다.)

- [ ] **Step 5: Build + regression tests**

Run: `npm run build && npm test`
Expected: 빌드 성공, 기존 테스트 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/mypage/FriendsPanel.jsx src/pages/MyPage.jsx src/components/mypage/FriendsPreview.jsx src/styles.css
git commit -m "feat: 친구 목록/상세/미리보기 아바타 표시 (이슈 #50)"
```

---

## Task 9: 통합 검증 (자동 + 수동 체크리스트)

**Files:** 없음 (검증만).

- [ ] **Step 1: 자동 검증**

Run: `npm test && npm run build`
Expected: 전체 테스트 PASS(신규 `avatarUrl.test.js` 포함), 빌드 성공.

- [ ] **Step 2: Supabase 스키마 반영 (사용자 작업)**

사용자에게 안내: Supabase 대시보드 → SQL Editor 에서 `supabase/schema.sql` 전체를 재실행(또는 최소한 `#50` 섹션). Storage → `avatars` 버킷이 public, `image/jpeg`만, 1 MiB 제한으로 생성됐는지 확인.

- [ ] **Step 3: 브라우저 수동 체크 (`npm run dev`)**

- [ ] 본인 사진 업로드 → 즉시 반영, 새로고침 후에도 유지
- [ ] 사진 교체 → `?v=` 캐시버스터로 새 이미지 즉시 표시(옛 이미지 안 남음)
- [ ] 사진 제거 → 이니셜 복귀, Storage 객체 삭제 확인
- [ ] 편집 중 사진만 바꾸고 "취소" → 아무 변화 없음(네트워크 호출 없음)
- [ ] 사진 + 닉네임 함께 "저장" → 둘 다 반영
- [ ] 닉네임 없는 계정에서 사진만 "저장" → 저장됨(빈 닉네임에 막히지 않음)
- [ ] `image/*` 아닌 파일 / 2MB 초과 → 인라인 에러, 업로드 시도 안 함
- [ ] 작은 이미지(예: 128×128) → 확대되지 않음 / 투명 PNG → 흰 배경 / 회전(EXIF) 사진 → 똑바로
- [ ] 친구가 내 아바타를 친구 목록·상세 헤더·홈 미리보기 칩에서 조회
- [ ] Storage 정책: 타인 경로(`{다른uid}/avatar.jpg`), 임의 파일명(`{내uid}/foo.png`), 비-JPEG, 1MiB 초과 업로드가 모두 거부되는지
- [ ] 미러 실패 시뮬레이션(`profiles` 쓰기 일시 차단) 후 "재시도" → 친구 화면 동기화 회복

- [ ] **Step 4: 최종 커밋 (필요 시)**

수동 검증 중 수정이 생기면 해당 태스크 커밋 컨벤션으로 커밋. 없으면 이 태스크는 커밋 없음.

---

## Self-Review

**1. Spec coverage**

| 스펙 항목 | 태스크 |
|---|---|
| §1.1 `avatar_url` 컬럼 | Task 3 |
| §1.2 update grant 확장 | Task 3 |
| §1.3 버킷 + storage 정책(정확 파일명, MIME/용량) | Task 3 |
| §2.1 `getAvatarUrl` resolver + 테스트 | Task 1 |
| §2.2 `resizeToSquareJpeg`(업스케일 금지/흰배경/EXIF/getContext/finally) | Task 2 |
| §3 `updateAvatar` / `removeAvatar`(제거 시 Storage 먼저) / `syncAvatarMirror` / `setUser` / `updateNickname` setUser | Task 4 |
| §4.1 편집 폼 임시상태·저장순서·취소·partial 재시도 | Task 7 |
| §4.2 useFriends `avatar_url` | Task 5 |
| §4.3 FriendsPanel 목록 아바타 | Task 8 |
| §4.4 MyPage friendDetail 헤더 아바타 + friend 객체 | Task 8 |
| §4.5 FriendsPreview 칩 아바타 | Task 8 |
| §5 CSS(`img` 채움, 칩 재구성, 소형, 편집 액션) | Task 6 + Task 7 + Task 8 |
| §7 테스트/검증 | Task 9 |
| §9 프라이버시(코드 변경 없음, schema 주석으로 반영) | Task 3 주석 |

갭 없음.

**2. Placeholder scan**

"TBD/TODO/적절히 처리" 등 없음. 코드 스텝은 모두 실제 코드 블록 포함.

**3. Type consistency**

- `getAvatarUrl(userOrProfile) => string | null` — Task 1 정의, Task 6/7에서 `getAvatarUrl(user)`로 사용. 일치.
- `resizeToSquareJpeg(file, maxSize=512) => Promise<Blob>` — Task 2 정의, Task 4에서 `resizeToSquareJpeg(file, 512)` 호출. 일치.
- `updateAvatar/removeAvatar` 반환 `{ data?, error?, partial?: 'mirror' }` — Task 4 정의, Task 7에서 `res?.error && res.partial !== 'mirror'` 로 소비. 일치.
- `syncAvatarMirror() => { error }` — Task 4 정의, Task 7 `retryMirror`에서 `const { error } = await syncAvatarMirror()`. 일치.
- useFriends entry `avatarUrl` — Task 5 정의, Task 8에서 `f.avatarUrl` / `friend.avatarUrl` 사용. 일치.
- `onSelectFriend({ userId, nickname, avatarUrl })` — Task 8 Step 1에서 확장, 같은 태스크 Step 2에서 소비. 일치.

이슈 없음.
