import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export default function LandingPage() {
  const navigate = useNavigate()
  const resetAnswers = useAppStore((s) => s.resetAnswers)

  const start = () => {
    resetAnswers()
    navigate('/survey')
  }

  return (
    <div className="page landing">
      <h1>🥐 대전 빵집 지도</h1>
      <p>간단한 취향 설문으로 나에게 맞는 대전 빵집을 지도에서 찾아보세요.</p>
      <button className="primary-btn" onClick={start}>
        시작하기
      </button>
      <p className="hint">한국관광공사 OpenAPI + 카카오맵 기반</p>
    </div>
  )
}
