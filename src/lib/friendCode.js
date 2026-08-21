// 친구코드 8자리 — 0/O/1/I 등 헷갈리는 문자를 뺀 대문자+숫자 조합(스키마의 generate_friend_code() 와 동일한 문자셋).
const FRIEND_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/

export function normalizeFriendCode(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function isValidFriendCode(code) {
  return FRIEND_CODE_PATTERN.test(code)
}
