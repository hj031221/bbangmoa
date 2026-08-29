// user 객체 또는 친구 목록 entry 에서 아바타 이미지 URL 하나를 뽑는다.
// 먼저 우리가 업로드한 아바타(user_metadata.custom_avatar_url — 자기 화면 원본)를 확인하고,
// 없으면 최상위 avatar_url 을 방어적 폴백으로 쓴다(넘어온 profile row 형태 대비).
// custom_avatar_url 을 쓰는 이유: GoTrue 가 매 로그인마다 OAuth 제공자 사진을
// user_metadata.avatar_url 로 재병합하므로 그 키에는 우리 URL 을 둘 수 없다.
// 값이 없으면 null → 호출부가 이니셜로 폴백. displayName.js 와 같은 우선순위 폴백 패턴.
export function getAvatarUrl(userOrProfile) {
  if (!userOrProfile) return null
  return userOrProfile.user_metadata?.custom_avatar_url || userOrProfile.avatar_url || null
}

// profiles.avatar_url(storage 객체 경로) + avatar_version 으로 남에게 보여줄 공개 URL 을 조립한다
// (useFriends/useDiaryComments 공용 — avatar_url 은 전체 URL 이 아니라 경로만 저장한다: schema.sql
// CHECK 제약, avatar_version 은 경로가 {uid}/avatar.jpg 로 고정이라 필요한 캐시버스터).
export function buildProfileAvatarUrl(supabase, { avatar_url, avatar_version } = {}) {
  if (!avatar_url) return null
  return `${supabase.storage.from('avatars').getPublicUrl(avatar_url).data.publicUrl}?v=${avatar_version ?? 0}`
}
