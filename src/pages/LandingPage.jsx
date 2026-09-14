import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { buildHistoryState, restoreHistoryState } from '../lib/viewHistory'

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
  const directBreadId = useAppStore((s) => s.directBreadId)
  const setDirectBread = useAppStore((s) => s.setDirectBread)
  const clearDirectBread = useAppStore((s) => s.clearDirectBread)
  const resetAnswers = useAppStore((s) => s.resetAnswers)
  const tourAnswers = useAppStore((s) => s.tourAnswers)
  const resetTourAnswers = useAppStore((s) => s.resetTourAnswers)
  const setPendingCourseLoad = useAppStore((s) => s.setPendingCourseLoad)

  const surveyDone = !!origin && isSurveyComplete(answers)
  const tourSurveyDone = isTourSurveyComplete(tourAnswers)
  const isHome = view === 'home'

  // 히스토리에 실어 보낼 "지금 화면 상태" 튜플. popstate 핸들러는 마운트 때 한 번만 등록돼
  // 클로저가 초기값에 고정되므로, fallback 으로 쓸 최신값은 ref 로 들고 있는다.
  const historyState = { stage, tourStage, tourSelectedId, tourHubFromReveal, directBreadId }
  const historyStateRef = useRef(historyState)
  historyStateRef.current = historyState

  // 최종 리뷰 2+3: 예전엔 여기서 항상 state:null 을 push 했다. answers/origin 이 localStorage 에
  // 남아 있는 재방문자는 surveyDone 이 true 라 enterBreadFlow('reveal') 이 "보통 경로"인데,
  // 그 항목에 stage:'reveal' 이 안 담기니 더 깊이 들어갔다가 뒤로가기로 이 항목에 돌아오면
  // 리빌이 아니라 설문이 떴다. 이제 항상 완전한 state 를 담아 push 한다.
  // patch: 이 전환이 도착할 화면 상태(예: { stage:'reveal' }) — pushSubState 와 같은 형식.
  const navigateToView = (nextView, patch = null) => {
    setView(nextView)
    const nextPath = getAppPath(nextView)
    const url = `${nextPath}${window.location.search}${window.location.hash}`
    const state = buildHistoryState(historyStateRef.current, patch || {})
    if (window.location.pathname !== nextPath) {
      window.history.pushState(state, '', url)
    } else if (patch) {
      // 경로가 그대로면 새 항목을 만들지 않는다(기존 동작 유지). 다만 지금 항목의 state 는
      // 갱신해 둬야, 나중에 이 항목으로 돌아왔을 때 옛 단계로 복원되지 않는다.
      window.history.replaceState(state, '', url)
    }
  }

  // 이슈 #70 2번: 브라우저 뒤로가기로 홈에 도달하는 경우도 goHome()과 동일하게 — 설문 결과를
  // 지우지 않는다(리셋은 retakeSurvey 에만 건다).
  useEffect(() => {
    const restoreViewFromHistory = (event) => {
      const nextView = getAppView(window.location.pathname)
      setView(nextView)
      setNearbyOrigin(null)
      setMapSearch('')
      setMapSelectId(null)
      const current = historyStateRef.current
      const restored = restoreHistoryState(event.state, current)
      setStage(restored.stage)
      setTourStage(restored.tourStage)
      setTourSelectedId(restored.tourSelectedId)
      setTourHubFromReveal(restored.tourHubFromReveal)
      // 빵 종류 바로가기 상태도 같이 되돌린다 — 안 그러면 칩으로 고른 빵이 설문으로 돌아간
      // 뒤에도 남아, 새로 답한 설문 결과 대신 옛 칩 빵이 리빌에 뜬다(최종 리뷰 3).
      // 값이 그대로일 때 setDirectBread 를 다시 부르면 answers/origin 까지 지워지므로
      // 실제로 달라졌을 때만 건드린다.
      if ((restored.directBreadId ?? null) !== (current.directBreadId ?? null)) {
        if (restored.directBreadId) setDirectBread(restored.directBreadId)
        else clearDirectBread()
      }
    }

    // 브라우저가 만든 최초 항목에는 state 가 없다 — 지금 상태를 미리 심어두면, 나중에
    // 뒤로가기로 이 항목에 돌아왔을 때 추측(fallback) 없이 정확히 복원된다.
    if (window.history.state == null) {
      window.history.replaceState(
        buildHistoryState(historyStateRef.current, {}),
        '',
        window.location.pathname + window.location.search + window.location.hash,
      )
    }

    window.addEventListener('popstate', restoreViewFromHistory)
    return () => window.removeEventListener('popstate', restoreViewFromHistory)
  }, [])

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

  // 이슈 #80 B-1: navigateToView는 최상위 view 전환만 pushState한다. 같은 view 안에서
  // stage/tourStage 등이 바뀌는 하위 전환은 이 함수로 별도 히스토리 항목을 남긴다.
  const pushSubState = (patch) => {
    const state = buildHistoryState(historyStateRef.current, patch)
    window.history.pushState(state, '', window.location.pathname + window.location.search + window.location.hash)
  }

  // patch: stage 외에 이 전환으로 같이 바뀌는 값(예: 칩 진입의 directBreadId).
  // navigateToView 가 한 번만 push/replace 하도록 전부 여기로 모아서 넘긴다.
  const enterBreadFlow = (nextStage, patch = null) => {
    navigateToView('bread', { stage: nextStage, ...(patch || {}) })
    setStage(nextStage)
  }
  // 홈 히어로 CTA·교차 링크 등: 진행 중이던 결과가 있으면 그 리빌부터 이어 본다.
  // (onClick 핸들러로 직접 넘겨 이벤트 객체가 인자로 들어와도 안전하도록 인자를 받지 않는다.)
  // 빵 바로가기(directBreadId)로 진입했던 상태는 해제한다 — 설문 결과 화면이 그 빵으로 고정되지 않게.
  const startTest = () => {
    clearDirectBread()
    // 스토어는 방금 비웠지만 이 렌더의 directBreadId 클로저는 아직 옛 값이라, 히스토리에는
    // 명시적으로 null 을 실어 보낸다.
    enterBreadFlow(surveyDone ? 'reveal' : 'survey', { directBreadId: null })
  }
  // "바로 찾기" 칩: 설문을 건너뛰고 고른 빵으로 바로 간략 리빌 화면으로.
  // 고른 빵 id 도 히스토리 항목에 같이 담아, 뒤로가기로 이 지점 이전으로 나가면 같이 풀리게 한다.
  const pickBreadType = (breadId) => {
    setDirectBread(breadId)
    enterBreadFlow('reveal', { directBreadId: breadId })
  }
  // 메뉴바에서 "빵집 찾기"를 다시 고른 경우: 이전 결과를 버리고 설문 처음부터.
  const startTestFromNav = () => {
    resetAnswers()
    enterBreadFlow('survey', { directBreadId: null })
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
    navigateToView('tour', { tourStage: nextStage, tourSelectedId: null, tourHubFromReveal: false })
    setTourSelectedId(null)
    setTourHubFromReveal(false)
    setTourStage(nextStage)
  }
  const openTour = () => enterTourFlow(tourSurveyDone ? 'reveal' : 'survey')
  // selectedId 가 있으면(관광모아 결과 카드에서 진입) 상세에서 "뒤로가기" 시 허브 그리드가
  // 아니라 결과 화면(reveal)으로 돌아가야 한다 — 그 출처를 tourHubFromReveal 로 기억한다.
  const openTourHub = (selectedId = null) => {
    setTourSelectedId(selectedId)
    setTourHubFromReveal(selectedId != null)
    setTourStage('hub')
    pushSubState({ tourStage: 'hub', tourSelectedId: selectedId, tourHubFromReveal: selectedId != null })
  }
  const openTourAttraction = (selectedId) => {
    navigateToView('tour', { tourStage: 'hub', tourSelectedId: selectedId, tourHubFromReveal: false })
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
  // 예전엔 홈으로 나가면 두 설문 결과를 모두 초기화했다(피드백4) — 그런데 로고를 눌러 홈을
  // 거쳤다가 대전한바퀴로 돌아오면 코스가 사라지는 게 이슈 #70 2번으로 다시 지적됐다. 리셋은
  // 사용자가 명시적으로 요청할 때(아래 retakeSurvey, "다시 해보기" 버튼)만 걸고, 그냥 홈으로
  // 나가는 것만으로는 아무것도 지우지 않는다.
  const goHome = () => {
    navigateToView('home')
  }
  const retakeSurvey = () => {
    resetAnswers()
    setStage('survey')
    pushSubState({ stage: 'survey' })
  }
  // 설문을 막 끝내면 항상 이 설문의 리빌 화면부터 보여준다. 관광모아도 이미 끝나 있으면(반대도
  // 마찬가지) 리빌 화면을 스킵하고 바로 대전한바퀴로 보내던 동작(피드백2)은, 두 번째 설문 결과를
  // 사용자가 한 프레임도 못 보고 넘어가는 문제가 있어 제거함 — 대신 리빌 화면의 교차 링크가
  // "다른 설문하러 가기" 대신 "대전한바퀴로 코스 보기"로 바뀌어 같은 목적지로 가되, 결과는 보여준다.
  const handleSurveyComplete = () => {
    setStage('reveal')
    pushSubState({ stage: 'reveal' })
  }
  const handleTourSurveyComplete = () => {
    setTourStage('reveal')
    pushSubState({ tourStage: 'reveal' })
  }
  const showMapResult = () => {
    setStage('map')
    pushSubState({ stage: 'map' })
  }
  const retakeTourSurvey = () => {
    resetTourAnswers()
    setTourStage('survey')
    pushSubState({ tourStage: 'survey' })
  }
  const exitTourHubToReveal = () => {
    setTourStage('reveal')
    pushSubState({ tourStage: 'reveal' })
  }

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
              onRetake={retakeTourSurvey}
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
              onExitToReveal={exitTourHubToReveal}
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
          {stage === 'survey' && (
            <SurveyFlow
              onComplete={handleSurveyComplete}
              onSkip={() => openBakeryMap()}
              onPickBreadType={pickBreadType}
            />
          )}
          {stage === 'reveal' && (
            <BreadReveal
              onRetake={directBreadId ? goHome : retakeSurvey}
              onShowMap={showMapResult}
              tourDone={tourSurveyDone}
              onGoToTour={openTour}
              onGoToPilgrimage={openPilgrimage}
            />
          )}
          {stage === 'map' && <MapResult onRetake={directBreadId ? goHome : retakeSurvey} />}
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
