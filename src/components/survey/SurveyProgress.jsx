// 설문 진행 표시 (현재 단계 / 전체).
export default function SurveyProgress({ current, total }) {
  return (
    <div className="survey-progress">
      <div className="survey-progress-bar">
        <div
          className="survey-progress-fill"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
      <span className="survey-progress-text">
        {current + 1} / {total}
      </span>
    </div>
  )
}
