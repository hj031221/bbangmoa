// 이슈 #69 — bakery_id 로 서버가 신뢰하는 좌표를 확보해 bakery_coords 에 upsert 한다.
// og-stamp 와 같은 패턴: Deno.env.get + 원시 fetch + PostgREST 직접 호출(전용 클라이언트 미도입).
//
// 필요한 시크릿:  KAKAO_REST_KEY, TOUR_API_KEY   (supabase secrets set 으로 등록)
// 자동 주입:      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { DAEJEON_BBOX, parseBakeryId, pickKakaoMatch, pickTourCoord } from './coordMatch.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const KAKAO_REST_KEY = Deno.env.get('KAKAO_REST_KEY') ?? ''
const TOUR_API_KEY = Deno.env.get('TOUR_API_KEY') ?? ''

// 대전 rect (Kakao 규약: "minLng,minLat,maxLng,maxLat"). coordMatch.DAEJEON_BBOX 에서 파생 —
// 손으로 관리하는 사본을 만들지 않는다. 결과 문자열은 "127.25,36.18,127.56,36.5".
const { minLng, minLat, maxLng, maxLat } = DAEJEON_BBOX
const DAEJEON_RECT = `${minLng},${minLat},${maxLng},${maxLat}`

// CORS: 브라우저는 supabase.functions.invoke 로 커스텀 헤더 + application/json 을 보내
// preflight OPTIONS 를 유발한다. Supabase Edge Functions 는 CORS 를 자동 주입하지 않으므로
// 여기서 직접 응답한다. 모든 응답에 Access-Control-Allow-Origin 을 실어야 브라우저가 본문을 읽는다.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 항상 200 { resolved: boolean } + CORS. 던지지 않는다.
const reply = (resolved: boolean) => Response.json({ resolved }, { headers: CORS })

// verify_jwt = true 는 서명만 검증한다. 클라 번들에 실린 공개 anon 키도 유효한 서명 JWT 라
// 익명 호출자가 서버 Kakao/관광공사 쿼터를 태우고 bakery_coords 를 쓸 수 있다. 플랫폼이 이미
// 서명을 확인했으므로 payload 의 role 확인은 안전하다. (Base64URL 정규화: -/_ → +// )
function jwtRole(authHeader: string | null): string | null {
  try {
    const part = (authHeader ?? '').replace(/^Bearer\s+/i, '').split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)?.role ?? null
  } catch {
    return null
  }
}

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
  // preflight 는 플랫폼이 JWT 없이 통과시키므로 auth 확인보다 먼저 처리하는 게 맞다.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // verify_jwt 는 서명만 본다 — role 이 authenticated 가 아니면(anon 키 등) 거부.
  if (jwtRole(req.headers.get('Authorization')) !== 'authenticated') return reply(false)

  let body: { bakery_id?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return reply(false)
  }

  const bakeryId = typeof body?.bakery_id === 'string' ? body.bakery_id : ''
  const parsed = parseBakeryId(bakeryId)
  if (!parsed) return reply(false)

  // canonical id: 캐시/upsert/저장 키를 '{source}:{nativeId}' 로 통일한다. 패딩된 변형
  // (' kakao:1', 'kakao:1 ')이 각각 다른 캐시 행 + 다른 verified 슬롯이 되는 것을 막는다.
  const canonicalId = `${parsed.source}:${parsed.nativeId}`

  try {
    if (await cacheHas(canonicalId)) return reply(true)

    const coord =
      parsed.source === 'tour'
        ? await resolveTour(parsed.nativeId)
        : await resolveKakao(parsed.nativeId, typeof body?.name === 'string' ? body.name : '')

    if (!coord) return reply(false)

    const ok = await upsertCoord(canonicalId, coord, parsed.source)
    return reply(ok)
  } catch (err) {
    console.error('[resolve-bakery-coords] 좌표 해석 실패', err)
    return reply(false)
  }
}

export default { fetch: handler }
