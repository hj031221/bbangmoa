import { useState } from 'react'
import { SURVEY } from '../../data/surveyConfig'
import { getRegion } from '../../config/regions'
import { useAppStore } from '../../store/useAppStore'
import SurveyStep from './SurveyStep'
import SurveyProgress from './SurveyProgress'

const TOTAL_STEPS = SURVEY.length + 1 // 0번째: 구 선택, 이후: 취향 질문

// 취향 설문 다단계 흐름. 0번째 스텝은 구 선택, 이후 SURVEY 문항이 이어진다.
// 마지막 문항 응답 직후(또는 건너뛰기) onComplete 호출.
export default function SurveyFlow({ onComplete }) {
  const answers = useAppStore((s) => s.answers)
  const setAnswer = useAppStore((s) => s.setAnswer)
  const district = useAppStore((s) => s.district)
  const setDistrict = useAppStore((s) => s.setDistrict)
  const regionId = useAppStore((s) => s.regionId)
  const [step, setStep] = useState(0)

  const districts = getRegion(regionId).districts
  const isDistrictStep = step === 0
  const question = isDistrictStep ? null : SURVEY[step - 1]
  const isLast = step === TOTAL_STEPS - 1

  const chooseDistrict = (d) => {
    setDistrict(d)
    if (isLast) onComplete()
    else setStep((s) => s + 1)
  }
  const choose = (optionId) => {
    setAnswer(question.id, optionId)
    if (isLast) onComplete()
    else setStep((s) => s + 1)
  }

  return (
    <div className="survey">
      <SurveyProgress current={step} total={TOTAL_STEPS} />
      {isDistrictStep ? (
        <div className="survey-step">
          <h2 className="survey-question">어떤 지역에서 빵집을 찾으시나요?</h2>
          <div className="survey-options">
            {districts.map((d) => (
              <button
                key={d}
                type="button"
                className={'survey-option' + (district === d ? ' selected' : '')}
                onClick={() => chooseDistrict(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
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
