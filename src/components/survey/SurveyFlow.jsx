import { useState } from 'react'
import { SURVEY } from '../../data/surveyConfig'
import { useAppStore } from '../../store/useAppStore'
import LocationStep from './LocationStep'
import SurveyStep from './SurveyStep'
import SurveyProgress from './SurveyProgress'

const TOTAL_STEPS = SURVEY.length + 1 // 0번째: 출발 위치 선택, 이후: 취향 질문

// 취향 설문 다단계 흐름. 0번째 스텝은 출발 위치 선택(LocationStep), 이후 SURVEY 문항이 이어진다.
// 마지막 문항 응답 직후(또는 건너뛰기) onComplete 호출.
export default function SurveyFlow({ onComplete }) {
  const answers = useAppStore((s) => s.answers)
  const setAnswer = useAppStore((s) => s.setAnswer)
  const [step, setStep] = useState(0)

  const isLocationStep = step === 0
  const question = isLocationStep ? null : SURVEY[step - 1]
  const isLast = step === TOTAL_STEPS - 1

  const advance = () => {
    if (isLast) onComplete()
    else setStep((s) => s + 1)
  }
  const choose = (optionId) => {
    setAnswer(question.id, optionId)
    advance()
  }

  return (
    <div className="survey">
      <SurveyProgress current={step} total={TOTAL_STEPS} />
      {isLocationStep ? (
        <LocationStep onDone={advance} />
      ) : (
        <SurveyStep question={question} selectedOptionId={answers[question.id]} onSelect={choose} />
      )}
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
