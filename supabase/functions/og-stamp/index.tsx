import { ImageResponse } from 'npm:@vercel/og@^0'
import React from 'npm:react@^19'

const FONT_REGULAR_URL =
  'https://cdn.jsdelivr.net/gh/fonts-archive/HakgyoansimDunggeunmiso/HakgyoansimDunggeunmiso-R.woff'
const FONT_BOLD_URL =
  'https://cdn.jsdelivr.net/gh/fonts-archive/HakgyoansimDunggeunmiso/HakgyoansimDunggeunmiso-B.woff'

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 6000,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const fontRegularPromise = fetchWithTimeout(FONT_REGULAR_URL)
  .then((response) => response.ok ? response.arrayBuffer() : null)
  .catch(() => null)
const fontBoldPromise = fetchWithTimeout(FONT_BOLD_URL)
  .then((response) => response.ok ? response.arrayBuffer() : null)
  .catch(() => null)

type District = {
  name: string
  completedSlots: number
  target: number
  goalPct: number
  completed: boolean
}

type PublicStamp = {
  nickname: string
  targetPerDistrict: number
  stamp: {
    goalPct: number
    completedSlots: number
    totalSlots: number
    completedDistrictCount: number
    visitedBakeryCount: number
    perDistrict: District[]
  }
}

async function getPublicStamp(code: string): Promise<PublicStamp | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey || !code) return null

  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/get_public_stamp`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_code: code }),
  }, 6000)
  if (!response.ok) return null
  return (await response.json()) as PublicStamp | null
}

function clampPct(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0
}

export default async function handler(request: Request) {
  const url = new URL(request.url)
  const code = (url.searchParams.get('code') || '').trim().toUpperCase()

  let data: PublicStamp | null = null
  try {
    data = await getPublicStamp(code)
  } catch (error) {
    console.error('[og-stamp] 공개 스탬프 조회 실패', error)
  }

  const [regularFont, boldFont] = await Promise.all([fontRegularPromise, fontBoldPromise])
  const fonts = [
    ...(regularFont
      ? [{ name: 'BbangMoa Round', data: regularFont, weight: 400 as const, style: 'normal' as const }]
      : []),
    ...(boldFont
      ? [{ name: 'BbangMoa Round', data: boldFont, weight: 700 as const, style: 'normal' as const }]
      : []),
  ]

  const stamp = data?.stamp
  const goalPct = clampPct(stamp?.goalPct)
  const districts = stamp?.perDistrict ?? [
    { name: '동구', completedSlots: 0, target: 3, goalPct: 0, completed: false },
    { name: '중구', completedSlots: 0, target: 3, goalPct: 0, completed: false },
    { name: '서구', completedSlots: 0, target: 3, goalPct: 0, completed: false },
    { name: '유성구', completedSlots: 0, target: 3, goalPct: 0, completed: false },
    { name: '대덕구', completedSlots: 0, target: 3, goalPct: 0, completed: false },
  ]

  const imageResponse = new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: '#FFF8E9',
        color: '#4C310D',
        fontFamily: 'BbangMoa Round, Apple SD Gothic Neo, sans-serif',
        padding: '54px 64px',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 14, background: '#F97658' }} />
      <div style={{ display: 'flex', flexDirection: 'column', width: 500, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 28, fontWeight: 700 }}>
            <div style={{ width: 18, height: 18, borderRadius: 6, background: '#F97658', marginRight: 12 }} />
            빵모아 · 대전 빵여행 기록
          </div>
          <div style={{ display: 'flex', marginTop: 58, color: '#D9603D', fontSize: 28, fontWeight: 700 }}>
            {data ? `${data.nickname}님의` : '우리의'}
          </div>
          <div style={{ display: 'flex', marginTop: 5, fontSize: 60, lineHeight: 1.1, fontWeight: 700 }}>
            대전 빵 스탬프
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 42 }}>
            <div style={{ display: 'flex', color: '#F97658', fontSize: 150, lineHeight: 0.9, fontWeight: 700, letterSpacing: -8 }}>
              {goalPct}
            </div>
            <div style={{ display: 'flex', color: '#D9603D', fontSize: 54, fontWeight: 700, marginLeft: 12, marginBottom: 8 }}>%</div>
          </div>
          <div style={{ display: 'flex', color: '#A98561', fontSize: 25, marginTop: 18 }}>목표 달성률</div>
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: '#705945' }}>
          {stamp ? `스탬프 ${stamp.completedSlots}/${stamp.totalSlots} · ${stamp.completedDistrictCount}/5개 구 완료` : '대전 5개 구를 빵으로 채워보세요.'}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 530,
          marginLeft: 42,
          padding: '38px 42px',
          borderRadius: 38,
          background: '#F6DBA8',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700 }}>구별 스탬프</div>
          <div style={{ display: 'flex', fontSize: 18, color: '#705945' }}>구마다 {data?.targetPerDistrict ?? 3}곳</div>
        </div>
        {districts.map((district) => {
          const pct = clampPct(district.goalPct)
          return (
            <div key={district.name} style={{ display: 'flex', alignItems: 'center', height: 76, borderTop: '2px solid rgba(112,89,69,.16)' }}>
              <div style={{ display: 'flex', width: 88, fontSize: 23, fontWeight: 700 }}>{district.name}</div>
              <div style={{ display: 'flex', width: 270, height: 16, borderRadius: 8, background: '#FCEFD2', overflow: 'hidden' }}>
                <div style={{ display: 'flex', width: `${pct}%`, height: '100%', borderRadius: 8, background: '#F97658' }} />
              </div>
              <div style={{ display: 'flex', width: 82, justifyContent: 'flex-end', fontSize: 22, fontWeight: 700, color: '#705945' }}>
                {district.completedSlots}/{district.target}
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', marginTop: 'auto', color: '#705945', fontSize: 18, justifyContent: 'flex-end' }}>
          인증 방문 {stamp?.visitedBakeryCount ?? 0}곳
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts,
    },
  )
  imageResponse.headers.set(
    'Cache-Control',
    'public, max-age=300, stale-while-revalidate=3600',
  )
  return imageResponse
}
