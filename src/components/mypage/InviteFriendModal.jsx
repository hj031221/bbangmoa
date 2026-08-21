// 초대 링크로 들어왔을 때 뜨는 확인 모달. 코드 조회로 얻은 상대 닉네임만 보여준다.
export default function InviteFriendModal({ nickname, onConfirm, onCancel }) {
  return (
    <div className="invite-modal-backdrop">
      <div className="invite-modal">
        <p className="invite-modal-text">{nickname}님에게 친구 요청을 보낼까요?</p>
        <div className="mypage-nickname-actions">
          <button type="button" className="primary-btn" onClick={onConfirm}>
            요청 보내기
          </button>
          <button type="button" className="ghost-btn" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
