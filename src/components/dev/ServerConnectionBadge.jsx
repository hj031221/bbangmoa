import { useEffect, useState } from 'react'
import { SERVER_BASE, serverEnabled } from '../../api/serverBase'

// 개발 모드에서만 존재한다 — Vite가 빌드할 때 import.meta.env.DEV를
// false로 치환해 이 컴포넌트를 쓰는 분기 자체를 프로덕션 번들에서 제거한다.
// VITE_API_BASE를 로컬 .env에 넣었을 때 새 백엔드 연결 여부를 눈으로 확인하기 위한 것.
export default function ServerConnectionBadge() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    if (!serverEnabled()) return
    fetch(`${SERVER_BASE}/actuator/health`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setStatus(data.status === 'UP' ? 'up' : 'down'))
      .catch(() => setStatus('down'))
  }, [])

  if (!serverEnabled()) return null

  const label = status === 'checking' ? '확인 중' : status === 'up' ? '연결됨' : '연결 실패'
  const color = status === 'up' ? '#2C6E4E' : status === 'down' ? '#9C2F27' : '#8B4A0D'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 12,
        fontFamily: 'monospace',
        background: '#fff',
        border: `1px solid ${color}`,
        color,
        boxShadow: '0 2px 8px rgba(0,0,0,.15)',
      }}
    >
      backend: {label} ({SERVER_BASE})
    </div>
  )
}
