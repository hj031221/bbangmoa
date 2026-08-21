import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { parseInviteCodeFromSearch, removeInviteCodeFromSearch } from '../lib/inviteLink'

const PENDING_KEY = 'bbangmoa_pending_friend_code'

// 초대 링크(?friend=코드)로 들어왔을 때 처리. 라우터가 없는 SPA 라 쿼리 파라미터를 직접 읽는다.
// 로그인 상태면 바로 확인 모달을, 비로그인 상태면 코드를 sessionStorage 에 저장해뒀다가
// 로그인 후(user 값이 바뀌는 시점) 이어서 처리한다.
export function useInviteLink(sendRequestByCode) {
  const { user } = useAuth()
  const [invite, setInvite] = useState(null) // { code, nickname } | null
  const [notice, setNotice] = useState(null)

  const lookupAndPrompt = async (code) => {
    const { data, error } = await supabase.rpc('find_user_by_friend_code', { code })
    const target = !error && data?.[0]
    if (!target) {
      setNotice('유효하지 않은 초대 링크예요.')
      return
    }
    if (target.user_id === user.id) {
      setNotice('내가 만든 링크예요.')
      return
    }
    setInvite({ code, nickname: target.nickname || '이름 없음' })
  }

  useEffect(() => {
    const codeFromUrl = parseInviteCodeFromSearch(window.location.search)
    if (codeFromUrl) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + removeInviteCodeFromSearch(window.location.search),
      )
    }

    if (!user) {
      if (codeFromUrl) {
        sessionStorage.setItem(PENDING_KEY, codeFromUrl)
        setNotice('로그인하면 친구 요청을 보낼 수 있어요.')
      }
      return
    }

    const pending = codeFromUrl || sessionStorage.getItem(PENDING_KEY)
    if (pending) {
      sessionStorage.removeItem(PENDING_KEY)
      lookupAndPrompt(pending)
    }
  }, [user])

  const confirm = async () => {
    if (!invite) return
    const { error } = await sendRequestByCode(invite.code)
    setNotice(error || '친구 요청을 보냈어요.')
    setInvite(null)
  }

  const dismiss = () => setInvite(null)
  const dismissNotice = () => setNotice(null)

  return { invite, notice, confirm, dismiss, dismissNotice }
}
