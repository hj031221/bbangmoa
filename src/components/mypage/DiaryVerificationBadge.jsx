export default function DiaryVerificationBadge({ verified }) {
  return (
    <span
      className={verified ? 'diary-verification diary-verification-verified' : 'diary-verification'}
    >
      {verified ? '✓ 인증 방문' : '미인증'}
    </span>
  )
}
