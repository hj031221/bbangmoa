import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabaseEnabled } from '../../lib/supabase'

// 카카오 "비즈 앱 전환 + 이메일 동의항목" 심사 통과 전까지 임시 비활성화.
// Supabase 가 Kakao OAuth 요청에 account_email 스코프를 강제 포함해서 심사 전엔 KOE205 로 막힌다.
// 심사 통과되면 true 로 바꾸면 됨 (코드 변경 없이 바로 동작).
const KAKAO_LOGIN_ENABLED = true

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.27h2.92c1.71-1.57 2.69-3.89 2.69-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.95v2.34C2.43 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.11-.28-1.71s.1-1.17.28-1.71V4.95H.95C.35 6.17 0 7.55 0 9s.35 2.83.95 4.05l3.02-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.43 2.02.95 4.95l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#3C1E1E"
        d="M9 1.5C4.31 1.5.5 4.6.5 8.42c0 2.45 1.6 4.6 4.02 5.83-.18.65-.63 2.3-.72 2.66-.11.44.16.44.34.32.14-.1 2.24-1.52 3.15-2.14.55.08 1.12.12 1.71.12 4.69 0 8.5-3.1 8.5-6.92S13.69 1.5 9 1.5z"
      />
    </svg>
  )
}

// 로그인 모달: 화면 중앙에 뜨는 글라스(반투명 블러) 카드. Google/Kakao 옵션이 위아래로 쌓여 나온다.
// body 에 포탈로 그린다 — .bm-nav 의 backdrop-filter 가 fixed 요소의 기준을 가둬버려서
// (backdrop-filter/transform/filter 는 새 containing block 을 만듦) 그냥 렌더링하면 nav 안에 갇혀 보인다.
function LoginModal({ onClose, onGoogle, onKakao }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" aria-label="닫기" onClick={onClose}>
          ✕
        </button>
        <div className="auth-modal-copy">
          <span className="auth-modal-emoji" aria-hidden="true">🥐</span>
          <h3 className="auth-modal-title">로그인&가입하기</h3>
          <p className="auth-modal-sub">로그인하고 나만의 리스트를 만들어봐요😎 </p>
        </div>
        <div className="auth-modal-buttons">
          <button type="button" className="auth-btn google" onClick={onGoogle}>
            <GoogleIcon />
            Google로 계속하기
          </button>
          {KAKAO_LOGIN_ENABLED && (
            <button type="button" className="auth-btn kakao" onClick={onKakao}>
              <KakaoIcon />
              카카오로 계속하기
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// 구글/카카오 로그인 메뉴.
// 로그아웃 상태: "로그인" 버튼 1개 → 클릭 시 화면 중앙에 글라스 모달로 Google/Kakao 옵션 표시.
// 로그인 상태: 이름 + 로그아웃.
// compact: 뒤로가기 버튼 옆처럼 좁은 자리에 쓰는 축약 스타일.
// Supabase 키 미설정 시엔 아예 렌더링하지 않는다(로컬 개발 초기 등).
export default function AuthMenu({ compact = false, onSignOut }) {
  const { user, loading, signInWithGoogle, signInWithKakao, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (!supabaseEnabled() || loading) return null

  const className = 'auth-menu' + (compact ? ' compact' : '')

  if (user) {
    const name =
      user.user_metadata?.full_name || user.user_metadata?.name || user.email || '내 계정'
    return (
      <div className={className}>
        <span className="auth-user" title={name}>
          {name}
        </span>
        <button
          type="button"
          className="auth-btn signout"
          onClick={() => {
            onSignOut?.()
            signOut()
          }}
        >
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <button type="button" className="auth-btn login-toggle" onClick={() => setOpen(true)}>
        로그인
      </button>
      {open && (
        <LoginModal
          onClose={() => setOpen(false)}
          onGoogle={() => {
            setOpen(false)
            signInWithGoogle()
          }}
          onKakao={() => {
            setOpen(false)
            signInWithKakao()
          }}
        />
      )}
    </div>
  )
}
