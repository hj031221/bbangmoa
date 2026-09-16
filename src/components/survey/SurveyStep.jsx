import SurveyOptionArt from './SurveyOptionArt'

// 설문 한 문항 표시 + 선택지 버튼.
export default function SurveyStep({ question, selectedOptionId, onSelect, kind = 'bread' }) {
  return (
    <div className="survey-step">
      <h2 className="survey-question">{question.question}</h2>
      <div className="survey-options">
        {question.options.map((opt, optionIndex) => (
          <button
            key={opt.id}
            type="button"
            className={
              'survey-option' + (selectedOptionId === opt.id ? ' selected' : '')
            }
            onClick={() => onSelect(opt.id)}
            aria-pressed={selectedOptionId === opt.id}
          >
            <SurveyOptionArt kind={kind} questionId={question.id} optionIndex={optionIndex} />
            <span className="survey-option-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
