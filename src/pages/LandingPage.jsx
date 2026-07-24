import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { SURVEY } from '../data/surveyConfig'
import SurveyFlow from '../components/survey/SurveyFlow'
import BreadReveal from '../components/result/BreadReveal'
import MapResult from '../components/map/MapResult'
import SavedListPage from './SavedListPage'
import AuthMenu from '../components/auth/AuthMenu'
import Hero from '../components/landing/Hero'
import ProblemSection from '../components/landing/ProblemSection'
import FeaturesSection from '../components/landing/FeaturesSection'
import HowItWorksSection from '../components/landing/HowItWorksSection'
import DifferenceSection from '../components/landing/DifferenceSection'
import FinalCta from '../components/landing/FinalCta'
import logo from '../assets/logo-typeA-full.png'

// 랜딩 = 마케팅 사이트. "취향 테스트 시작" 계열 버튼을 누르면
// 같은 페이지 안에서 설문(SurveyFlow) → 오늘의 빵 리빌(BreadReveal) → 지도 결과(MapResult) 로 전환된다.
export default function LandingPage() {
  const [featureOpen, setFeatureOpen] = useState(false)
  const [stage, setStage] = useState('survey') // 'survey' | 'reveal' | 'map'
  const [showSaved, setShowSaved] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const answers = useAppStore((s) => s.answers)
  const district = useAppStore((s) => s.district)
  const resetAnswers = useAppStore((s) => s.resetAnswers)

  const surveyDone = !!district && SURVEY.every((q) => answers[q.id])

  const startTest = () => {
    setFeatureOpen(true)
    setShowSaved(false)
    setStage(surveyDone ? 'reveal' : 'survey')
  }
  const openSaved = () => {
    setShowSaved(true)
    setFeatureOpen(false)
    setNavOpen(false)
  }
  const goHome = () => {
    setFeatureOpen(false)
    setShowSaved(false)
  }
  const retakeSurvey = () => {
    resetAnswers()
    setStage('survey')
  }

  if (showSaved) {
    return (
      <div className="page">
        <div className="page-topbar">
          <button className="ghost-btn bm-back" onClick={goHome}>
            ← 처음으로
          </button>
          <AuthMenu compact />
        </div>
        <SavedListPage />
      </div>
    )
  }

  if (featureOpen) {
    return (
      <div className="page">
        <div className="page-topbar">
          <button className="ghost-btn bm-back" onClick={goHome}>
            ← 처음으로
          </button>
          <AuthMenu compact />
        </div>
        {stage === 'survey' && <SurveyFlow onComplete={() => setStage('reveal')} />}
        {stage === 'reveal' && (
          <BreadReveal onRetake={retakeSurvey} onShowMap={() => setStage('map')} />
        )}
        {stage === 'map' && <MapResult onRetake={retakeSurvey} />}
      </div>
    )
  }

  return (
    <div className="bm-landing">
      <nav className="bm-nav">
        <div className="bm-nav-inner">
          <a href="#bm-hero" className="bm-logo">
            <img src={logo} alt="빵모아 로고" />
            <span>빵모아</span>
          </a>
          <div className="bm-nav-links">
            <a href="#bm-problem">왜 빵모아</a>
            <a href="#bm-how">하는 일</a>
            <button type="button" onClick={openSaved}>
              나만의 리스트
            </button>
          </div>
          <button className="bm-nav-cta" onClick={startTest}>
            취향 테스트 시작
          </button>
          <div className="bm-nav-auth">
            <AuthMenu />
          </div>
          <button
            type="button"
            className="bm-nav-toggle"
            aria-label="메뉴 열기"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          {navOpen && (
            <div className="bm-nav-mobile-menu">
              <button
                type="button"
                onClick={() => {
                  startTest()
                  setNavOpen(false)
                }}
              >
                취향 테스트 시작
              </button>
              <button
                type="button"
                onClick={() => {
                  openSaved()
                  setNavOpen(false)
                }}
              >
                나만의 리스트
              </button>
              <AuthMenu compact />
            </div>
          )}
        </div>
      </nav>

      {/* 1) Hero */}
      <Hero onStart={startTest} />
      {/* 2) 문제 제기 */}
      <ProblemSection />
      {/* 3) 빵모아가 하는 일 */}
      <FeaturesSection />
      {/* 4) 취향 추천은 이렇게 */}
      <HowItWorksSection />
      {/* 5) 무엇이 다른가 */}
      <DifferenceSection />
      {/* 6) 지금 시작하기 */}
      <FinalCta onStart={startTest} />

      <div className="bm-footer">
        <img src={logo} alt="빵모아 로고" />
        <span>빵모아</span>
        <span className="bm-footer-credit">· 『2026 관광데이터 활용 공모전』 출품작</span>
      </div>
    </div>
  )
}
