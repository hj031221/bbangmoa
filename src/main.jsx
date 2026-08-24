import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// 새로고침 때 브라우저가 이전 화면의 스크롤 좌표를 홈에 복원하지 않도록,
// React가 마운트되기 전부터 네이티브 스크롤 복원을 비활성화한다.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
