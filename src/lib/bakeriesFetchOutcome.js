import { mergeBakeries } from '../api/normalize.js'

// 관광공사·카카오 요청의 allSettled 결과 → 최종 처리 방식 결정. 정상적인 0건(요청은 다
// 성공했는데 병합 결과가 빈 배열)과 요청 실패로 인한 0건을 구분해야 한다 — 후자를 실패로
// 안 잡으면 API 장애도 "샘플 데이터"로 조용히 넘어간다(PR #82 검증 발견 — P2. useBakeries.js가
// 이전엔 각 요청의 실패를 .catch(()=>[])로 삼켜 Promise.all이 절대 reject하지 않았다).
//
// 이슈 #86: 한쪽만 실패하고 병합 결과가 0건이 아닌 경우 예전엔 그냥 'api'(정상)로 취급했다.
// 관광공사 API는 실측 성공률 ~40%라 이 경우가 흔한데, 이걸 정상으로 부르면 "이번 로드에
// 관광공사가 빠져서 그 소스의 빵집만 안 보인다"는 사실이 통째로 삼켜진다 — 같은 빵 종류를
// 반복 요청해도 매칭 결과가 매번 달라지는 원인이었다. 'api'와 구분되는 'partial'로 반환해
// 호출부가 캐시하지 않고 재시도 기회를 남기게 한다.
export function resolveFetchOutcome(tourResult, kakaoResult) {
  const tour = tourResult.status === 'fulfilled' ? tourResult.value : []
  const kakao = kakaoResult.status === 'fulfilled' ? kakaoResult.value : []
  const anyFailed = tourResult.status === 'rejected' || kakaoResult.status === 'rejected'
  const merged = mergeBakeries(tour, kakao)
  if (merged.length === 0 && anyFailed) {
    return { status: 'error', error: tourResult.reason || kakaoResult.reason, tour, kakao, merged }
  }
  if (merged.length === 0) {
    return { status: 'sample', tour, kakao, merged }
  }
  if (anyFailed) {
    return { status: 'partial', tour, kakao, merged }
  }
  return { status: 'api', tour, kakao, merged }
}
