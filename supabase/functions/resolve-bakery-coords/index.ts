// 이슈 #69 — bakery_id 로 서버가 신뢰하는 좌표를 확보해 bakery_coords 에 upsert 한다.
// og-stamp 와 같은 패턴: Deno.env.get + 원시 fetch + PostgREST 직접 호출(전용 클라이언트 미도입).
//
// 필요한 시크릿:  KAKAO_REST_KEY, TOUR_API_KEY   (supabase secrets set 으로 등록)
// 자동 주입:      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { parseBakeryId, pickKakaoMatch, pickTourCoord } from './coordMatch.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const KAKAO_REST_KEY = Deno.env.get('KAKAO_REST_KEY') ?? ''
const TOUR_API_KEY = Deno.env.get('TOUR_API_KEY') ?? ''

// 대전 rect (Kakao 규약: "minLng,minLat,maxLng,maxLat"). coordMatch.DAEJEON_BBOX 와 같은 값.
const DAEJEON_RECT = '127.25,36.18,127.56,36.5'

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 6000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const restHeaders = () => ({
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
})

async function cacheHas(bakeryId: string): Promise<boolean> {
  const url =
    `${SUPABASE_URL}/rest/v1/bakery_coords` +
    `?bakery_id=eq.${encodeURIComponent(bakeryId)}&select=bakery_id`
  const res = await fetchWithTimeout(url, { headers: restHeaders() })
  if (!res.ok) return false
  const rows = await res.json()
  return Array.isArray(rows) && rows.length > 0
}

async function upsertCoord(
  bakeryId: string,
  coord: { lat: number; lng: number },
  source: string,
): Promise<boolean> {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/bakery_coords`, {
    method: 'POST',
    headers: {
      ...restHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      bakery_id: bakeryId,
      lat: coord.lat,
      lng: coord.lng,
      source,
      fetched_at: new Date().toISOString(),
    }),
  })
  return res.ok
}

async function resolveTour(nativeId: string) {
  const url =
    `https://apis.data.go.kr/B551011/KorService2/detailCommon2` +
    `?serviceKey=${encodeURIComponent(TOUR_API_KEY)}` +
    `&MobileOS=ETC&MobileApp=DaejeonBreadMap&_type=json` +
    `&contentId=${encodeURIComponent(nativeId)}&numOfRows=1&pageNo=1`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return null
  const json = await res.json()
  const item = json?.response?.body?.items?.item
  const first = Array.isArray(item) ? item[0] : item
  return first ? pickTourCoord(first) : null
}

async function resolveKakao(nativeId: string, name: string) {
  if (!name.trim()) return null
  for (let page = 1; page <= 3; page++) {
    const url =
      `https://dapi.kakao.com/v2/local/search/keyword.json` +
      `?query=${encodeURIComponent(name.trim())}&size=15&page=${page}&rect=${DAEJEON_RECT}`
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
    })
    if (!res.ok) return null
    const json = await res.json()
    const hit = pickKakaoMatch(json?.documents, nativeId)
    if (hit) return hit
    if ((json?.meta?.is_end ?? true) === true) break
  }
  return null
}

async function handler(req: Request): Promise<Response> {
  let body: { bakery_id?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ resolved: false })
  }

  const bakeryId = typeof body?.bakery_id === 'string' ? body.bakery_id : ''
  const parsed = parseBakeryId(bakeryId)
  if (!parsed) return Response.json({ resolved: false })

  try {
    if (await cacheHas(bakeryId)) return Response.json({ resolved: true })

    const coord =
      parsed.source === 'tour'
        ? await resolveTour(parsed.nativeId)
        : await resolveKakao(parsed.nativeId, typeof body?.name === 'string' ? body.name : '')

    if (!coord) return Response.json({ resolved: false })

    const ok = await upsertCoord(bakeryId, coord, parsed.source)
    return Response.json({ resolved: ok })
  } catch (err) {
    console.error('[resolve-bakery-coords] 좌표 해석 실패', err)
    return Response.json({ resolved: false })
  }
}

export default { fetch: handler }
