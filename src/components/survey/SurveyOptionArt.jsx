import { SURVEY_ILLUSTRATIONS } from '../../data/surveyIllustrations'
import { SURVEY_ILLUSTRATION_PATHS } from '../../data/surveyIllustrationPaths'

export default function SurveyOptionArt({ kind, questionId, optionIndex }) {
  const illustration = SURVEY_ILLUSTRATIONS[kind]?.[questionId]?.[optionIndex]
  const drawing = SURVEY_ILLUSTRATION_PATHS[illustration]
  if (!drawing) return null
  return (
    <span className="survey-option-art" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none" stroke="#C88742" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d={drawing[0]} fill="#F6C578" />
        {drawing[2] && <path d={drawing[2]} fill="#EDA18A" />}
        {drawing[1] && <path d={drawing[1]} />}
      </svg>
    </span>
  )
}
