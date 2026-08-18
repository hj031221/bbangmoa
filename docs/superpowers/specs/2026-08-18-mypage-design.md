# 마이페이지 신설 — 설계 문서

이슈: #20 · 브랜치: `feature-mypage`

## 배경

메뉴바의 "나만의 리스트"는 찜한 빵집만 보여준다. 시안(`대전 웹사이트 4.pdf`, page 11~15)에는 프로필 카드 + 찜한 빵/찜한 코스/기록장을 한 곳에서 보는 "마이페이지"로 확장되어 있다. 친구목록은 시안에 없지만, 사용자가 오늘 TO-DO로 요청한 항목이라 탭 자리만 마련해둔다.

## 목표

- NavBar의 "나만의 리스트"를 "마이페이지"로 교체
- 찜한 빵 / 찜한 코스 / 기록장(빵집 연결) 을 마이페이지 안에서 리스트↔상세로 볼 수 있게 함
- 닉네임 변경(프로필 편집) 지원
- 친구목록은 자리만(비활성 placeholder)

## 범위 제외

- 친구 시스템 실제 로직(카톡 연동, 친구코드 발급/수락) — 별도 이슈
- 기록장 사진 첨부 (Supabase Storage 버킷 필요) — 별도 이슈
- react-router 등 라우팅 라이브러리 도입 — 기존 state 기반 페이지 전환 패턴 유지

## 아키텍처

### 페이지 전환 패턴

기존 `LandingPage.jsx`는 `showSaved`, `showMap`, `showTour` 같은 boolean state로 최상위 화면을 스위칭하고, `SavedListPage`/`PilgrimagePage`는 각자 내부에서 로컬 state로 하위 화면을 전환한다. 이 프로젝트는 새 라우팅 라이브러리를 도입하지 않고 같은 패턴을 확장한다.

- `LandingPage.jsx`: `showSaved`/`openSaved` → `showMyPage`/`openMyPage`로 이름 변경, `<SavedListPage />` → `<MyPage />`로 교체
- `NavBar.jsx`: "나만의 리스트" 버튼 라벨 → "마이페이지" (데스크톱/모바일 메뉴 둘 다)
- `MyPage.jsx` (신규): 내부 state `panel: 'home' | 'bakeries' | 'courses' | 'diary'`로 리스트/상세 전환. `SavedListPage.jsx`는 `MyPage.jsx`의 찜한 빵 패널로 흡수되고 별도 파일로는 더 이상 라우팅되지 않는다 (컴포넌트 자체는 재사용 가능하면 재사용, 아니면 삭제).

### 프로필 카드 & 닉네임

- `useAuth.js`에 `updateNickname(nickname)` 추가: `supabase.auth.updateUser({ data: { nickname } })`
- 표시 이름 우선순위를 `nickname > full_name > name > email`로 통일하는 헬퍼(예: `getDisplayName(user)`)를 만들어 `AuthMenu.jsx`와 `MyPage.jsx` 양쪽에서 사용
- 아바타는 이번 범위에서 고정 placeholder(이니셜 또는 아이콘), 이미지 업로드는 제외

### 찜한 빵 목록 패널

- `useSavedBakeries` 훅 그대로 재사용 (변경 없음)
- 시안(page 11/12)처럼 카드 그리드로 렌더링, 클릭 시 상세 없이 바로 찜 해제 메뉴만 필요하면 기존 `toggleSave` 재사용
- 신규 DB 작업 없음

### 찜한 코스 목록 패널

- `saved_courses` 테이블에서 `user_id`로 조회하는 신규 훅 `useSavedCourses` 추가 (select만, `useSavedBakeries`와 유사한 형태지만 로그인 필수 — 비로그인 시 빈 배열)
- 리스트: 각 row를 저장 시각 또는 `stops.length`로 라벨링해서 표시 (테이블에 개별 코스명이 없으므로 "대전한바퀴 코스 (8/18 저장)" 같은 형식)
- 상세: 시안(page 13)처럼 지도 + stops 순서 표시. 기존 `PilgrimagePage`의 지도 렌더링 로직(`useKakaoLoader`, 마커/경로 그리기)을 재사용 가능한 형태로 뽑아 쓰거나, 최소 버전으로 마커만 찍는 간단한 지도로 시작
- 삭제 기능은 이번 범위에 포함(RLS의 delete own 정책은 이미 있음)

### 기록장 패널 (빵집 연결)

- 신규 테이블 `diary_entries`:
  ```sql
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
  ```
  (`saved_bakeries`와 동일한 RLS 패턴. `bakery` jsonb는 작성 시점의 빵집 스냅샷 — 이름/주소가 바뀌어도 기록은 그대로 보이게.)
- `RecommendCard.jsx`(빵집 상세 카드, `찜하기` 버튼 옆)에 "기록 남기기" 버튼 추가 → 텍스트 입력 모달(신규 `DiaryEntryModal.jsx` 또는 인라인) → insert
- 마이페이지 기록장 패널: 리스트(시안 page 14, 카드형) + 상세(시안 page 15, "수정하기"로 text update)
- 비로그인 상태에서는 "기록 남기기" 버튼을 숨기거나 로그인 유도 (다른 로그인 전용 기능과 동일하게 처리)

### 친구목록 패널

- `MyPage.jsx`의 4번째 패널 카드로 추가, 클릭 시 "친구 기능은 준비 중이에요" 빈 상태만 표시
- DB 테이블, 초대 로직 없음

## 데이터 흐름 요약

```
RecommendCard (빵집 상세) --[기록 남기기]--> diary_entries insert
MyPage
 ├─ 찜한 빵 패널   ← useSavedBakeries (기존, 변경 없음)
 ├─ 찜한 코스 패널 ← useSavedCourses (신규, saved_courses select)
 ├─ 기록장 패널    ← useDiaryEntries (신규, diary_entries select/update/delete)
 └─ 친구목록 패널  ← (없음, 정적 placeholder)
```

## 에러 처리

- 모든 신규 Supabase 호출은 기존 `useSavedBakeries`/`PilgrimagePage.handleSave` 패턴을 따라 `error` 발생 시 `console.error`로 로깅 + 화면에 최소한의 실패 메시지(재시도 유도) 표시. 별도의 전역 에러 바운더리는 추가하지 않는다.
- 비로그인 상태로 마이페이지 진입 시: 기존 로그인 유도 패턴(`AuthMenu` 로그인 모달)을 그대로 활용해 로그인 안내 문구 표시.

## 테스트 방법

- 로그인 상태에서 찜한 빵 추가 → 마이페이지에서 확인
- 대전한바퀴 코스 저장 → 마이페이지 "찜한 코스 목록"에 표시되는지, 상세에서 지도/순서가 맞는지
- 빵집 상세 카드에서 "기록 남기기" → 텍스트 작성 → 마이페이지 기록장에 표시 → 상세에서 "수정하기"로 텍스트 변경 확인
- 닉네임 변경 → AuthMenu와 마이페이지 프로필 카드 양쪽에 반영되는지
- 친구목록 탭 클릭 시 placeholder 노출 확인
- 비로그인 상태에서 마이페이지 진입 시 로그인 유도 확인
- 모바일 너비에서 4개 패널 레이아웃 확인
