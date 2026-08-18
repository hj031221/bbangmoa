import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { Q0, Q1, BRANCHES } from '../../data/tourSurveyConfig'
import { resolveBranch } from '../../lib/tourRecommend'
import SurveyStep from '../survey/SurveyStep'
import SurveyProgress from '../survey/SurveyProgress'

// 관광모아 설문: Q0(행정구, 점수 미반영 필터) → Q1(동행자→Branch A~E) → 해당 Branch의 Q2~Q5.
// 응답은 전역 store의 tourAnswers 에 저장한다 — 빵모아 answers 와는 별개 네임스페이스라
// 질문 id(q0~q5)가 겹쳐도 서로 덮어쓰지 않는다.
// Q0/Q1 모두 SurveyStep이 그대로 렌더링할 수 있는 {question, options:[{id,label}]} 모양이라
// 별도 스텝 컴포넌트 없이 통일된 흐름으로 처리한다.
const TOTAL_STEPS = 6 // Q0, Q1, Q2, Q3, Q4, Q5

export default function TourSurveyFlow({ onComplete, onSkip }) {
  const answers = useAppStore((s) => s.tourAnswers)
  const setTourAnswer = useAppStore((s) => s.setTourAnswer)
  const [step, setStep] = useState(0)

  const branch = resolveBranch(answers)
  const question = step === 0 ? Q0 : step === 1 ? Q1 : BRANCHES[branch]?.questions[step - 2]
  const isLast = step === TOTAL_STEPS - 1

  const choose = (optionId) => {
    const next = { ...answers, [question.id]: optionId }
    setTourAnswer(question.id, optionId)
    if (isLast) onComplete(next)
    else setStep((s) => s + 1)
  }

  return (
    <div className="survey">
      <SurveyProgress current={step} total={TOTAL_STEPS} />
      <SurveyStep question={question} selectedOptionId={answers[question.id]} onSelect={choose} />
      <div className="survey-nav">
        {step > 0 && (
          <button className="ghost-btn" onClick={() => setStep((s) => s - 1)}>
            ← 이전
          </button>
        )}
        <button className="ghost-btn" onClick={onSkip}>
          관광지 모두 보기 →
        </button>
      </div>
    </div>
  )
}
