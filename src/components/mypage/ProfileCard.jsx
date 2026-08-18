import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getDisplayName } from '../../lib/displayName'

// 마이페이지 왼쪽 프로필 카드. 아바타는 이니셜 placeholder(이미지 업로드 없음),
// 닉네임만 편집 가능 — user_metadata.nickname 에 저장되고 getDisplayName 이 최우선으로 읽는다.
export default function ProfileCard() {
  const { user, updateNickname } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const name = getDisplayName(user)
  const initial = name?.[0] || '?'

  const startEdit = () => {
    setDraft(name === '내 계정' ? '' : name)
    setEditing(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    setSaving(true)
    const { error } = await updateNickname(trimmed)
    setSaving(false)
    if (error) {
      console.error('[프로필] 닉네임 변경 실패', error)
      return
    }
    setEditing(false)
  }

  return (
    <div className="mypage-profile">
      <div className="mypage-avatar" aria-hidden="true">{initial}</div>
      {editing ? (
        <form className="mypage-nickname-form" onSubmit={submit}>
          <input
            className="mypage-nickname-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <div className="mypage-nickname-actions">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button type="button" className="ghost-btn" onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="mypage-name">{name}</h3>
          <button type="button" className="ghost-btn" onClick={startEdit}>
            프로필 편집
          </button>
        </>
      )}
    </div>
  )
}
