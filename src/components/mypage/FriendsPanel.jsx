import { useState } from 'react'
import { useFriends } from '../../hooks/useFriends'

// 마이페이지 친구목록 전체 화면. 코드로 요청 보내기 + 받은/보낸 요청 + 친구 목록.
// 친구를 선택하면 onSelectFriend({ userId, nickname }) 로 상세(읽기 전용) 화면으로 넘어간다.
export default function FriendsPanel({ onBack, onSelectFriend }) {
  const {
    friendCode,
    friends,
    incomingRequests,
    outgoingRequests,
    sendRequestByCode,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeFriend,
  } = useFriends()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setSending(true)
    const { error } = await sendRequestByCode(code)
    setSending(false)
    setMessage(error || '친구 요청을 보냈어요.')
    if (!error) setCode('')
  }

  return (
    <div className="mypage-panel">
      <div className="mypage-panel-header">
        <button type="button" className="mypage-back" onClick={onBack}>
          ‹
        </button>
        <h3>친구목록{friends.length > 0 && ` (${friends.length}명)`}</h3>
      </div>

      <form className="friend-code-form" onSubmit={submit}>
        <input
          className="mypage-nickname-input"
          placeholder="친구코드 입력 (예: AB3D9F2K)"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setMessage('')
          }}
          maxLength={8}
        />
        <button type="submit" className="primary-btn" disabled={sending}>
          {sending ? '보내는 중…' : '친구 추가'}
        </button>
      </form>
      {message && <p className="friend-form-message">{message}</p>}
      {friendCode && <p className="friend-my-code">내 친구코드: {friendCode}</p>}

      {incomingRequests.length > 0 && (
        <section className="friend-section">
          <h4>받은 요청</h4>
          <ul className="friend-request-list">
            {incomingRequests.map((r) => (
              <li key={r.id} className="friend-request-item">
                <span>{r.nickname}</span>
                <div className="friend-request-actions">
                  <button
                    type="button"
                    className="save-btn saved"
                    onClick={async () => {
                      const { error } = await acceptRequest(r.id)
                      if (error) setMessage(error)
                    }}
                  >
                    수락
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={async () => {
                      const { error } = await rejectRequest(r.id)
                      if (error) setMessage(error)
                    }}
                  >
                    거절
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoingRequests.length > 0 && (
        <section className="friend-section">
          <h4>보낸 요청</h4>
          <ul className="friend-request-list">
            {outgoingRequests.map((r) => (
              <li key={r.id} className="friend-request-item">
                <span className="friend-request-pending">{r.nickname} · 수락 대기중</span>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={async () => {
                    const { error } = await cancelRequest(r.id)
                    if (error) setMessage(error)
                  }}
                >
                  취소
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="friend-section">
        <h4>친구</h4>
        {friends.length === 0 ? (
          <p className="saved-empty">아직 친구가 없어요.</p>
        ) : (
          <ul className="friend-list">
            {friends.map((f) => (
              <li key={f.id} className="friend-list-item">
                <button
                  type="button"
                  className="friend-list-item-btn"
                  onClick={() => onSelectFriend({ userId: f.userId, nickname: f.nickname })}
                >
                  <span className="friend-avatar" aria-hidden="true">
                    {f.nickname?.[0] || '?'}
                  </span>
                  {f.nickname}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={async () => {
                    const { error } = await removeFriend(f.id)
                    if (error) setMessage(error)
                  }}
                >
                  친구 끊기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
