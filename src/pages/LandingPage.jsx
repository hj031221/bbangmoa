import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { isSurveyComplete } from '../lib/breadRecommend'
import SurveyFlow from '../components/survey/SurveyFlow'
import BreadReveal from '../components/result/BreadReveal'
import MapResult from '../components/map/MapResult'
import SavedListPage from './SavedListPage'
import InfoPage from './InfoPage'
import NavBar from '../components/landing/NavBar'
import MainHero from '../components/landing/MainHero'
import PhotoShowcase from '../components/landing/PhotoShowcase'
import BakeryMapPage from '../components/map/BakeryMapPage'
import TourPage from '../components/tour/TourPage'
import TourSurveyFlow from '../components/tour/TourSurveyFlow'
import TourReveal from '../components/tour/TourReveal'
import PilgrimagePage from '../components/tour/PilgrimagePage'
import { resolveDistrict, isTourSurveyComplete } from '../lib/tourRecommend'
import logo from '../assets/logo-typeA-full.png'

// 랜딩 = 마케팅 사이트. 상단 메뉴바(NavBar)는 어떤 화면에서도 항상 떠 있고,
// 메뉴 클릭에 따라 그 아래 본문만 바뀐다. "취향 테스트 시작" 계열 버튼을 누르면
// 같은 페이지 안에서 설문(SurveyFlow) → 오늘의 빵 리빌(BreadReveal) → 지도 결과(MapResult) 로 전환된다.
export default function LandingPage() {
  const [featureOpen, setFeatureOpen] = useState(false)
  const [stage, setStage] = useState('survey') // 'survey' | 'reveal' | 'map'
  const [showSaved, setShowSaved] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [showPilgrimage, setShowPilgrimage] = useState(false)
  const [tourStage, setTourStage] = useState('survey') // 'survey' | 'reveal' | 'hub'
  const [tourSelectedId, setTourSelectedId] = useState(null) // hub 진입 시 바로 선택할 관광지
  const [nearbyOrigin, setNearbyOrigin] = useState(null) // 관광지 "근처 빵집 보기" 로 진입 시 { name, lat, lng }
  const answers = useAppStore((s) => s.answers)
  const origin = useAppStore((s) => s.origin)
  const resetAnswers = useAppStore((s) => s.resetAnswers)
  const tourAnswers = useAppStore((s) => s.tourAnswers)
  const resetTourAnswers = useAppStore((s) => s.resetTourAnswers)

  const surveyDone = !!origin && isSurveyComplete(answers)
  const tourSurveyDone = isTourSurveyComplete(tourAnswers)

  const startTest = () => {
    setFeatureOpen(true)
    setShowSaved(false)
    setShowInfo(false)
    setShowMap(false)
    setShowTour(false)
    setShowPilgrimage(false)
    setStage(surveyDone ? 'reveal' : 'survey')
  }
  const openSaved = () => {
    setShowSaved(true)
    setFeatureOpen(false)
    setShowInfo(false)
    setShowMap(false)
    setShowTour(false)
    setShowPilgrimage(false)
  }
  const openInfo = () => {
    setShowInfo(true)
    setFeatureOpen(false)
    setShowSaved(false)
    setShowMap(false)
    setShowTour(false)
    setShowPilgrimage(false)
  }
  // attraction 이 주어지면(관광지 상세의 "근처 빵집 보기") 그 위치 기준 거리순 모드로 진입한다.
  const openBakeryMap = (attraction) => {
    setNearbyOrigin(
      Number.isFinite(attraction?.lat) && Number.isFinite(attraction?.lng) ? attraction : null,
    )
    setShowMap(true)
    setFeatureOpen(false)
    setShowSaved(false)
    setShowInfo(false)
    setShowTour(false)
    setShowPilgrimage(false)
  }
  const openTour = () => {
    setShowTour(true)
    setTourStage(tourSurveyDone ? 'reveal' : 'survey')
    setTourSelectedId(null)
    setFeatureOpen(false)
    setShowSaved(false)
    setShowInfo(false)
    setShowMap(false)
    setShowPilgrimage(false)
  }
  const openTourHub = (selectedId = null) => {
    setTourSelectedId(selectedId)
    setTourStage('hub')
  }
  const openPilgrimage = () => {
    setShowPilgrimage(true)
    setFeatureOpen(false)
    setShowSaved(false)
    setShowInfo(false)
    setShowMap(false)
    setShowTour(false)
  }
  const goHome = () => {
    setFeatureOpen(false)
    setShowSaved(false)
    setShowInfo(false)
    setShowMap(false)
    setShowTour(false)
    setShowPilgrimage(false)
  }
  const retakeSurvey = () => {
    resetAnswers()
    setStage('survey')
  }

  return (
    <div className="bm-landing">
      <NavBar
        onGoHome={goHome}
        onOpenInfo={openInfo}
        onStartTest={startTest}
        onOpenMap={openBakeryMap}
        onOpenTour={openTour}
        onOpenPilgrimage={openPilgrimage}
        onOpenSaved={openSaved}
      />

      {showInfo && <InfoPage onStart={startTest} />}

      {showMap && (
        <div className="page">
          <BakeryMapPage origin={nearbyOrigin} onClearOrigin={() => setNearbyOrigin(null)} />
        </div>
      )}

      {showTour && (
        <div className="page">
          {tourStage === 'survey' && (
            <TourSurveyFlow
              onComplete={() => setTourStage('reveal')}
              onSkip={() => openTourHub(null)}
            />
          )}
          {tourStage === 'reveal' && (
            <TourReveal
              answers={tourAnswers}
              onRetake={() => {
                resetTourAnswers()
                setTourStage('survey')
              }}
              onOpenHub={openTourHub}
            />
          )}
          {tourStage === 'hub' && (
            <TourPage
              onShowBakeryMap={openBakeryMap}
              initialDistrict={tourAnswers ? resolveDistrict(tourAnswers) : null}
              initialSelectedId={tourSelectedId}
            />
          )}
        </div>
      )}

      {showPilgrimage && (
        <div className="page">
          <PilgrimagePage onStartBreadSurvey={startTest} onStartTourSurvey={openTour} />
        </div>
      )}

      {showSaved && (
        <div className="page">
          <SavedListPage />
        </div>
      )}

      {featureOpen && (
        <div className="page">
          {stage === 'survey' && <SurveyFlow onComplete={() => setStage('reveal')} />}
          {stage === 'reveal' && (
            <BreadReveal onRetake={retakeSurvey} onShowMap={() => setStage('map')} />
          )}
          {stage === 'map' && <MapResult onRetake={retakeSurvey} />}
        </div>
      )}

      {!showInfo && !showMap && !showTour && !showPilgrimage && !showSaved && !featureOpen && (
        <>
          <MainHero onStart={startTest} />
          <PhotoShowcase />

          <div className="bm-footer">
            <img src={logo} alt="빵모아 로고" />
            <span>빵모아</span>
            <span className="bm-footer-credit">· 『2026 관광데이터 활용 공모전』 출품작</span>
          </div>
        </>
      )}
    </div>
  )
}
