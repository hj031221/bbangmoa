import { useFriends } from '../../hooks/useFriends'
import PreviewChevron from './PreviewChevron'
import { FriendsIcon } from './PreviewIcons'

// 마이페이지 홈 미리보기 카드. 친구 수 + 이름 몇 개, 받은 요청이 있으면 헤더에 배지로 표시.
export default function FriendsPreview({ onExpand }) {
  const { friends, incomingRequests } = useFriends()

  return (
    <div className="mypage-preview-panel">
      <button type="button" className="mypage-preview-header" onClick={onExpand}>
        <span className="mypage-preview-icon-badge" aria-hidden="true">
          <FriendsIcon />
        </span>
        <span className="mypage-preview-title">친구목록</span>
        {incomingRequests.length > 0 && (
          <span className="mypage-preview-badge">{incomingRequests.length}</span>
        )}
        <PreviewChevron />
      </button>
      <div className="mypage-preview-body">
        {friends.length === 0 ? (
          <p className="mypage-preview-empty">아직 추가한 친구가 없어요.</p>
        ) : (
          <div className="mypage-preview-friend-chips">
            {friends.slice(0, 4).map((f) => (
              <span key={f.id} className="mypage-preview-friend-chip">
                {f.nickname}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
