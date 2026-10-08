// 새로고침·당일 탐색은 이어가되, 오래된 취향/출발지는 다음 방문에 자동 적용하지 않는다.
export const SURVEY_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function isSurveySessionFresh(startedAt, now = Date.now()) {
  return Number.isFinite(startedAt) && startedAt <= now
    && now - startedAt < SURVEY_SESSION_MAX_AGE_MS
}

export function emptySurveySession(now = Date.now()) {
  return {
    answers: {}, tourAnswers: {}, origin: null, district: null,
    selectedBakeryId: null, directBreadId: null, courseDraft: null,
    surveyStartedAt: now,
  }
}

export function restoreSurveySession(saved, now = Date.now()) {
  if (!isSurveySessionFresh(saved?.surveyStartedAt, now)) return emptySurveySession(now)
  return {
    answers: saved.answers ?? {}, tourAnswers: saved.tourAnswers ?? {},
    origin: saved.origin ?? null, district: saved.district ?? null,
    surveyStartedAt: saved.surveyStartedAt,
  }
}

// localStorage만 비우면 history.state가 과거 응답과 결과 화면을 다시 살릴 수 있다.
export function expireSurveyHistory(state, now = Date.now()) {
  if (!state || isSurveySessionFresh(state.surveySnapshot?.surveyStartedAt, now)) return state
  return {
    ...state, surveySnapshot: null, stage: 'survey', breadStep: 0,
    tourStage: state.tourStage === 'hub' && !state.tourHubFromReveal ? 'hub' : 'survey',
    tourStep: 0, tourHubFromReveal: false, directBreadId: null,
  }
}
