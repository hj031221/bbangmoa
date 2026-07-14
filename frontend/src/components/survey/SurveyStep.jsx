// 설문 한 문항 표시 + 선택지 버튼.
export default function SurveyStep({ question, selectedOptionId, onSelect }) {
  return (
    <div className="survey-step">
      <h2 className="survey-question">{question.question}</h2>
      <div className="survey-options">
        {question.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={
              'survey-option' + (selectedOptionId === opt.id ? ' selected' : '')
            }
            onClick={() => onSelect(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
