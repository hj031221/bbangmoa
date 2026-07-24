import { useEffect, useState } from 'react'
import {
  fetchTourBakeries,
  fetchKakaoBakeries,
  mergeBakeries,
  tourEnabled,
  kakaoLocalEnabled,
} from '../api'
import { normalizeKakao } from '../api/normalize'
import { recommend } from '../lib/recommend'
import { SAMPLE_BAKERIES } from '../data/sampleBakeries'

// 빵집 데이터 파이프라인 훅.
//   (관광공사 + 카카오) 병합 → 구(district) 필터 → 추천 점수 적용 → 정렬된 Bakery[] 반환
//
// 반환:
//   bakeries  : 추천순 정렬된 Bakery[]
//   loading   : 로딩 여부
//   error     : 에러 객체 | null
//   source    : 'api' | 'sample'  (키 미설정 시 sample 폴백)
export function useBakeries({ regionId, answers, district }) {
  const [raw, setRaw] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('api')

  // 데이터 fetch 는 지역이 바뀔 때만. (추천 정렬은 아래에서 answers 로 매번 재계산)
  useEffect(() => {
    let alive = true
    const anyKey = tourEnabled() || kakaoLocalEnabled()

    if (!anyKey) {
      setRaw(SAMPLE_BAKERIES)
      setSource('sample')
      setLoading(false)
      return
    }

    // 같은 regionId 재방문(설문→지도→뒤로→지도) 시 카카오 ~57회 재호출 방지
    if (mergedCache.has(regionId)) {
      setRaw(mergedCache.get(regionId))
      setSource('api')
      setLoading(false)
      console.log(`[bakeries] 캐시 적중 (${regionId}) — 재호출 생략`)
      return
    }

    setLoading(true)
    setSource('api')
    const t0 = performance.now()
    Promise.all([
      fetchTourBakeries(regionId).catch(() => []),
      fetchKakaoBakeries(regionId).catch(() => []),
    ])
      .then(([tour, kakao]) => {
        if (!alive) return
        const merged = mergeBakeries(tour, kakao)
        console.log(`[bakeries] 로드 ${Math.round(performance.now() - t0)}ms`)
        logBakeryStats({ tour, kakao, merged })
        // 둘 다 0건이면 폴백
        if (merged.length === 0) {
          setRaw(SAMPLE_BAKERIES)
          setSource('sample')
        } else {
          mergedCache.set(regionId, merged)
          setRaw(merged)
          setSource('api')
        }
      })
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [regionId])

  // 구 필터 + 설문 응답 기반 추천 정렬 (fetch 없이 재계산)
  const filtered = district ? raw.filter((b) => (b.address || '').includes(district)) : raw
  const bakeries = recommend(filtered, answers).slice(0, MAX_RESULTS)

  return { bakeries, loading, error, source }
}

// 지도/리스트에 노출할 최대 추천 개수 (너무 많으면 오히려 선택이 어려워져 상위 N개만 노출)
const MAX_RESULTS = 10

// regionId → 병합된 Bakery[] 모듈 캐시 (세션 내 재호출 방지)
const mergedCache = new Map()

// 수집/제거후/구별 분포 로그 (밀도 확장 검증용)
const DISTRICTS = ['동구', '중구', '서구', '유성구', '대덕구']
function logBakeryStats({ tour, kakao, merged }) {
  const collected = tour.length + kakao.length
  const dist = Object.fromEntries(DISTRICTS.map((d) => [d, 0]))
  let etc = 0
  for (const b of merged) {
    const d = DISTRICTS.find((x) => (b.address || '').includes(x))
    if (d) dist[d] += 1
    else etc += 1
  }
  console.log(
    `[bakeries] 수집 ${collected}건 (tour ${tour.length} + kakao ${kakao.length}) → 중복제거 후 ${merged.length}곳`,
  )
  console.log('[bakeries] 구별 분포', { ...dist, 기타: etc })
}

// (참고) 카카오 normalize 를 외부에서도 쓸 수 있게 재노출
export { normalizeKakao }
