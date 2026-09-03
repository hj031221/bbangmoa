import { useEffect, useRef, useState } from 'react'
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
  const menuRef = useRef(null)
  const toggleRef = useRef(null)

  // 모바일 메뉴가 열려 있을 때: 메뉴 바깥을 누르거나 Esc를 누르면 닫는다.
  // (기존엔 각 메뉴 항목이나 햄버거 버튼을 다시 눌러야만 닫혔다.)
  useEffect(() => {
    if (!navOpen) return undefined
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || toggleRef.current?.contains(e.target)) return
      setNavOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setNavOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [navOpen])

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
            빵집모아
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
            ref={toggleRef}
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
          <div className="bm-nav-mobile-menu" ref={menuRef}>
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
              빵집모아
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
