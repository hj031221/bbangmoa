import { useState } from 'react'
import AuthMenu from '../auth/AuthMenu'
import logo from '../../assets/logo-typeA-full.png'

// 상단 메뉴바 — 어떤 화면(홈/설문/지도/찜/정보)에 있든 항상 동일하게 떠 있는다.
// 별도의 "처음으로" 버튼은 두지 않는다: 로고를 누르면 항상 홈으로 돌아간다.
export default function NavBar({
  onGoHome,
  onOpenInfo,
  onStartTest,
  onOpenMap,
  onOpenTour,
  onOpenPilgrimage,
  onOpenMyPage,
}) {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <nav className="bm-nav">
      <div className="bm-nav-inner">
        <a
          href="#"
          className="bm-logo"
          onClick={(e) => {
            e.preventDefault()
            onGoHome()
          }}
        >
          <img src={logo} alt="빵모아 로고" />
          <span>빵모아</span>
        </a>
        <div className="bm-nav-links">
          <button type="button" onClick={onOpenInfo}>
            서비스 소개
          </button>
          <button type="button" onClick={onStartTest}>
            빵집 찾기
          </button>
          <button type="button" onClick={onOpenMap}>
            빵 지도
          </button>
          <button type="button" onClick={onOpenTour}>
            관광모아
          </button>
          <button type="button" onClick={onOpenPilgrimage}>
            대전한바퀴
          </button>
          <button type="button" onClick={onOpenMyPage}>
            마이페이지
          </button>
        </div>
        <div className="bm-nav-actions">
          <div className="bm-nav-auth">
            <AuthMenu onSignOut={onGoHome} />
          </div>
          <button
            type="button"
            className="bm-nav-toggle"
            aria-label={navOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        {navOpen && (
          <div className="bm-nav-mobile-menu">
            <button
              type="button"
              onClick={() => {
                onOpenInfo()
                setNavOpen(false)
              }}
            >
              서비스 소개
            </button>
            <button
              type="button"
              onClick={() => {
                onStartTest()
                setNavOpen(false)
              }}
            >
              빵집 찾기
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenMap()
                setNavOpen(false)
              }}
            >
              빵 지도
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenTour()
                setNavOpen(false)
              }}
            >
              관광모아
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenPilgrimage()
                setNavOpen(false)
              }}
            >
              대전한바퀴
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenMyPage()
                setNavOpen(false)
              }}
            >
              마이페이지
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
