import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SURVEY } from '../data/surveyConfig'
import { useAppStore } from '../store/useAppStore'
import SurveyStep from '../components/survey/SurveyStep'
import SurveyProgress from '../components/survey/SurveyProgress'

export default function SurveyPage() {
  const navigate = useNavigate()
  const answers = useAppStore((s) => s.answers)
  const setAnswer = useAppStore((s) => s.setAnswer)
  const [step, setStep] = useState(0)

  const question = SURVEY[step]
  const isLast = step === SURVEY.length - 1
  const selected = answers[question.id]

  const choose = (optionId) => {
    setAnswer(question.id, optionId)
    // 선택 즉시 다음 단계로 (마지막이면 결과로)
    if (isLast) navigate('/result')
    else setStep((s) => s + 1)
  }

  return (
    <div className="page survey">
      <SurveyProgress current={step} total={SURVEY.length} />
      <SurveyStep
        question={question}
        selectedOptionId={selected}
        onSelect={choose}
      />
      <div className="survey-nav">
        {step > 0 && (
          <button className="ghost-btn" onClick={() => setStep((s) => s - 1)}>
            ← 이전
          </button>
        )}
        <button className="ghost-btn" onClick={() => navigate('/result')}>
          건너뛰고 결과 보기 →
        </button>
      </div>
    </div>
  )
}
