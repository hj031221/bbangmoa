import { useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useBakeries } from '../../hooks/useBakeries'
import { useCurrentLocation } from '../../hooks/useCurrentLocation'
import { getRegion } from '../../config/regions'
import { nearestAttraction, mapLocationNotice } from '../../lib/mapPresentation'
import { getBakeryDistanceInfo } from '../../lib/bakeryDistance'
import { pickBreadResult, matchBakeries, matchBakeriesGrouped } from '../../lib/breadRecommend'
import { getBreadById } from '../../data/breadCandidates'
import { useAttractions } from '../../hooks/useAttractions'
import BakeryMapPage from './BakeryMapPage'

const EMPTY = [] // 로딩 중 빈 목록 — 렌더마다 새 []를 만들면 memo가 깨진다
// 취향 일치율 기반 지도 + 추천 리스트.
export default function MapResult({ onAddToCourse, onBack, mapState, onMapChange }) {
  const regionId = useAppStore((s) => s.regionId)
  const origin = useAppStore((s) => s.origin)
  const answers = useAppStore((s) => s.answers)
  const directBreadId = useAppStore((s) => s.directBreadId)
  const region = getRegion(regionId)
  // 이슈 #70 1번: 모바일에서 sticky 지도 접기/펼치기 — 데스크톱에선 버튼 자체가 CSS로 숨는다.
  // 빵 종류 바로가기(이슈 #73 B1): 설문 없이 고른 빵. 있으면 스코어링 대신 이 빵으로 필터한다.
  const directBread = directBreadId ? getBreadById(directBreadId) : null

  // answers 는 넘기지 않는다 — 옛 태그-가중치 정렬(recommend.js)은 새 Q1~Q5 응답과 안 맞아 항상
  // 무력화된다. limit: Infinity 로 전체 풀을 받아와서 아래에서 breadResult 기준으로 직접 추린다.
  const { bakeries, loading, error, source } = useBakeries({
    regionId,
    answers: {},
    origin,
    limit: Infinity,
  })
  const { coords, status: locStatus, label: locLabel } = useCurrentLocation()

  // 관광지 좌표만 추림(이름·좌표). 빵집별 최근접 1곳 계산에 재사용.
  const { raw: attractionsRaw, loading: attractionsLoading } = useAttractions()
  const tourSpots = useMemo(
    () => attractionsRaw.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng)),
    [attractionsRaw],
  )

  // 설문에서 나온 "오늘의 빵" 결과가 있으면 그 빵을 파는 빵집만(BreadReveal 과 동일 기준) 보여준다.
  // 결과가 없으면(Q1 미응답 등) 대전 전역을 가까운 순으로 보여주는 기존 방식으로 폴백한다.
  // 로딩 중엔 bakeries 가 비어있어 필터가 자연히 no-op 되고, 로딩이 끝나면 실제 목록으로 재계산된다
  // (§CP10-2 — 연결된 빵집이 없는 빵은 애초에 후보에서 제외).
  //
  // PR #82 리뷰: 이 아래 값들이 매 렌더 새 객체/배열이면 bakeriesWithDist → BakeryMapPage의
  // selected → nearbyLockers 까지 연쇄로 새 참조가 되어, 짐 보관함 InfoWindow가 무관한
  // 리렌더에 닫히고 LuggageStorageSection이 같은 계산을 한 번 더 했다. 입력이 같으면 같은
  // 참조를 유지하도록 useMemo로 묶는다(useBakeries 쪽 bakeries도 같은 이유로 memo).
  const breadResult = useMemo(
    () => (directBread ? { bread: directBread, branch: null, score: null } : pickBreadResult(answers, bakeries)),
    [directBread, answers, bakeries],
  )
  // 바로가기: 확인된 곳 + (빈약할 때만) 가능성 있는 곳. possibleIds 로 "가능성 있음" 배지를 단다.
  const { filteredBakeries, possibleIds } = useMemo(() => {
    if (directBread) {
      const groups = matchBakeriesGrouped(bakeries, directBread, { limit: 10, minConfirmed: 3 })
      return {
        filteredBakeries: [...groups.confirmed, ...groups.possible],
        possibleIds: new Set(groups.possible.map((b) => b.id)),
      }
    }
    return {
      filteredBakeries: breadResult ? matchBakeries(bakeries, breadResult.bread, 10) : bakeries,
      possibleIds: null,
    }
  }, [directBread, bakeries, breadResult])

  // 빵집별 거리: 설문서 고른 origin 우선, 없으면 현재 위치/역 폴백
  const bakeriesWithDist = useMemo(
    () =>
      filteredBakeries.map((b) => ({
        ...b,
        distInfo: getBakeryDistanceInfo(b, { origin, coords, bbox: region.bbox }),
        nearSpot: attractionsLoading ? null : nearestAttraction(b, tourSpots),
        breadType: breadResult?.bread?.name,
        breadTypeEmoji: breadResult?.bread?.emoji,
        breadTypeIllustration: breadResult?.bread?.illustration,
        isPossible: possibleIds ? possibleIds.has(b.id) : false,
      })),
    [filteredBakeries, possibleIds, origin, coords, region, tourSpots, attractionsLoading, breadResult],
  )

  // 재검증 발견: attractionsLoading을 nearSpot 계산에만 반영했더니, 로딩 중이든 아니든
  // tourSpots가 빈 배열이라 nearestAttraction()이 어차피 null을 반환해서 렌더링 결과가
  // 이전과 100% 동일했다 — "고쳤다"는 주장이 틀렸었다. 실제로 화면이 달라지는 지점은
  // "빵집은 이미 로딩 끝났는데 관광지만 아직 로딩 중"인 구간에서 리스트가 먼저 그려지고
  // 그 뒤에 근처 관광지 배지가 기존 줄에 나중에 추가되는 것 — 그래서 리스트 자체를
  // attractionsLoading이 끝날 때까지 같이 미룬다(기존 "불러오는 중…" 배너 패턴 재사용).
  // 대가: 목록이 뜨는 시점이 근소하게 늦어지지만(빵집 로딩만 끝났을 때 대신 관광지까지
  // 끝난 뒤), 한 번 뜨면 완성된 상태로 뜨고 이후에 항목이 튀지 않는다.
  const listReady = !loading && !attractionsLoading
  const recommendation = useMemo(
    () => ({
      bakeries: listReady ? bakeriesWithDist : EMPTY,
      loading: !listReady,
      error,
      source,
      locationNotice: mapLocationNotice({ origin, status: locStatus, coords, label: locLabel, bbox: region.bbox }),
      locationTone: !origin && (locStatus === 'denied' || locStatus === 'unsupported') ? 'warn' : '',
      emptyMessage: `이 지역엔 아직 추천할 ${breadResult?.bread?.name ? breadResult.bread.name + ' ' : ''}맛집 정보가 없어요.`,
      title: breadResult ? `${breadResult.bread.name} 맛집 추천` : '대전 빵집 추천',
      illustration: breadResult?.bread.illustration,
    }),
    [listReady, bakeriesWithDist, error, source, origin, locStatus, coords, locLabel, region, breadResult],
  )
  return <BakeryMapPage mapState={mapState} onMapChange={onMapChange} onAddToCourse={onAddToCourse} onBack={onBack} recommendation={recommendation} />
}
