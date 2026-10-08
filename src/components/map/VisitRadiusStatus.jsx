import { VISIT_RADIUS_M, visitRadiusMessage, visitRadiusStatus } from '../../lib/visitRadius'

// 상세 카드·기록 모달에서 "인증 범위 안/밖"을 미리 알려주는 한 줄.
// 서버는 신뢰 좌표로 다시 판정하므로 여기 문구는 예상치다.
export default function VisitRadiusStatus({ bakery, myLocation }) {
  const { status, coords } = myLocation
  const result = visitRadiusStatus(coords, bakery)

  let text
  let tone = 'muted'
  if (result) {
    text = visitRadiusMessage(result)
    tone = result.inside ? 'inside' : 'outside'
  } else if (status === 'loading') {
    text = '내 위치를 확인하는 중…'
  } else if (status === 'denied') {
    text = `위치 권한을 허용하면 인증 범위(${VISIT_RADIUS_M}m) 안인지 알려드려요`
  } else if (status === 'unavailable' || status === 'unsupported') {
    text = '현재 위치를 확인하지 못했어요'
  } else {
    return null
  }

  return (
    <p className={`visit-radius-status visit-radius-${tone}`} role="status" aria-live="polite">
      {result?.inside ? '✓ ' : '📍 '}
      {text}
    </p>
  )
}
