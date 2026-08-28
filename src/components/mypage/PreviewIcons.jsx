// 마이페이지 홈 미리보기 헤더용 아이콘 3종 (시안 17p 컬러 팔레트 하단 아이콘 — 하트/장소 핀/종이).
// PinIcon 은 MarkerLayer.jsx 의 빵집 마커(PIN_D+BREAD_D)와 동일한 실루엣을 그대로 재사용한다.

export function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path
        fill="#F97658"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
  )
}

export function SaveHeartIcon({ filled = false }) {
  return (
    <svg className="save-heart-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.4 4.35 13.3C.2 9.45 2.15 3.2 7.4 3.2c1.9 0 3.55.95 4.6 2.4 1.05-1.45 2.7-2.4 4.6-2.4 5.25 0 7.2 6.25 3.05 10.1L12 20.4Z"
        fill={filled ? '#F29A38' : '#FFF4E2'}
        stroke="#E8842D"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {filled && (
        <path
          d="M7.1 6.5c1.05-.7 2.35-.45 3.05.35"
          fill="none"
          stroke="#FFD59D"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 100.7 124.3" width="14" height="17" aria-hidden="true">
      <path
        fill="#F97658"
        d="M99.78 40.39C97.37 17.71 78.24 0.04 55 0.04 54.54 0.04 54.09 0.04 53.64 0.06 19.84 1.06-.01 38.81 17.47 67.86 26.11 82.23 40.17 105.61 48.41 119.3 51.4 124.28 58.6 124.28 61.59 119.3 70.34 104.75 85.67 79.27 94.08 65.27 98.58 57.8 100.7 49.07 99.78 40.39Z"
      />
      <path
        fill="#fff"
        d="M69.84 30.27C66.68 30.27 63.95 32.13 62.68 34.81 61.41 32.13 58.68 30.27 55.52 30.27 52.34 30.27 49.59 32.16 48.33 34.88 47.08 32.16 44.33 30.27 41.14 30.27 36.77 30.27 33.22 33.82 33.22 38.21L33.22 52.04C33.22 54.72 35.39 56.89 38.06 56.89L72.92 56.89C75.59 56.89 77.76 54.72 77.76 52.04L77.76 38.21C77.76 33.82 74.21 30.27 69.84 30.27Z"
      />
    </svg>
  )
}

export function PaperIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="4" fill="#F97658" />
      <rect x="7.5" y="8" width="9" height="2" rx="1" fill="#fff" />
      <rect x="7.5" y="12" width="9" height="2" rx="1" fill="#fff" />
      <rect x="7.5" y="16" width="6" height="2" rx="1" fill="#fff" />
    </svg>
  )
}

export function FriendsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" fill="#F97658" />
      <circle cx="16.5" cy="9" r="2.7" fill="#F97658" opacity=".78" />
      <path
        fill="#F97658"
        d="M3.5 19c0-3.4 2.45-5.7 5.5-5.7s5.5 2.3 5.5 5.7c0 .55-.45 1-1 1h-9c-.55 0-1-.45-1-1Z"
      />
      <path
        fill="#F97658"
        opacity=".78"
        d="M14.2 14.25c.7-.42 1.5-.65 2.3-.65 2.3 0 4 1.8 4 4.55 0 .47-.38.85-.85.85h-3.7a7.5 7.5 0 0 0-1.75-4.75Z"
      />
    </svg>
  )
}
