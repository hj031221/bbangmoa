# [CP8 보고서] 마이페이지 친구코드 기능

**날짜:** 2026-08-21
**관련 이슈:** #24 ([FE] 마이페이지 친구목록 — 친구코드 기반 기능 신규 구현)
**브랜치:** `feature-friends`
**상태:** 🟢 구현 + 태스크별 코드리뷰 + 전체 브랜치 최종 리뷰 완료, **PR 생성 전 아래 "머지 전 필수 작업" 확인 필요**

## 요약

친구코드 발급 → 코드/초대 링크로 상호 수락 방식 친구 추가 → 친구의 찜한 빵/코스/기록장을 기존 UI 그대로 읽기 전용으로 열람하는 흐름을 구현했다. superpowers:brainstorming(architectural 경로) → 스펙 문서 → superpowers:writing-plans(12개 태스크 계획) → superpowers:subagent-driven-development로 태스크별 구현+코드리뷰+수정 루프, 마지막에 전체 브랜치 최종 리뷰(opus)까지 거쳤다.

## 데이터 모델 (Supabase)

- `profiles(user_id, nickname, friend_code)` — 신규. 닉네임이 `auth.users.user_metadata`에만 있어 다른 사용자가 조회할 수 없는 문제를 해결하기 위한 공개 미러 테이블. 8자리 랜덤 친구코드(0/O/1/I 등 헷갈리는 문자 제외)를 신규 가입자는 트리거로 자동 발급, 기존 가입자는 스키마 적용 시 1회 백필.
- `friend_requests(id, requester_id, addressee_id, status, created_at)` — 신규. 상호 수락 상태 머신(pending → accepted). 삭제 하나로 취소/거절/친구 끊기를 전부 처리.
- `saved_bakeries`/`saved_courses`/`diary_entries`의 기존 "본인만 조회" select 정책을 `is_friends_with()` 헬퍼로 "본인 또는 수락된 친구"로 확장. insert/update/delete는 손대지 않음 — 친구는 열람만 가능.
- `find_user_by_friend_code(code)` RPC — 코드로 상대를 찾을 때만 쓰는 security definer 함수.

## 프론트엔드

- `useFriends.js` 신규 — 친구 요청/수락/목록/에러 상태 관리.
- 기존 `useSavedBakeries`/`useSavedCourses`/`useDiaryEntries`에 `targetUserId` 옵션 추가 — 같은 훅으로 본인/친구 데이터를 모두 조회.
- `SavedBakeriesPanel`/`SavedCoursesPanel`/`DiaryPanel`에 `readOnly` prop 추가 — 편집/삭제 버튼만 숨기고 나머지 UI를 그대로 재사용(이슈에서 요구한 "본인 것과 동일한 UI를 읽기 전용으로 재사용" 그대로 구현).
- `FriendsPanel.jsx`(코드 입력/요청함/친구 목록), `FriendsPreview.jsx`(홈 미리보기), `ProfileCard`(코드/초대 링크 복사), `MyPage.jsx`(친구 상세 라우팅) 신규/수정.
- 초대 링크(`?friend=코드`): 라우터가 없는 SPA라 `useInviteLink.js`가 앱 마운트 시 쿼리 파라미터를 확인 — 로그인 상태면 확인 모달, 비로그인 상태면 `sessionStorage`에 임시 저장 후 로그인 완료 시 이어서 처리.

## 코드리뷰 과정에서 발견/수정한 것

