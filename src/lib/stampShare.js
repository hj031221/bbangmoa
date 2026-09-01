import { supabase } from './supabase'
import { buildStampCardSvg, rasterizeStampCard } from './stampShareImage'

// ensure_share_code RPC 로 내 공유 URL 을 만든다. 최초 호출 경합으로 unique 충돌이 나면
// 1회 재조회로 복구한다.
async function resolveShareUrl() {
  if (!supabase) throw new Error('supabase 미설정')
  const { data, error } = await supabase.rpc('ensure_share_code')
  if (!error && data) return `${window.location.origin}/s/${data}`

  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (uid) {
    const { data: row } = await supabase
      .from('profiles')
      .select('share_code')
      .eq('user_id', uid)
      .maybeSingle()
    if (row?.share_code) return `${window.location.origin}/s/${row.share_code}`
  }
  throw error || new Error('공유 코드를 만들지 못했어요.')
}

export async function shareStampCard({ nickname, stamp, targetPerDistrict }) {
  try {
    const shareUrl = await resolveShareUrl()
    const svg = buildStampCardSvg({ nickname, stamp, targetPerDistrict })
    const blob = await rasterizeStampCard(svg)
    const file = new File([blob], 'daejeon-bread-stamp.png', { type: 'image/png' })

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          text: '대전 빵 스탬프 도전 중! 나도 해볼래?',
          url: shareUrl,
        })
        return { ok: true, mode: 'share' }
      } catch (err) {
        if (err?.name === 'AbortError') return { ok: false, mode: 'cancel' }
        throw err
      }
    }

    // 폴백: PNG 다운로드 + 링크 복사 시도
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
    try {
      await navigator.clipboard?.writeText(shareUrl)
    } catch {
      /* 클립보드 실패는 무시 */
    }
    return { ok: true, mode: 'download' }
  } catch (error) {
    console.error('[스탬프공유]', error)
    return { ok: false, error }
  }
}
