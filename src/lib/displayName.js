// 표시용 이름 우선순위: 닉네임(직접 설정) > OAuth full_name > OAuth name > email > 기본값.
// AuthMenu(상단 메뉴)와 MyPage(프로필 카드) 양쪽에서 동일하게 사용한다.
export function getDisplayName(user) {
  if (!user) return null
  return (
    user.user_metadata?.nickname ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    '내 계정'
  )
}
