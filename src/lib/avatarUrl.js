// user 객체(user_metadata.avatar_url) 또는 친구 목록 entry(avatar_url)에서 아바타 이미지 URL 하나를 뽑는다.
// 값이 없으면 null → 호출부가 이니셜로 폴백. displayName.js 와 같은 우선순위 폴백 패턴.
export function getAvatarUrl(userOrProfile) {
  if (!userOrProfile) return null
  return userOrProfile.user_metadata?.avatar_url || userOrProfile.avatar_url || null
}
