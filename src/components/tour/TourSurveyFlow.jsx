import { useState } from 'react'
import { Q1, BRANCHES } from '../../data/surveyConfig'
import { resolveBranch } from '../../lib/breadRecommend'
import LocationStep from '../survey/LocationStep'
import SurveyStep from '../survey/SurveyStep'
import SurveyProgress from '../survey/SurveyProgress'

// 관광모아 진입 설문. 빵집찾기의 SurveyFlow를 그대로 복사한 임시 버전 —
// 기획팀의 관광지 취향 로직이 오기 전까지는 빵집찾기와 동일한 질문을 그대로 쓰고,
// "관광지 모두 보기"(건너뛰기)와 설문 완료 모두 결과적으로 onComplete 하나로 연결한다.
// 취향 답변은 빵집찾기와 무관하므로 전역 스토어에 남기지 않고 로컬 상태로만 들고 있는다
// (전역 answers 를 공유하면 빵집찾기가 "설문 이미 완료함"으로 착각해 리빌 화면으로 건너뛰는 문제가 생김).
// 출발 위치(origin)는 두 기능이 같은 개념이라 LocationStep 을 통해 그대로 전역 스토어를 공유한다.
const TOTAL_STEPS = 6

export default function TourSurveyFlow({ onComplete }) {
  const [answers, setAnswers] = useState({})
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
    setAnswers((a) => ({ ...a, [question.id]: optionId }))
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
          관광지 모두 보기 →
        </button>
      </div>
    </div>
  )
}
