// 메뉴·결과 화면 전환, 설문 문항, 지도 필터·검색·선택을 같은 히스토리에 기록한다.
// 뒤로/앞으로가기는 이 상태를 복원하며 새로운 항목을 만들지 않는다.

// 히스토리 항목이 추적하는 화면 상태 튜플과 그 기본값.
//   stage / tourStage : 빵·관광 플로우의 단계
//   breadStep / tourStep : 각 설문의 문항 번호
//   browseMap / resultMap : 일반·추천 지도 상태 (서로 독립)
//   myPage : 마이페이지 패널·친구 선택 (지도 방문 후 직전 찜 목록으로 복귀)
//   surveySnapshot : 과거 문항의 분기와 결과를 복원할 응답·출발지
//   tourSelectedId / tourHubFromReveal : 관광 허브 진입 맥락
//   directBreadId : 빵 종류 바로가기(이슈 #73 B1)로 고정된 빵
//     — 최종 리뷰 2+3: 이게 튜플에 없어서, 칩으로 빵을 고른 뒤 뒤로가기로 설문까지 돌아가도
//       스토어의 directBreadId 가 그대로 남아 새로 답한 설문 결과 대신 옛 칩 빵이 계속 떴다.
//       뒤로가기로 "칩을 고르기 전" 지점에 돌아가면 이 값도 같이 되돌아가야 한다.
export const MAP_STATE_DEFAULTS = Object.freeze({ district: null, search: '', selectedId: null, origin: null })
export const MYPAGE_STATE_DEFAULTS = Object.freeze({ panel: 'home', friend: null })

export const HISTORY_STATE_DEFAULTS = Object.freeze({
  breadStep: 0,
  tourStep: 0,
  browseMap: MAP_STATE_DEFAULTS,
  resultMap: MAP_STATE_DEFAULTS,
  myPage: MYPAGE_STATE_DEFAULTS,
  surveySnapshot: null,
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
