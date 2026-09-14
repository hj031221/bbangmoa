// 이슈 #80 B-1: 뒤로가기 한 번에 사이트 이탈 — 메뉴 전환(navigateToView)만 history에 쌓이고
// 화면 "안"의 하위 전환(설문 완료→리빌, 리빌→지도, 관광 허브↔상세 등)은 로컬 state만 바뀌어
// 히스토리에 안 남았다. 그래서 그 전환들을 거친 뒤 뒤로가기를 누르면 그 전체를 한 번에
// 건너뛰고 진입 이전(홈, 심하면 사이트 밖)까지 튀었다. 1안(전환 지점마다 pushState 추가)만
// 적용 — React Router 재설계(2안)는 백로그. 순수 함수로 분리해 LandingPage 없이도 테스트한다.

// 히스토리 항목이 추적하는 화면 상태 튜플과 그 기본값.
//   stage / tourStage : 빵·관광 플로우의 단계
//   tourSelectedId / tourHubFromReveal : 관광 허브 진입 맥락
//   directBreadId : 빵 종류 바로가기(이슈 #73 B1)로 고정된 빵
//     — 최종 리뷰 2+3: 이게 튜플에 없어서, 칩으로 빵을 고른 뒤 뒤로가기로 설문까지 돌아가도
//       스토어의 directBreadId 가 그대로 남아 새로 답한 설문 결과 대신 옛 칩 빵이 계속 떴다.
//       뒤로가기로 "칩을 고르기 전" 지점에 돌아가면 이 값도 같이 되돌아가야 한다.
export const HISTORY_STATE_DEFAULTS = Object.freeze({
  stage: 'survey',
  tourStage: 'survey',
  tourSelectedId: null,
  tourHubFromReveal: false,
  directBreadId: null,
})

// 브라우저 히스토리에 넣을 state 객체 조립: 현재 상태에 이번 전환에서 바뀐 필드(patch)만 덮어쓴다.
// 기본값을 바닥에 깔아 current 가 일부 필드를 빠뜨려도 항상 완전한 튜플이 나온다.
export function buildHistoryState(current, patch) {
  return { ...HISTORY_STATE_DEFAULTS, ...current, ...patch }
}

// popstate로 돌아왔을 때 state 복원. event.state가 없으면(주소창 직접 진입, 이 기능 배포 전
// 히스토리 항목 등) fallback(현재 렌더링 중인 값)을 그대로 쓴다. 일부 필드만 있는
// state더라도 나머지는 fallback → 기본값 순으로 채워 항상 완전한 객체를 반환한다.
export function restoreHistoryState(eventState, fallback) {
  return { ...HISTORY_STATE_DEFAULTS, ...fallback, ...(eventState || {}) }
}
