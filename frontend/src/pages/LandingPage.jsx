import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { SURVEY } from '../data/surveyConfig'
import SurveyFlow from '../components/survey/SurveyFlow'
import MapResult from '../components/map/MapResult'

// 랜딩 페이지 = 메뉴바 + 활성화된 기능 패널.
// '지도' 메뉴를 열면 취향 설문(미완료 시) → 지도결과 순으로 같은 페이지 안에서 전환된다.
// 다른 기능(오늘의 빵 루트, 나만의 빵 지도 등)은 이 메뉴 배열에 추가하면 된다.
const FEATURES = [{ id: 'map', label: '🗺️ 지도' }]

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(null)
  const [showSurvey, setShowSurvey] = useState(false)
  const answers = useAppStore((s) => s.answers)
  const resetAnswers = useAppStore((s) => s.resetAnswers)

  const surveyDone = SURVEY.every((q) => answers[q.id])

  const openFeature = (id) => {
    setActiveFeature(id)
    if (id === 'map') setShowSurvey(!surveyDone)
  }

  const retakeSurvey = () => {
    resetAnswers()
    setShowSurvey(true)
  }

  return (
    <div className="page landing">
      <header className="landing-hero">
        <h1>🥐 빵모아</h1>
        <p>대전 빵집, 취향에 맞게 지도로 찾아보세요.</p>
      </header>

      <nav className="feature-menu">
        {FEATURES.map((f) => (
          <button
            key={f.id}
            type="button"
            className={'feature-menu-item' + (activeFeature === f.id ? ' active' : '')}
            onClick={() => openFeature(f.id)}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {activeFeature === 'map' &&
        (showSurvey ? (
          <SurveyFlow onComplete={() => setShowSurvey(false)} />
        ) : (
          <MapResult onRetake={retakeSurvey} />
        ))}
    </div>
  )
}
