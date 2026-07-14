import { useState } from 'react'
import { SURVEY } from '../../data/surveyConfig'
import { useAppStore } from '../../store/useAppStore'
import SurveyStep from './SurveyStep'
import SurveyProgress from './SurveyProgress'

// 취향 설문 다단계 흐름. 마지막 문항 응답 직후(또는 건너뛰기) onComplete 호출.
export default function SurveyFlow({ onComplete }) {
  const answers = useAppStore((s) => s.answers)
  const setAnswer = useAppStore((s) => s.setAnswer)
  const [step, setStep] = useState(0)

  const question = SURVEY[step]
  const isLast = step === SURVEY.length - 1

  const choose = (optionId) => {
    setAnswer(question.id, optionId)
    if (isLast) onComplete()
    else setStep((s) => s + 1)
  }

  return (
    <div className="survey">
      <SurveyProgress current={step} total={SURVEY.length} />
      <SurveyStep
        question={question}
        selectedOptionId={answers[question.id]}
        onSelect={choose}
      />
      <div className="survey-nav">
        {step > 0 && (
          <button className="ghost-btn" onClick={() => setStep((s) => s - 1)}>
            ← 이전
          </button>
        )}
        <button className="ghost-btn" onClick={onComplete}>
          건너뛰고 결과 보기 →
        </button>
      </div>
    </div>
  )
}
