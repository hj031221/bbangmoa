import { useState } from 'react'
import { Q0, Q1, BRANCHES } from '../../data/tourSurveyConfig'
import { resolveBranch } from '../../lib/tourRecommend'
import SurveyStep from '../survey/SurveyStep'
import SurveyProgress from '../survey/SurveyProgress'

// 관광모아 설문: Q0(행정구, 점수 미반영 필터) → Q1(동행자→Branch A~E) → 해당 Branch의 Q2~Q5.
// 답변은 빵집찾기와 무관하므로 로컬 state로만 들고 있는다 — 전역 answers 를 공유하면
// 빵집찾기가 "설문 이미 완료함"으로 착각해 리빌 화면으로 건너뛰는 문제가 생긴다.
// Q0/Q1 모두 SurveyStep이 그대로 렌더링할 수 있는 {question, options:[{id,label}]} 모양이라
// 별도 스텝 컴포넌트 없이 통일된 흐름으로 처리한다.
const TOTAL_STEPS = 6 // Q0, Q1, Q2, Q3, Q4, Q5

export default function TourSurveyFlow({ onComplete, onSkip }) {
  const [answers, setAnswers] = useState({})
  const [step, setStep] = useState(0)

  const branch = resolveBranch(answers)
  const question = step === 0 ? Q0 : step === 1 ? Q1 : BRANCHES[branch]?.questions[step - 2]
  const isLast = step === TOTAL_STEPS - 1

  const choose = (optionId) => {
    const next = { ...answers, [question.id]: optionId }
    setAnswers(next)
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
