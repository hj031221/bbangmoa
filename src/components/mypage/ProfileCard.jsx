import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFriends } from '../../hooks/useFriends'
import { getDisplayName } from '../../lib/displayName'
import { getAvatarUrl } from '../../lib/avatarUrl'
import { buildInviteLink } from '../../lib/inviteLink'

// 마이페이지 왼쪽 프로필 카드. 아바타 이미지 업로드(갤러리/파일) + 닉네임 편집.
// 아바타는 avatars 버킷 {uid}/avatar.jpg 에 저장되고 user_metadata.custom_avatar_url(자기 화면 원본) +
// profiles.avatar_url(친구 화면 미러) 에 URL 이 미러링된다. getAvatarUrl 이 최우선으로 읽는다.
// 사진/닉네임 변경은 편집 모드에서 임시 상태로만 두고 "저장" 버튼에서 함께 커밋한다.
export default function ProfileCard() {
  const { user, updateNickname, updateAvatar, removeAvatar, syncAvatarMirror } = useAuth()
  const { friendCode } = useFriends()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [mirrorWarning, setMirrorWarning] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingRemove, setPendingRemove] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)
  const [copied, setCopied] = useState('') // 'code' | 'link' | ''
  const [copyError, setCopyError] = useState('')
  const copiedTimeoutRef = useRef(null)

  const name = getDisplayName(user)
  const initial = name?.[0] || '?'
  const savedAvatarUrl = getAvatarUrl(user)

  // 편집 모드 미리보기 우선순위: 새로 고른 파일 → 제거 예약 → 저장된 아바타 → 이니셜
  const shownAvatarUrl = pendingFile ? previewUrl : pendingRemove ? null : savedAvatarUrl

  // previewUrl 은 값이 바뀌거나 언마운트될 때 해제한다.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // 복사 결과(성공 라벨/실패 메시지)는 같은 타이머 하나로만 정리한다.
  const showCopied = (which) => {
    setCopied(which)
    setCopyError('')
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
    copiedTimeoutRef.current = setTimeout(() => setCopied(''), 1500)
  }
  const showCopyError = () => {
    setCopied('')
    setCopyError('복사에 실패했어요.')
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
    copiedTimeoutRef.current = setTimeout(() => setCopyError(''), 1500)
  }

  const clearPending = () => {
    setPendingFile(null)
    setPendingRemove(false)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const startEdit = () => {
    setDraft(name === '내 계정' ? '' : name)
    setFormError('')
    clearPending()
    setEditing(true)
  }

  const cancelEdit = () => {
    clearPending()
    setFormError('')
    setEditing(false)
  }

  const pickFile = () => fileInputRef.current?.click()

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 고를 수 있게 초기화
    if (!file) return
    setFormError('')
    setPendingRemove(false)
    setPendingFile(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const markRemove = () => {
    setFormError('')
    setPendingFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPendingRemove(true)
  }

  const retryMirror = async () => {
    setRetrying(true)
    const { error } = await syncAvatarMirror()
    setRetrying(false)
    if (!error) setMirrorWarning(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = draft.trim()
    const nickChanged = !!trimmed && trimmed !== name
    const photoChanged = !!pendingFile || pendingRemove
    // 닉네임이 이미 있는 사용자는 빈 값으로 지울 수 없다(폼이 조용히 닫히며 초안이 버려지는 것 방지).
    // 닉네임 없는 계정은 닉네임 입력 없이 사진만 저장할 수 있다(닉네임 단계 건너뜀).
    if (!trimmed && user?.user_metadata?.nickname) {
      setFormError('닉네임은 비울 수 없어요.')
      return
    }
    if (!nickChanged && !photoChanged) {
      setEditing(false)
      return
    }
    setSaving(true)
    setFormError('')

    // 1) 사진 단계 — pending 이 있을 때만. 성공해야 닉네임 단계로 넘어간다.
    if (photoChanged) {
      const res = pendingFile ? await updateAvatar(pendingFile) : await removeAvatar()
      if (res?.error && res.partial !== 'mirror') {
        console.error('[프로필] 사진 저장 실패', res.error)
        setSaving(false)
        setFormError('사진을 저장하지 못했어요. 잠시 후 다시 시도해주세요.')
        return // pending 유지 → 재시도 가능
      }
      clearPending()
      setMirrorWarning(res?.partial === 'mirror')
    }

    // 2) 닉네임 단계 — 값이 바뀐 경우에만.
    if (nickChanged) {
      const { error } = await updateNickname(trimmed)
      if (error) {
        console.error('[프로필] 닉네임 변경 실패', error)
        setSaving(false)
        setFormError('닉네임을 저장하지 못했어요.')
        return
      }
    }

    setSaving(false)
    setEditing(false)
  }

  const copyCode = async () => {
    if (!friendCode) return
    try {
      await navigator.clipboard.writeText(friendCode)
    } catch (err) {
      console.error('[프로필] 코드 복사 실패', err)
      showCopyError()
      return
    }
    showCopied('code')
  }

  const copyLink = async () => {
    if (!friendCode) return
    try {
      await navigator.clipboard.writeText(buildInviteLink(window.location.origin, friendCode))
    } catch (err) {
      console.error('[프로필] 초대 링크 복사 실패', err)
      showCopyError()
      return
    }
    showCopied('link')
  }

  const avatarUrlToShow = editing ? shownAvatarUrl : savedAvatarUrl

  return (
    <div className="mypage-profile">
      <div className="mypage-avatar" aria-hidden="true">
        {avatarUrlToShow ? <img src={avatarUrlToShow} alt="" /> : initial}
      </div>
      {editing ? (
        <form className="mypage-nickname-form" onSubmit={submit}>
          <div className="mypage-avatar-actions">
            <button type="button" className="ghost-btn" onClick={pickFile} disabled={saving}>
              사진 바꾸기
            </button>
            {(savedAvatarUrl || pendingFile) && !pendingRemove && (
              <button type="button" className="ghost-btn" onClick={markRemove} disabled={saving}>
                사진 제거
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onFileChange}
            />
          </div>
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
            <button type="button" className="ghost-btn" onClick={cancelEdit} disabled={saving}>
              취소
            </button>
          </div>
          {formError && <p className="friend-form-message">{formError}</p>}
        </form>
      ) : (
        <>
          <h3 className="mypage-name">{name}</h3>
          <button type="button" className="ghost-btn" onClick={startEdit}>
            프로필 편집
          </button>
        </>
      )}
      {mirrorWarning && (
        <p className="friend-form-message">
          친구에게 보이는 데 잠시 지연될 수 있어요.{' '}
          <button type="button" className="ghost-btn" onClick={retryMirror} disabled={retrying}>
            {retrying ? '재시도 중…' : '재시도'}
          </button>
        </p>
      )}
      {friendCode && (
        <div className="mypage-friend-code">
          <span className="mypage-friend-code-label">친구코드 {friendCode}</span>
          <div className="mypage-friend-code-actions">
            <button type="button" className="ghost-btn" onClick={copyCode}>
              {copied === 'code' ? '복사됨!' : '코드 복사'}
            </button>
            <button type="button" className="ghost-btn" onClick={copyLink}>
              {copied === 'link' ? '복사됨!' : '초대 링크 복사'}
            </button>
          </div>
          {copyError && <p className="friend-form-message">{copyError}</p>}
        </div>
      )}
    </div>
  )
}
