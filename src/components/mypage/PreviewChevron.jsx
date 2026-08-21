// 빵지도(BakeryMapPage)의 뒤로가기 화살표(.result-back svg)와 동일한 모양을 좌우 반전 + 축소해서 재사용.
export default function PreviewChevron() {
  return (
    <svg
      className="mypage-preview-chevron"
      viewBox="0 0 16 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 4 13 14 3 24" />
    </svg>
  )
}
