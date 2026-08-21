export function buildInviteLink(origin, code) {
  return `${origin}/?friend=${code}`
}

export function parseInviteCodeFromSearch(search) {
  return new URLSearchParams(search).get('friend')
}

export function removeInviteCodeFromSearch(search) {
  const params = new URLSearchParams(search)
  params.delete('friend')
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}
