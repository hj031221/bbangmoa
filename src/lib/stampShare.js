import { supabase } from './supabase'
import {
  buildStampCardSvg,
  loadStampCardFontCss,
  loadStampCardLogoDataUrl,
  rasterizeStampCard,
} from './stampShareImage'

const FILE_NAME = 'daejeon-bread-stamp.png'
const SHARE_TEXT = '대전 빵 스탬프 도전 중이에요. 나도 함께 채워볼래요?'

// 공개 링크는 friend_code(친구 추가 토큰)가 아니라 전용 share_code를 쓴다. SNS로 카드를
// 뿌려도 친구 추가 토큰이 함께 노출되지 않게 한다. ensure_share_code()가 지연 생성/조회를
// 맡고(security definer), 비로그인이면 함수가 예외를 던져 이미지 공유만 이어진다.
async function resolveShareUrl() {
  if (!supabase) throw new Error('supabase 미설정')
  const { data: code, error } = await supabase.rpc('ensure_share_code')
  if (error) throw error
  const trimmed = typeof code === 'string' ? code.trim() : ''
  if (trimmed) return `${window.location.origin}/s/${trimmed}`
  throw new Error('공유 코드를 찾지 못했어요.')
}

async function resolveOptionalShareUrl() {
  try {
    return await resolveShareUrl()
  } catch (error) {
    // 이미지 저장은 공개 링크 백엔드와 독립적으로 계속 동작해야 한다.
    console.error('[스탬프공유] 공유 링크 준비 실패 — 이미지 공유만 계속', error)
    return null
  }
}

// 모달이 열린 동안 이미지와 링크를 병렬로 미리 준비한다. 사용자가 버튼을 누른 뒤에는
// navigator.share()를 즉시 호출할 수 있어 transient user activation을 보존한다.
export async function prepareStampShare({ nickname, stamp, targetPerDistrict }) {
  try {
    const fontPromise = loadStampCardFontCss().catch((error) => {
      console.error('[스탬프공유] 사이트 폰트 내장 실패 — 시스템 폰트로 대체', error)
      return ''
    })
    const logoPromise = loadStampCardLogoDataUrl().catch((error) => {
      console.error('[스탬프공유] 로고 내장 실패 — 기본 빵 심볼로 대체', error)
      return ''
    })
    const imagePromise = Promise.all([fontPromise, logoPromise]).then(([fontCss, logoDataUrl]) =>
      rasterizeStampCard(
        buildStampCardSvg({ nickname, stamp, targetPerDistrict, fontCss, logoDataUrl }),
      ),
    )

    const [blob, shareUrl] = await Promise.all([imagePromise, resolveOptionalShareUrl()])
    const file = new File([blob], FILE_NAME, { type: 'image/png' })
    return { ok: true, blob, file, shareUrl }
  } catch (error) {
    console.error('[스탬프공유] 이미지 준비 실패', error)
    return { ok: false, error, shareUrl: null }
  }
}

function downloadFile(prepared) {
  const anchor = document.createElement('a')
  const objectUrl = URL.createObjectURL(prepared.blob)
  anchor.href = objectUrl
  anchor.download = prepared.file?.name || FILE_NAME
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)
}

async function copyShareUrl(shareUrl) {
  if (!shareUrl || !navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(shareUrl)
    return true
  } catch {
    return false
  }
}

export async function sharePreparedStamp(prepared) {
  if (!prepared?.ok || !prepared.file || !prepared.blob) {
    return { ok: false, error: prepared?.error || new Error('공유 이미지를 준비하지 못했어요.') }
  }

  const shareData = {
    files: [prepared.file],
    text: SHARE_TEXT,
    ...(prepared.shareUrl ? { url: prepared.shareUrl } : {}),
  }

  if (navigator.share && navigator.canShare?.(shareData)) {
    try {
      // 이 함수 진입 후 첫 비동기 호출이 share()다. 호출 자체는 사용자 클릭 스택에서 즉시 일어난다.
      await navigator.share(shareData)
      return { ok: true, mode: 'share', shareUrl: prepared.shareUrl }
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, mode: 'cancel' }
      console.error('[스탬프공유] 시스템 공유 실패 — 다운로드로 대체', error)
    }
  }

  downloadFile(prepared)
  const copied = await copyShareUrl(prepared.shareUrl)
  return {
    ok: true,
    mode: 'download',
    copied,
    shareUrl: prepared.shareUrl,
  }
}

// 기존 호출부 호환용. 새 UI는 prepareStampShare()로 미리 준비한 뒤 sharePreparedStamp()를 호출한다.
export async function shareStampCard(args) {
  const prepared = await prepareStampShare(args)
  return sharePreparedStamp(prepared)
}
