import PreviewChevron from './PreviewChevron'

// 마이페이지 홈 4번째 컬럼 자리표시자. 친구 기능 실제 구현은 이슈 #24.
export default function FriendsPreview({ onExpand }) {
  return (
    <div className="mypage-preview-panel mypage-preview-panel-disabled">
      <button type="button" className="mypage-preview-header" onClick={onExpand} aria-disabled="true">
        <span className="mypage-preview-icon" aria-hidden="true">👥</span>
        <span className="mypage-preview-title">친구목록</span>
        <PreviewChevron />
      </button>
      <div className="mypage-preview-body">
        <p className="mypage-preview-empty">친구 기능은 준비 중이에요.</p>
      </div>
    </div>
  )
}
