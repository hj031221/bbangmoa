import { useState } from 'react'
import { Q1, BRANCHES } from '../../data/surveyConfig'
import { resolveBranch } from '../../lib/breadRecommend'
import { useAppStore } from '../../store/useAppStore'
import LocationStep from './LocationStep'
import SurveyStep from './SurveyStep'
import SurveyProgress from './SurveyProgress'

// 모든 branch(A~E)가 Q2~Q5 4문항으로 고정이라 총 스텝 수는 항상 동일하다:
// 0=위치 선택, 1=Q1(분기), 2~5=선택된 branch 의 Q2~Q5.
const TOTAL_STEPS = 6

// 취향 설문 다단계 흐름. 0번째 스텝은 출발 위치 선택(LocationStep), 1번째는 Q1(branch 분기),
// 이후 Q1 응답으로 정해진 branch 의 Q2~Q5 가 이어진다. 마지막 문항 응답 직후(또는 건너뛰기) onComplete 호출.
export default function SurveyFlow({ onComplete }) {
  const answers = useAppStore((s) => s.answers)
  const setAnswer = useAppStore((s) => s.setAnswer)
  const [step, setStep] = useState(0)

  const branch = resolveBranch(answers)
  const isLocationStep = step === 0
  const question = isLocationStep ? null : step === 1 ? Q1 : BRANCHES[branch]?.questions[step - 2]
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
