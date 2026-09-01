import LandingPage from './pages/LandingPage'
import StampSharePage from './pages/StampSharePage'

// 라우터 없음 — pathname 만 본다. vercel.json 이 /s/* 를 index.html 로 rewrite 한다.
export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/s/')) {
    const code = decodeURIComponent(window.location.pathname.slice('/s/'.length)).trim()
    return <StampSharePage code={code} />
  }
  return <LandingPage />
}
