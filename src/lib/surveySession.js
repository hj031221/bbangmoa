// 새로고침·당일 탐색은 이어가되, 오래된 취향/출발지는 다음 방문에 자동 적용하지 않는다.
export const SURVEY_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function isSurveySessionFresh(startedAt, now = Date.now()) {
  return Number.isFinite(startedAt) && startedAt <= now
    && now - startedAt < SURVEY_SESSION_MAX_AGE_MS
}

export function emptySurveySession() {
  return {
    answers: {}, tourAnswers: {}, origin: null, district: null,
    selectedBakeryId: null, directBreadId: null, courseDraft: null,
    surveyStartedAt: null,
  }
}

export function restoreSurveySession(saved, now = Date.now()) {
  if (!isSurveySessionFresh(saved?.surveyStartedAt, now)) return emptySurveySession()
  return {
    answers: saved.answers ?? {}, tourAnswers: saved.tourAnswers ?? {},
    origin: saved.origin ?? null, district: saved.district ?? null,
    surveyStartedAt: saved.surveyStartedAt,
  }
}

// localStorage만 비우면 history.state가 과거 응답과 결과 화면을 다시 살릴 수 있다.
export function expireSurveyHistory(state, now = Date.now(), visitStartedAt = now) {
  const timestamp = state?.surveySnapshot?.surveyStartedAt
  // 이번 방문 시작 시 유효했던 응답은 사용 중 24시간을 넘어도 뒤로가기로 복원한다.
  if (!state || (Number.isFinite(timestamp) && timestamp <= now
    && visitStartedAt - timestamp < SURVEY_SESSION_MAX_AGE_MS)) return state
  return {
    ...state, surveySnapshot: null, stage: 'survey', breadStep: 0,
    tourStage: state.tourStage === 'hub' && !state.tourHubFromReveal ? 'hub' : 'survey',
    tourStep: 0, tourHubFromReveal: false, directBreadId: null,
  }
}
