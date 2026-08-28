// 출발 위치 프리셋 칩 아이콘. FeaturesSection 등과 같은 팔레트(#F97658 코랄·#FFB94A 골드·
// #FFF4C5 크림·#705945 브라운)로 통일 — 이모지 대신 브랜드 톤 SVG 픽토그램을 쓴다.

export function TrainIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {/* 정면 열차 + 아래로 벌어지는 레일. 작은 출발지 칩에서도 버스와 확실히 구분된다. */}
      <path d="M19,7 L24,3 L29,7" fill="none" stroke="#705945" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14,7 H34" stroke="#705945" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M14,8.5 C17.5,6.8 21,6 24,6 C27,6 30.5,6.8 34,8.5 C37,9.9 39,12.8 39,16 V33 C39,36 36.6,38.5 33.5,38.5 H14.5 C11.4,38.5 9,36 9,33 V16 C9,12.8 11,9.9 14,8.5 Z"
        fill="#F97658"
      />
      <rect x="13" y="12" width="22" height="11" rx="4" fill="#FFF4C5" stroke="#705945" strokeWidth="1.8" />
      <path d="M24,12 V23" stroke="#E2C1A3" strokeWidth="1.6" />
      <path d="M10.5,28 H37.5" stroke="#FFB94A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="32.5" r="2.4" fill="#FFF4C5" />
      <circle cx="32" cy="32.5" r="2.4" fill="#FFF4C5" />
      <path d="M15,38.5 L9,46 M33,38.5 L39,46 M12,42 H36 M8,46 H40" fill="none" stroke="#705945" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function BusIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M4,16 C4,12.7 6.7,10 10,10 H37 C41.4,10 44,13.2 44,17.5 V33 H4 Z" fill="#FFB94A" />
      <path d="M8,14 H35 C38.8,14 40.5,16.1 40.5,20 H8 Z" fill="#FFF4C5" stroke="#705945" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16,14 V20 M24,14 V20 M32,14 V20" stroke="#E2C1A3" strokeWidth="1.6" />
      <rect x="34" y="22.5" width="6.5" height="10.5" rx="1.5" fill="#F97658" />
      <path d="M4,27 H33" stroke="#F97658" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="12" cy="36" r="5" fill="#705945" />
      <circle cx="36" cy="36" r="5" fill="#705945" />
      <circle cx="12" cy="36" r="2" fill="#FFF4C5" />
      <circle cx="36" cy="36" r="2" fill="#FFF4C5" />
      <path d="M2,41 H46" stroke="#E2C1A3" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function CityHallIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24,4 V9 M24,4 H33 L30,7 H24" fill="#F97658" stroke="#F97658" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="17" y="9" width="14" height="31" rx="3" fill="#F97658" />
      <rect x="5" y="18" width="12" height="22" rx="2.5" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="2" />
      <rect x="31" y="18" width="12" height="22" rx="2.5" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="2" />
      <circle cx="24" cy="16" r="3.2" fill="#FFF4C5" />
      <path d="M24,14 V16 L25.5,17" fill="none" stroke="#705945" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="21" y="28" width="6" height="12" rx="3" fill="#FFF4C5" />
      <path d="M9,24 H13 M9,30 H13 M35,24 H39 M35,30 H39" stroke="#705945" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="4" y="40" width="40" height="4" rx="2" fill="#705945" />
    </svg>
  )
}

export function SkylineIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="38" cy="9" r="5" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="2" />
      <rect x="4" y="23" width="11" height="19" rx="2.5" fill="#E2C1A3" />
      <path d="M18,12 H30 V42 H18 Z" fill="#F97658" />
      <path d="M20,12 L24,7 L28,12" fill="#FFB94A" />
      <rect x="33" y="18" width="11" height="24" rx="2.5" fill="#FFB94A" />
      <path d="M8,28 H11 M8,34 H11 M22,17 H26 M22,23 H26 M22,29 H26 M22,35 H26 M37,24 H40 M37,30 H40 M37,36 H40" stroke="#FFF4C5" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4,42 H44" stroke="#705945" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M7,42 C7,38.5 9.3,36 12,36 C14.7,36 17,38.5 17,42" fill="#F97658" />
    </svg>
  )
}

export function MapPickIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M5,13 L17.5,9 L30.5,13 L43,9 V35 L30.5,39 L17.5,35 L5,39 Z" fill="#FFF4C5" stroke="#FFB94A" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M17.5,9 V35 M30.5,13 V39" stroke="#FFB94A" strokeWidth="2" strokeLinecap="round" />
      <path d="M25,8 C20.6,8 17,11.6 17,16 C17,21.5 23.5,27 24.3,27.7 C24.7,28 25.3,28 25.7,27.7 C26.5,27 33,21.5 33,16 C33,11.6 29.4,8 25,8 Z" fill="#F97658" />
      <circle cx="25" cy="16" r="3.2" fill="#FFF4C5" />
      <path d="M9,31 C13,27 17,30 20,27 M33,31 C36,28 38,29 40,26" fill="none" stroke="#705945" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 3" />
    </svg>
  )
}

export const LOCATION_ICONS = {
  train: TrainIcon,
  bus: BusIcon,
  cityhall: CityHallIcon,
  skyline: SkylineIcon,
}
