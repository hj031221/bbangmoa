// 이슈 #80 B-1: 뒤로가기 한 번에 사이트 이탈 — 메뉴 전환(navigateToView)만 history에 쌓이고
// 화면 "안"의 하위 전환(설문 완료→리빌, 리빌→지도, 관광 허브↔상세 등)은 로컬 state만 바뀌어
// 히스토리에 안 남았다. 그래서 그 전환들을 거친 뒤 뒤로가기를 누르면 그 전체를 한 번에
// 건너뛰고 진입 이전(홈, 심하면 사이트 밖)까지 튀었다. 1안(전환 지점마다 pushState 추가)만
// 적용 — React Router 재설계(2안)는 백로그. 순수 함수로 분리해 LandingPage 없이도 테스트한다.

// 브라우저 히스토리에 넣을 state 객체 조립: 현재 상태에 이번 전환에서 바뀐 필드(patch)만 덮어쓴다.
export function buildHistoryState(current, patch) {
  return { ...current, ...patch }
}

// popstate로 돌아왔을 때 state 복원. event.state가 없으면(주소창 직접 진입, 이 기능 배포 전
// 히스토리 항목 등) fallback(현재 렌더링 중인 기본값)을 그대로 쓴다. 일부 필드만 있는
// state더라도 나머지는 fallback으로 채워 항상 완전한 객체를 반환한다.
export function restoreHistoryState(eventState, fallback) {
  return { ...fallback, ...(eventState || {}) }
}
