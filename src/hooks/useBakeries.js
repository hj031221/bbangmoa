import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchTourBakeries,
  fetchKakaoBakeries,
  tourEnabled,
  kakaoLocalEnabled,
} from '../api'
import { normalizeKakao } from '../api/normalize'
import { recommend } from '../lib/recommend'
import { haversineKm } from '../lib/distance'
import { resolveFetchOutcome } from '../lib/bakeriesFetchOutcome'
import { SAMPLE_BAKERIES } from '../data/sampleBakeries'

// 빵집 데이터 파이프라인 훅.
//   (관광공사 + 카카오) 병합(전 구 자동 루프) → 추천 점수 부여 → origin 가까운 순 정렬 → Bakery[]
//
// 반환:
//   bakeries  : origin 에서 가까운 순 Bakery[] (origin 없으면 추천순)
//   loading   : 로딩 여부
//   error     : 에러 객체 | null
//   source    : 'api' | 'sample'  (키 미설정 시 sample 폴백)
//   reload    : 실패했을 때 다시 가져오기(캐시가 없을 때만 실제 재호출)
export function useBakeries({ regionId, answers, origin, limit = MAX_RESULTS, enabled = true }) {
  const [raw, setRaw] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('api')
  // PR #82 리뷰: 첫 로드가 실패하면(error) raw=[]인 채 loading만 false가 돼, 호출부가 "데이터는
  // 왔는데 0곳"으로 오해했다(리빌 "추천할 OO 맛집 정보가 없어요", 대전한바퀴 빵집 0곳 코스).
  // 실패는 표시하고 다시 시도할 수 있어야 한다 — 이 키를 올리면 fetch effect가 다시 돈다.
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // 데이터 fetch 는 지역이 바뀔 때만. (추천 정렬은 아래에서 answers 로 매번 재계산)
  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setError(null)
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
    // 검증 발견 — 이전엔 각 요청의 실패를 여기서 빈 배열로 바꿔 삼켰다. 그러면 Promise.all이
    // 절대 reject하지 않아 아래 .catch(setError)가 죽은 코드가 되고, 두 요청이 모두 실패해도
    // merged.length === 0 인 "정상적인 0건"과 구분 없이 샘플 데이터로 조용히 대체됐다.
    // allSettled로 실제 실패 여부를 따로 들고 있다가, 결과가 0건인데 요청 중 하나라도 실패했으면
    // (실패 없이 정말 0건인 경우와 구분해) 샘플 대신 에러로 표시해 재시도 경로를 태운다.
    Promise.allSettled([fetchTourBakeries(regionId), fetchKakaoBakeries(regionId)])
      .then(([tourResult, kakaoResult]) => {
        if (!alive) return
        const outcome = resolveFetchOutcome(tourResult, kakaoResult)
        console.log(`[bakeries] 로드 ${Math.round(performance.now() - t0)}ms`)
        logBakeryStats({ tour: outcome.tour, kakao: outcome.kakao, merged: outcome.merged })
        if (outcome.status === 'error') {
          setError(outcome.error)
        } else if (outcome.status === 'sample') {
          setRaw(SAMPLE_BAKERIES)
          setSource('sample')
        } else {
          mergedCache.set(regionId, outcome.merged)
          setRaw(outcome.merged)
          setSource('api')
        }
      })
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [regionId, enabled, reloadKey])

  // 설문 응답 기반 추천 점수 부여 → origin 에서 가까운 순 정렬 (fetch 없이 재계산)
  // 구(district) 필터는 제거: 전 구를 다 긁고 위치(origin) 기준으로 가까운 순만 보여준다.
  //
  // PR #82 리뷰: 매 렌더 새 배열을 돌려주면 호출부(MapResult)의 useMemo 체인이 전부 무효화돼
  // 선택된 빵집 객체 → 주변 짐 보관함 배열까지 렌더마다 새로 만들어졌고, 그 배열을 deps로 쓰는
  // LuggageMarkers effect가 재실행되면서 열어둔 InfoWindow가 무관한 리렌더에도 닫혔다.
  // 입력이 같으면 같은 배열을 돌려준다. answers는 모든 호출부가 {} 리터럴을 넘겨 참조가 매번
  // 달라지므로 내용 키로 비교한다.
  const answersKey = JSON.stringify(answers ?? {})
  const bakeries = useMemo(() => {
    const scored = recommend(raw, answers)
    const sorted = origin
      ? [...scored].sort((a, b) => distKm(origin, a) - distKm(origin, b))
      : scored
    return sorted.slice(0, limit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, answersKey, origin, limit])

  return { bakeries, loading: enabled && loading, error, source, reload }
}

// origin → 빵집 직선거리(km). 좌표 없으면 맨 뒤로 밀리도록 Infinity.
function distKm(origin, b) {
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return Infinity
  return haversineKm(origin, { lat: b.lat, lng: b.lng })
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
