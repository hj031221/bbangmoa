const escapeAttribute = (value) =>
  String(value).replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  )

const replaceMeta = (html, property, content, attribute = 'property') => {
  const tag = `<meta ${attribute}="${property}" content="${escapeAttribute(content)}" />`
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${property}["'][^>]*>`, 'i')
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

export default async function handler(request, response) {
  const rawCode = Array.isArray(request.query.code) ? request.query.code[0] : request.query.code
  const code = String(rawCode || '').trim().toUpperCase()
  const safeCode = /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : ''

  const forwardedHost = String(request.headers['x-forwarded-host'] || request.headers.host || '')
    .split(',')[0]
    .trim()
  const forwardedProto = String(request.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
  const publicOrigin = `${forwardedProto === 'http' ? 'http' : 'https'}://${forwardedHost}`
  const deploymentOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : publicOrigin
  const shareUrl = `${publicOrigin}/s/${encodeURIComponent(safeCode || code)}`

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const ogImage = supabaseUrl && safeCode
    ? `${supabaseUrl}/functions/v1/og-stamp?code=${encodeURIComponent(safeCode)}`
    : `${publicOrigin}/og-stamp-default.png`

  try {
    const indexResponse = await fetch(`${deploymentOrigin}/index.html`, {
      headers: { Accept: 'text/html' },
    })
    if (!indexResponse.ok) throw new Error(`index.html 응답 ${indexResponse.status}`)

    let html = await indexResponse.text()
    html = replaceMeta(html, 'og:url', shareUrl)
    html = replaceMeta(html, 'og:image', ogImage)
    html = replaceMeta(html, 'og:image:secure_url', ogImage)
    html = replaceMeta(html, 'og:image:type', 'image/png')
    html = replaceMeta(html, 'og:image:width', '1200')
    html = replaceMeta(html, 'og:image:height', '630')
    html = replaceMeta(html, 'og:image:alt', '대전 5개 구 빵집 방문 스탬프 카드')
    html = replaceMeta(html, 'twitter:image', ogImage, 'name')

    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
    return response.status(200).send(html)
  } catch (error) {
    console.error('[share-page] index.html 메타 주입 실패', error)
    response.statusCode = 307
    response.setHeader('Location', '/')
    return response.end()
  }
}
