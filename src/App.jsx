import LandingPage from './pages/LandingPage'
import StampSharePage from './pages/StampSharePage'
import ServerConnectionBadge from './components/dev/ServerConnectionBadge'

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
        <StampSharePage code={code} />
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
