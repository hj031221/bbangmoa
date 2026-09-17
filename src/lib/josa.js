// 한글 마지막 글자의 받침 유무로 조사를 고른다. 한글이 아닌 글자로 끝나면 받침 없는 쪽을 쓴다.
// 예: josa('식빵', '이에요', '예요') → '이에요', josa('치아바타', ...) → '예요'
export function hasBatchim(word) {
  const code = String(word ?? '').trimEnd().at(-1)?.charCodeAt(0)
  if (code === undefined || code < 0xac00 || code > 0xd7a3) return false
  return (code - 0xac00) % 28 !== 0
}

export function josa(word, withBatchim, withoutBatchim) {
  return hasBatchim(word) ? withBatchim : withoutBatchim
}
