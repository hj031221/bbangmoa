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
import { getAppPath, getAppView } from '../lib/appRoute'

// 랜딩 = 마케팅 사이트. 상단 메뉴바(NavBar)는 어떤 화면에서도 항상 떠 있고,
// 메뉴 클릭에 따라 그 아래 본문만 바뀐다. "취향 테스트 시작" 계열 버튼을 누르면
// 같은 페이지 안에서 설문(SurveyFlow) → 오늘의 빵 리빌(BreadReveal) → 지도 결과(MapResult) 로 전환된다.
export default function LandingPage() {
  const { sendRequestByCode } = useFriends()
  const { invite, notice, confirm, dismiss, dismissNotice } = useInviteLink(sendRequestByCode)
  const [view, setView] = useState(() => getAppView(window.location.pathname))
  const [stage, setStage] = useState('survey') // 'survey' | 'reveal' | 'map'
  // MyPage 는 기록장 상세 등 내부 화면 전환을 자체 상태(panel/selectedId)로 관리한다.
  // 이미 마이페이지 안(예: 기록장 상세)에 있을 때 메뉴바 "마이페이지"를 다시 누르면
  // view 는 그대로라 리렌더가 안 일어나 화면이 안 바뀌었다 — key 를 바꿔 강제로
  // MyPage 를 새로 마운트해서 항상 홈으로 돌아가게 한다.
  const [myPageResetKey, setMyPageResetKey] = useState(0)
  const [tourStage, setTourStage] = useState('survey') // 'survey' | 'reveal' | 'hub'
  const [tourSelectedId, setTourSelectedId] = useState(null) // hub 진입 시 바로 선택할 관광지
  const [tourHubFromReveal, setTourHubFromReveal] = useState(false) // 결과 카드 → 상세로 진입했는가(뒤로가기 목적지 판단)
  const [nearbyOrigin, setNearbyOrigin] = useState(null) // 관광지 "근처 빵집 보기" 로 진입 시 { name, lat, lng }
  const [mapSearch, setMapSearch] = useState('') // 랜딩 히어로 검색창에서 넘어온 빵집 이름 검색어
  const [mapSelectId, setMapSelectId] = useState(null) // 빵 지도 진입 시 미리 선택할 빵집 id (찜 목록 등에서)
  const answers = useAppStore((s) => s.answers)
  const origin = useAppStore((s) => s.origin)
  const resetAnswers = useAppStore((s) => s.resetAnswers)
  const tourAnswers = useAppStore((s) => s.tourAnswers)
  const resetTourAnswers = useAppStore((s) => s.resetTourAnswers)
  const setPendingCourseLoad = useAppStore((s) => s.setPendingCourseLoad)

  const surveyDone = !!origin && isSurveyComplete(answers)
  const tourSurveyDone = isTourSurveyComplete(tourAnswers)
  const isHome = view === 'home'

  const navigateToView = (nextView) => {
    setView(nextView)
    const nextPath = getAppPath(nextView)
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', `${nextPath}${window.location.search}${window.location.hash}`)
    }
  }

  useEffect(() => {
    const restoreViewFromHistory = () => {
      const nextView = getAppView(window.location.pathname)
      setView(nextView)
      setNearbyOrigin(null)
      setMapSearch('')
      setMapSelectId(null)
      if (nextView === 'home') {
        resetAnswers()
        resetTourAnswers()
      }
    }

    window.addEventListener('popstate', restoreViewFromHistory)
    return () => window.removeEventListener('popstate', restoreViewFromHistory)
  }, [resetAnswers, resetTourAnswers])

  // 서비스 소개처럼 스크롤 가능한 화면에서 새로고침하면 브라우저가 이전 scrollY를 복원한다.
  // 앱 상태는 홈으로 초기화되므로 홈에 들어올 때 항상 상단으로 되돌린다.
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

  // 홈을 "한 화면"으로 고정하는 건 이제 전적으로 CSS(.bm-landing.is-home)가 담당한다:
  // 데스크톱(≥1100px)에서만 position:fixed + overflow:hidden 로 가두고, 그 미만에서는 스크롤 허용.
  // 예전엔 여기서 window 의 wheel/touchmove 를 preventDefault 로 막았는데, 그게 Ctrl+휠(브라우저
  // 확대/축소)과 트랙패드 핀치까지 같이 죽였고, 지도 화면을 다녀온 뒤 홈으로 돌아오면 그 잠금이
  // 다시 걸려 "확대·축소·드래그가 안 되는" 증상이 났다. position:fixed 컨테이너면 body 에 스크롤
  // 될 게 없어서 JS 잠금 없이도 한 화면이 유지된다.

  const enterBreadFlow = (nextStage) => {
    navigateToView('bread')
    setStage(nextStage)
  }
  // 홈 히어로 CTA·교차 링크 등: 진행 중이던 결과가 있으면 그 리빌부터 이어 본다.
  // (onClick 핸들러로 직접 넘겨 이벤트 객체가 인자로 들어와도 안전하도록 인자를 받지 않는다.)
  const startTest = () => enterBreadFlow(surveyDone ? 'reveal' : 'survey')
  // 메뉴바에서 "빵집 찾기"를 다시 고른 경우: 이전 결과를 버리고 설문 처음부터.
  const startTestFromNav = () => {
    resetAnswers()
    enterBreadFlow('survey')
  }
  const openMyPage = () => {
    setMyPageResetKey((k) => k + 1)
    navigateToView('mypage')
  }
  const openInfo = () => {
    navigateToView('info')
  }
  // attraction 이 주어지면(관광지 상세의 "근처 빵집 보기") 그 위치 기준 거리순 모드로 진입한다.
  const openBakeryMap = (attraction) => {
    setNearbyOrigin(
      Number.isFinite(attraction?.lat) && Number.isFinite(attraction?.lng) ? attraction : null,
    )
    setMapSearch('')
    setMapSelectId(null)
    navigateToView('map')
  }
  // 랜딩 히어로 검색창: 이름 검색어를 들고 빵 지도로 이동.
  const searchBakeryMap = (query) => {
    setNearbyOrigin(null)
    setMapSearch(query)
    setMapSelectId(null)
    navigateToView('map')
  }
  const enterTourFlow = (nextStage) => {
    navigateToView('tour')
    setTourSelectedId(null)
    setTourHubFromReveal(false)
    setTourStage(nextStage)
  }
  const openTour = () => enterTourFlow(tourSurveyDone ? 'reveal' : 'survey')
  // 메뉴바에서 "관광모아"를 다시 고른 경우: 이전 결과를 버리고 설문 처음부터.
  const openTourFromNav = () => {
    resetTourAnswers()
    enterTourFlow('survey')
  }
  // selectedId 가 있으면(관광모아 결과 카드에서 진입) 상세에서 "뒤로가기" 시 허브 그리드가
  // 아니라 결과 화면(reveal)으로 돌아가야 한다 — 그 출처를 tourHubFromReveal 로 기억한다.
  const openTourHub = (selectedId = null) => {
    setTourSelectedId(selectedId)
    setTourHubFromReveal(selectedId != null)
    setTourStage('hub')
  }
  const openTourAttraction = (selectedId) => {
    navigateToView('tour')
    setTourStage('hub')
    setTourSelectedId(selectedId)
    setTourHubFromReveal(false) // 홈 위젯에서 진입 — 상세 뒤로가기는 허브 그리드로
  }
  // 마이페이지 찜한 빵 목록에서 항목을 누르면 그 빵집이 선택된 상태로 빵 지도를 연다.
  const viewBakeryOnMap = (bakery) => {
    setNearbyOrigin(null)
    setMapSearch(bakery.name || '') // 검색 필터에 포함시켜 목록/지도에 뜨게
    setMapSelectId(bakery.id ?? null)
    navigateToView('map')
  }
  const openPilgrimage = () => {
    navigateToView('pilgrimage')
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
    navigateToView('home')
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
        onStartTest={startTestFromNav}
        onOpenMap={openBakeryMap}
        onOpenTour={openTourFromNav}
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

      {view === 'info' && <InfoPage onStart={startTest} />}

      {view === 'map' && (
        <div className="page">
          <BakeryMapPage
            origin={nearbyOrigin}
            onClearOrigin={() => setNearbyOrigin(null)}
            initialSearch={mapSearch}
            initialSelectedId={mapSelectId}
            onBack={goHome}
          />
        </div>
      )}

      {view === 'tour' && (
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
              cameFromReveal={tourHubFromReveal}
              onExitToReveal={() => setTourStage('reveal')}
            />
          )}
        </div>
      )}

      {view === 'pilgrimage' && (
        <div className="page">
          <PilgrimagePage onStartBreadSurvey={startTest} onStartTourSurvey={openTour} />
        </div>
      )}

      {view === 'mypage' && (
        <div className="page">
          <MyPage key={myPageResetKey} onLoadCourse={loadCourseIntoPilgrimage} onViewBakeryOnMap={viewBakeryOnMap} />
        </div>
      )}

      {view === 'bread' && (
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
