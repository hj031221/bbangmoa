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
//   (관광공사 + 카카오) 병합 → 추천 점수 적용 → 정렬된 Bakery[] 반환
//
// 반환:
//   bakeries  : 추천순 정렬된 Bakery[]
//   loading   : 로딩 여부
//   error     : 에러 객체 | null
//   source    : 'api' | 'sample'  (키 미설정 시 sample 폴백)
export function useBakeries({ regionId, answers }) {
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

    setLoading(true)
    setSource('api')
    Promise.all([
      fetchTourBakeries(regionId).catch(() => []),
      fetchKakaoBakeries(regionId).catch(() => []),
    ])
      .then(([tour, kakao]) => {
        if (!alive) return
        const merged = mergeBakeries(tour, kakao)
        // 둘 다 0건이면 폴백
        if (merged.length === 0) {
          setRaw(SAMPLE_BAKERIES)
          setSource('sample')
        } else {
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

  // 설문 응답 기반 추천 정렬 (fetch 없이 재계산)
  const bakeries = recommend(raw, answers)

  return { bakeries, loading, error, source }
}

// (참고) 카카오 normalize 를 외부에서도 쓸 수 있게 재노출
export { normalizeKakao }
