import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { normalizeFriendCode } from '../lib/friendCode'

// 상호 수락 기반 친구 요청/목록. friend_requests 한 테이블로 pending→accepted 를 관리하고,
// 닉네임은 profiles 테이블에서 별도로 조회해 합친다(PostgREST 로 같은 테이블을 requester/addressee
// 두 역할로 한 번에 조인하기 까다로워서, 관계 조회 → 상대 id 목록 → profiles 조회 2단계로 처리).
export function useFriends() {
  const { user } = useAuth()
  const [friendCode, setFriendCode] = useState(null)
  const [friends, setFriends] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    if (!user) {
      setFriendCode(null)
      setFriends([])
      setIncomingRequests([])
      setOutgoingRequests([])
      return
    }
    setLoading(true)

    const { data: profile } = await supabase
      .from('profiles')
      .select('friend_code')
      .eq('user_id', user.id)
      .maybeSingle()
    setFriendCode(profile?.friend_code ?? null)

    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('id, requester_id, addressee_id, status')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (error) {
      console.error('[친구] 목록 조회 실패', error)
      setLoading(false)
      return
    }

    const accepted = requests.filter((r) => r.status === 'accepted')
    const incoming = requests.filter((r) => r.status === 'pending' && r.addressee_id === user.id)
    const outgoing = requests.filter((r) => r.status === 'pending' && r.requester_id === user.id)

    const otherIdOf = (r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id)
    const otherIds = [...new Set([...accepted, ...incoming, ...outgoing].map(otherIdOf))]

    let nicknameById = {}
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nickname')
        .in('user_id', otherIds)
      nicknameById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.nickname]))
    }

    const toEntry = (r) => ({
      id: r.id,
      userId: otherIdOf(r),
      nickname: nicknameById[otherIdOf(r)] || '이름 없음',
    })

    setFriends(accepted.map(toEntry))
    setIncomingRequests(incoming.map(toEntry))
    setOutgoingRequests(outgoing.map(toEntry))
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [user])

  const sendRequestByCode = async (rawCode) => {
    if (!user) return { error: '로그인이 필요해요.' }
    const code = normalizeFriendCode(rawCode)

    const { data: found, error: lookupError } = await supabase.rpc('find_user_by_friend_code', {
      code,
    })
    if (lookupError) {
      console.error('[친구] 코드 조회 실패', lookupError)
      return { error: '잠시 후 다시 시도해주세요.' }
    }
    const target = found?.[0]
    if (!target) return { error: '존재하지 않는 친구코드예요.' }
    if (target.user_id === user.id) return { error: '내 코드는 입력할 수 없어요.' }

    const { data: existing } = await supabase
      .from('friend_requests')
      .select('id, requester_id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${target.user_id}),and(requester_id.eq.${target.user_id},addressee_id.eq.${user.id})`,
      )
      .maybeSingle()

    if (existing) {
      if (existing.status === 'accepted') return { error: '이미 친구예요.' }
      if (existing.requester_id === user.id) return { error: '이미 요청을 보냈어요.' }
      return { error: '상대가 이미 요청을 보냈어요, 받은 요청함을 확인하세요.' }
    }

    const { error: insertError } = await supabase
      .from('friend_requests')
      .insert({ requester_id: user.id, addressee_id: target.user_id })
    if (insertError) {
      console.error('[친구] 요청 실패', insertError)
      return { error: '잠시 후 다시 시도해주세요.' }
    }
    await reload()
    return { error: null }
  }

  const acceptRequest = async (id) => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', id)
    if (error) console.error('[친구] 수락 실패', error)
    await reload()
  }

  const removeRequest = async (id) => {
    const { error } = await supabase.from('friend_requests').delete().eq('id', id)
    if (error) console.error('[친구] 삭제 실패', error)
    await reload()
  }

  return {
    friendCode,
    friends,
    incomingRequests,
    outgoingRequests,
    loading,
    sendRequestByCode,
    acceptRequest,
    rejectRequest: removeRequest,
    cancelRequest: removeRequest,
    removeFriend: removeRequest,
  }
}