- **Task 5** (useFriends 훅): `acceptRequest`/`removeRequest`가 에러를 콘솔에만 남기고 화면에 노출하지 않던 것 → 화면 에러는 반드시 인라인으로 보여준다는 이번 스펙의 원칙과 충돌해 수정(컨트롤러 룰링).
- **Task 6** (ProfileCard): 복사 버튼 두 개를 빠르게 연달아 누르면 타이머가 겹쳐서 "복사됨!" 피드백이 씹히는 버그, 클립보드 API 실패 무처리 → 수정.
- **최종 전체 브랜치 리뷰(가장 중요)**: `friend_requests` 수락 정책의 `WITH CHECK`가 `status`만 검증하고 `requester_id`/`addressee_id`는 검증하지 않아, **주소를 아는(친구코드로 알아낸) 상대라면 동의 없이도 자신을 그 사람의 "수락된 친구"로 위조할 수 있는 심각한 보안 허점**을 발견했다. RLS `WITH CHECK` 보강 + 컬럼 단위 `GRANT`로 이중 방어하도록 수정하고, 재검토에서 이 수정이 실제로 구멍을 막는지(권한 체크가 RLS보다 먼저 평가된다는 점까지) 별도로 검증했다. 같은 리뷰에서 `profiles` 자기 자신 수정 정책의 `WITH CHECK` 누락, `find_user_by_friend_code` RPC가 비로그인 사용자에게도 열려있던 문제도 함께 잡아 수정했다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `supabase/schema.sql` | `profiles`/`friend_requests` 테이블, 트리거, RLS, RPC, 최종 리뷰 반영 보안 강화 섹션 |
| `src/hooks/useFriends.js` *(신규)* | 친구 요청/수락/목록/에러 |
| `src/hooks/useInviteLink.js` *(신규)* | 초대 링크 진입 처리 |
| `src/hooks/useAuth.js` | 닉네임 변경 시 profiles 동기화 |
| `src/hooks/useSavedBakeries.js`, `useSavedCourses.js`, `useDiaryEntries.js` | `targetUserId` 옵션 |
| `src/lib/friendCode.js`, `inviteLink.js` *(신규)* | 순수 유틸 (단위 테스트 포함) |
| `src/components/mypage/FriendsPanel.jsx`, `InviteFriendModal.jsx` *(신규)* | 친구 목록 화면, 초대 확인 모달 |
| `src/components/mypage/ProfileCard.jsx`, `FriendsPreview.jsx` | 친구코드/링크 UI, 실제 미리보기 |
| `src/components/mypage/SavedBakeriesPanel.jsx`, `SavedCoursesPanel.jsx`, `DiaryPanel.jsx` | `readOnly`/`targetUserId` prop |
| `src/pages/MyPage.jsx`, `LandingPage.jsx` | 친구 상세 라우팅, 초대 링크 훅 연결 |
| `src/styles.css` | 친구 관련 전체 스타일 |

## 테스트 및 검증

- `npm test` 60/60 통과(기존 49 + 신규 순수 유틸 11), `npm run build` 정상 — 전 태스크 공통.
- 태스크 11개 각각 개별 코드리뷰(3건은 1회 수정 루프 거쳐 클린), 전체 브랜치 최종 리뷰(opus) 1회 + fix wave 1회 + 재검토 1회로 마무리.
- **미완료**: DB RLS/트리거/RPC의 실동작과 친구 요청→수락→읽기 전용 열람 전체 플로우, 초대 링크 로그인/비로그인 분기는 두 계정(브라우저 창 2개)으로 사람이 직접 확인해야 하는 영역 — 자동화 불가(이 프로젝트는 애초에 DB 레벨 자동테스트가 없음).

## 머지 전 필수 작업

1. **`supabase/schema.sql`을 Supabase SQL Editor에 다시 전체 붙여넣어 실행** — 이번에 추가된 보안 강화 섹션(파일 끝부분)이 실제 DB에 반영되지 않으면 위에서 설명한 친구관계 위조 취약점이 그대로 열려있는 상태다. 파일 전체가 멱등(idempotent)하게 작성돼 있어 처음부터 다시 실행해도 안전하다.
2. 두 계정(또는 브라우저 창 2개)으로 직접 확인:
   - A의 코드로 B가 요청 → A가 수락 → 서로 친구 목록에 뜨는지
   - B가 A의 찜한 빵/코스/기록장을 읽기 전용으로 볼 수 있는지(편집/삭제 버튼 없어야 함)
   - A의 초대 링크를 비로그인 상태에서 열었을 때 안내 → 로그인 → 자동으로 확인 모달이 뜨는지
   - **보안 수정 확인**: B 계정에서 `friend_requests`의 자기 pending 행의 `requester_id`를 다른 사람 것으로 바꿔서 update 시도 → 거부되는지 (컬럼 단위 GRANT로 막혀야 함)

## 후속 이슈로 남긴 것 (최종 리뷰에서 발견, 이번 범위 제외 확정)

- `LandingPage`/`ProfileCard`/`FriendsPreview`가 각자 독립적으로 `useFriends()`를 호출해 마이페이지 홈 방문 시 친구 데이터 조회가 3중으로 중복 실행됨 — 실사용자 규모에서는 감내 가능한 수준으로 판단해 이번엔 손대지 않음. `sendRequestByCode`를 목록 로딩 훅에서 분리하는 리팩터가 필요.
- SQL 함수 4개에 `search_path` 미고정(Supabase 린터 권고 수준), 친구 요청 존재 여부 조회의 `.maybeSingle()`이 드문 레이스 상황에서 에러 가능, 코드 조회 RPC 호출 로직이 `useFriends.js`/`useInviteLink.js`에 중복(에러 처리 방식도 다름), `useFriends.reload`의 요청 분류 로직(순수 함수로 뽑아낼 수 있었음, 스펙에 테스트 범위 누락)을 후속 이슈로 남김.
- 친구 상세 조회(#22가 만들어둔 자리를 이번 이슈가 채움)까지 완료 — 다음은 #23(모바일 반응형 정리)만 남음.

## 다음 단계

1. 사용자가 위 "머지 전 필수 작업" 확인.
2. 확인 완료 후 push + PR(`Closes #24`), 코드리뷰 → 본인이 merge.
