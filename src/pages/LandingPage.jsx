import { useEffect, useLayoutEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { isSurveyComplete } from '../lib/breadRecommend'
import SurveyFlow from '../components/survey/SurveyFlow'
import BreadReveal from '../components/result/BreadReveal'
import MapResult from '../components/map/MapResult'
import MyPage from './MyPage'
import InfoPage from './InfoPage'
import NavBar from '../components/landing/NavBar'
import MainHero from '../components/landing/MainHero'
import BakeryMapPage from '../components/map/BakeryMapPage'
import TourPage from '../components/tour/TourPage'
import TourSurveyFlow from '../components/tour/TourSurveyFlow'
import TourReveal from '../components/tour/TourReveal'
import PilgrimagePage from '../components/tour/PilgrimagePage'
import { resolveDistrict, isTourSurveyComplete } from '../lib/tourRecommend'
import { useFriends } from '../hooks/useFriends'
import { useInviteLink } from '../hooks/useInviteLink'
import InviteFriendModal from '../components/mypage/InviteFriendModal'

// 랜딩 = 마케팅 사이트. 상단 메뉴바(NavBar)는 어떤 화면에서도 항상 떠 있고,
// 메뉴 클릭에 따라 그 아래 본문만 바뀐다. "취향 테스트 시작" 계열 버튼을 누르면
// 같은 페이지 안에서 설문(SurveyFlow) → 오늘의 빵 리빌(BreadReveal) → 지도 결과(MapResult) 로 전환된다.
export default function LandingPage() {
  const { sendRequestByCode } = useFriends()
  const { invite, notice, confirm, dismiss, dismissNotice } = useInviteLink(sendRequestByCode)
  const [featureOpen, setFeatureOpen] = useState(false)
  const [stage, setStage] = useState('survey') // 'survey' | 'reveal' | 'map'
  const [showMyPage, setShowMyPage] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [showPilgrimage, setShowPilgrimage] = useState(false)
  const [tourStage, setTourStage] = useState('survey') // 'survey' | 'reveal' | 'hub'
  const [tourSelectedId, setTourSelectedId] = useState(null) // hub 진입 시 바로 선택할 관광지
  const [nearbyOrigin, setNearbyOrigin] = useState(null) // 관광지 "근처 빵집 보기" 로 진입 시 { name, lat, lng }
  const [mapSearch, setMapSearch] = useState('') // 랜딩 히어로 검색창에서 넘어온 빵집 이름 검색어
  const answers = useAppStore((s) => s.answers)
  const origin = useAppStore((s) => s.origin)
  const resetAnswers = useAppStore((s) => s.resetAnswers)
  const tourAnswers = useAppStore((s) => s.tourAnswers)
  const resetTourAnswers = useAppStore((s) => s.resetTourAnswers)
  const setPendingCourseLoad = useAppStore((s) => s.setPendingCourseLoad)

  const surveyDone = !!origin && isSurveyComplete(answers)
  const tourSurveyDone = isTourSurveyComplete(tourAnswers)
  const isHome = !showInfo && !showMap && !showTour && !showPilgrimage && !showMyPage && !featureOpen

  // 서비스 소개처럼 스크롤 가능한 화면에서 새로고침하면 브라우저가 이전 scrollY를 복원한다.
  // 앱 상태는 홈으로 초기화되므로, 아래 스크롤 잠금이 걸리기 전에 반드시 홈 상단으로 되돌린다.
  useLayoutEffect(() => {
    if (!isHome) return undefined

    const resetHomeScroll = () => window.scrollTo(0, 0)
    resetHomeScroll()
    const frame = window.requestAnimationFrame(resetHomeScroll)
    window.addEventListener('pageshow', resetHomeScroll)
    window.addEventListener('load', resetHomeScroll)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('pageshow', resetHomeScroll)
      window.removeEventListener('load', resetHomeScroll)
    }
  }, [isHome])

  // 메인 화면(홈)에서는 마우스 휠/스크롤이 필요 없게 — 다른 화면으로 전환되면 원래대로 복원.
  // overflow:hidden 만으로는 휠 스크롤이 안 막혀서, 휠/터치 이벤트 자체를 막는다.
  useEffect(() => {
    document.documentElement.style.overflow = isHome ? 'hidden' : ''
    document.body.style.overflow = isHome ? 'hidden' : ''
    if (!isHome) return undefined

    const preventScroll = (e) => e.preventDefault()
    window.addEventListener('wheel', preventScroll, { passive: false })
    window.addEventListener('touchmove', preventScroll, { passive: false })
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      window.removeEventListener('wheel', preventScroll)
      window.removeEventListener('touchmove', preventScroll)
    }
  }, [isHome])

  const startTest = () => {
    setFeatureOpen(true)
    setShowMyPage(false)
    setShowInfo(false)
    setShowMap(false)
    setShowTour(false)
    setShowPilgrimage(false)
    setStage(surveyDone ? 'reveal' : 'survey')
  }
  const openMyPage = () => {
    setShowMyPage(true)
    setFeatureOpen(false)
    setShowInfo(false)
    setShowMap(false)
    setShowTour(false)
    setShowPilgrimage(false)
  }
  const openInfo = () => {
    setShowInfo(true)
    setFeatureOpen(false)
    setShowMyPage(false)
    setShowMap(false)
    setShowTour(false)
    setShowPilgrimage(false)
  }
  // attraction 이 주어지면(관광지 상세의 "근처 빵집 보기") 그 위치 기준 거리순 모드로 진입한다.
  const openBakeryMap = (attraction) => {
    setNearbyOrigin(
      Number.isFinite(attraction?.lat) && Number.isFinite(attraction?.lng) ? attraction : null,
    )
    setMapSearch('')
    setShowMap(true)
    setFeatureOpen(false)
    setShowMyPage(false)
    setShowInfo(false)
    setShowTour(false)
    setShowPilgrimage(false)
  }
  // 랜딩 히어로 검색창: 이름 검색어를 들고 빵 지도로 이동.
  const searchBakeryMap = (query) => {
    setNearbyOrigin(null)
    setMapSearch(query)
    setShowMap(true)
    setFeatureOpen(false)
    setShowMyPage(false)
    setShowInfo(false)
    setShowTour(false)
    setShowPilgrimage(false)
  }
  const openTour = () => {
    setShowTour(true)
    setTourStage(tourSurveyDone ? 'reveal' : 'survey')
    setTourSelectedId(null)
    setFeatureOpen(false)
    setShowMyPage(false)
    setShowInfo(false)
    setShowMap(false)
    setShowPilgrimage(false)
  }
  const openTourHub = (selectedId = null) => {
    setTourSelectedId(selectedId)
    setTourStage('hub')
  }
  const openTourAttraction = (selectedId) => {
    setShowTour(true)
    setTourStage('hub')
    setTourSelectedId(selectedId)
    setFeatureOpen(false)
    setShowMyPage(false)
    setShowInfo(false)
    setShowMap(false)
    setShowPilgrimage(false)
  }
  const openPilgrimage = () => {
    setShowPilgrimage(true)
    setFeatureOpen(false)
    setShowMyPage(false)
    setShowInfo(false)
    setShowMap(false)
    setShowTour(false)
  }
  // 마이페이지 "찜한 코스"에서 "불러오기" → 그 코스를 스토어에 담아두고 대전한바퀴로 이동한다.
  // PilgrimagePage가 마운트되면서 pendingCourseLoad를 소비해 화면을 채운다(§CP10-3).
  const loadCourseIntoPilgrimage = (course) => {
    setPendingCourseLoad(course)
    openPilgrimage()
  }
  // 홈으로 나가면 두 설문 결과를 모두 초기화한다 — 홈 갔다 다시 들어와도 예전 결과가
  // 그대로 뜨지 않고 항상 새 설문부터 시작하게(피드백4). 설문 화면 안에서 서로 넘나드는 건
  // (아래 handleSurveyComplete/handleTourSurveyComplete, 리빌 화면의 교차 링크) 홈을 거치지
  // 않으니 영향 없다 — 리셋은 "홈으로 나가는 행동" 자체에만 건다.
  const goHome = () => {
    setFeatureOpen(false)
    setShowMyPage(false)
    setShowInfo(false)
    setShowMap(false)
    setShowTour(false)
    setShowPilgrimage(false)
    resetAnswers()
    resetTourAnswers()
  }
  const retakeSurvey = () => {
    resetAnswers()
    setStage('survey')
  }
  // 설문을 막 끝내면 항상 이 설문의 리빌 화면부터 보여준다. 관광모아도 이미 끝나 있으면(반대도
  // 마찬가지) 리빌 화면을 스킵하고 바로 대전한바퀴로 보내던 동작(피드백2)은, 두 번째 설문 결과를
  // 사용자가 한 프레임도 못 보고 넘어가는 문제가 있어 제거함 — 대신 리빌 화면의 교차 링크가
  // "다른 설문하러 가기" 대신 "대전한바퀴로 코스 보기"로 바뀌어 같은 목적지로 가되, 결과는 보여준다.
  const handleSurveyComplete = () => setStage('reveal')
  const handleTourSurveyComplete = () => setTourStage('reveal')

  return (
    <div className={`bm-landing${isHome ? ' is-home' : ''}`}>
      <NavBar
        onGoHome={goHome}
        onOpenInfo={openInfo}
        onStartTest={startTest}
        onOpenMap={openBakeryMap}
        onOpenTour={openTour}
        onOpenPilgrimage={openPilgrimage}
        onOpenMyPage={openMyPage}
      />

      {invite && (
        <InviteFriendModal nickname={invite.nickname} onConfirm={confirm} onCancel={dismiss} />
      )}
      {notice && (
        <div className="invite-notice-banner">
          {notice}
          <button
            type="button"
            className="invite-notice-close"
            onClick={dismissNotice}
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      )}

      {showInfo && <InfoPage onStart={startTest} />}

      {showMap && (
        <div className="page">
          <BakeryMapPage
            origin={nearbyOrigin}
            onClearOrigin={() => setNearbyOrigin(null)}
            initialSearch={mapSearch}
            onBack={goHome}
          />
        </div>
      )}

      {showTour && (
        <div className="page">
          {tourStage === 'survey' && (
            <TourSurveyFlow onComplete={handleTourSurveyComplete} onSkip={() => openTourHub(null)} />
          )}
          {tourStage === 'reveal' && (
            <TourReveal
              answers={tourAnswers}
              onRetake={() => {
                resetTourAnswers()
                setTourStage('survey')
              }}
              onOpenHub={openTourHub}
              breadDone={surveyDone}
              onGoToBread={startTest}
              onGoToPilgrimage={openPilgrimage}
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

      {showMyPage && (
        <div className="page">
          <MyPage onLoadCourse={loadCourseIntoPilgrimage} />
        </div>
      )}

      {featureOpen && (
        <div className="page">
          {stage === 'survey' && <SurveyFlow onComplete={handleSurveyComplete} />}
          {stage === 'reveal' && (
            <BreadReveal
              onRetake={retakeSurvey}
              onShowMap={() => setStage('map')}
              tourDone={tourSurveyDone}
              onGoToTour={openTour}
              onGoToPilgrimage={openPilgrimage}
            />
          )}
          {stage === 'map' && <MapResult onRetake={retakeSurvey} />}
        </div>
      )}

      {isHome && (
        <div className="bm-home">
          <MainHero
            onStart={startTest}
            onOpenMap={() => openBakeryMap()}
            onOpenTour={openTourAttraction}
            onSearch={searchBakeryMap}
          />
        </div>
      )}
    </div>
  )
}
