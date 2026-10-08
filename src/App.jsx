import { Suspense, lazy } from 'react'
import LandingPage from './pages/LandingPage'
import ServerConnectionBadge from './components/dev/ServerConnectionBadge'

// /s/* 공유 페이지는 랜딩과 같은 번들에 실릴 이유가 없어 분리 로드한다.
const StampSharePage = lazy(() => import('./pages/StampSharePage'))

// 라우터 없음 — pathname 만 본다. vercel.json 이 /s/* 를 index.html 로 rewrite 한다.
export default function App() {
  const badge = import.meta.env.DEV ? <ServerConnectionBadge /> : null

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/s/')) {
    const raw = window.location.pathname.slice('/s/'.length)
    let code = ''
    try {
      code = decodeURIComponent(raw).trim()
    } catch {
      code = raw.trim()
    }
    return (
      <>
        {badge}
        <Suspense fallback={null}>
          <StampSharePage code={code} />
        </Suspense>
      </>
    )
  }
  return (
    <>
      {badge}
      <LandingPage />
    </>
  )
}
