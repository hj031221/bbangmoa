import { useEffect, useMemo, useRef, useState } from 'react'
import { useAttractions } from '../../hooks/useAttractions'
import { useBakeries } from '../../hooks/useBakeries'
import { useSavedBakeries } from '../../hooks/useSavedBakeries'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { getRegion } from '../../config/regions'
import { haversineKm, formatDistance } from '../../lib/distance'
import MapView from './MapView'
import LuggageStorageSection from './LuggageStorageSection'
import { nearestAttraction, resolveMapSelection } from '../../lib/mapPresentation'
import { nearestLockers } from '../../lib/luggageStorage'
import RecommendCard from './RecommendCard'
import { SaveHeartIcon } from '../mypage/PreviewIcons'

const DISTRICTS = getRegion().districts
const NEARBY_LIMIT = 10
// 순번은 설문 추천 결과에서만 표시한다. 일반·근처 빵 지도에는 표시하지 않는다.
const RANK_LIMIT = 10

// "빵 지도" 메뉴 전용 화면. 취향 설문 없이 지역 전체 빵집을 지도에 뿌리고,
// 구 단위 필터 칩으로 표시 범위를 좁힌다. (설문 기반 추천 화면인 MapResult 와는 별개)
//
// origin 이 주어지면(관광지 상세의 "근처 빵집 보기") 구 필터 대신 origin 기준 거리순
// 상위 NEARBY_LIMIT 곳만 보여주는 "근처 빵집" 모드로 전환된다.
export default function BakeryMapPage({
  onBack,
  origin = null,
  onClearOrigin,
  initialSearch = '',
  initialSelectedId = null,
  onAddToCourse,
  recommendation = null,
}) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 820px)').matches)
  const mobilePanelRef = useRef(null)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)')
    const update = () => setIsMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const [district, setDistrict] = useState(null) // null = 전체
  const [localSelectedId, setLocalSelectedId] = useState(initialSelectedId)
  const selectedId = recommendation ? recommendation.selectedId : localSelectedId
  const setSelectedId = recommendation?.onSelect || setLocalSelectedId
  // 이슈 #70 1번: 모바일에서 sticky 지도 접기/펼치기 — 데스크톱에선 버튼 자체가 CSS로 숨는다.
  const [mapCollapsed, setMapCollapsed] = useState(false)
  // 이슈 #80 지도 UI 개편: 데스크톱에서 리스트를 접어 지도를 넓게 보고 싶을 때.
  const [listCollapsed, setListCollapsed] = useState(false)
  const [search, setSearch] = useState(initialSearch.trim())
  // 목록 필터링(filtered)은 매 키 입력마다 즉시 반응해야 하지만, 지도 재조정(MapView의
  // search prop)까지 그대로 즉시 반응하면 타이핑 한 글자마다 지도가 움직인다(리뷰 지적) —
  // 지도 쪽에만 디바운스된 값을 넘긴다.
  const debouncedSearch = useDebouncedValue(search, 300)
  const browseData = useBakeries({
    enabled: !recommendation,
    regionId: undefined,
    answers: {},
    origin: null,
    limit: Infinity,
  })
  const { bakeries, loading, error, source } = recommendation || browseData
  // 찜한 빵집을 목록 위쪽에 먼저 보여준다(§CP10-6) — "근처 빵집"(nearbyMode)은 거리순이
  // 핵심이라 여긴 적용하지 않는다.
  const { saved, isSaved, toggleSave } = useSavedBakeries()

  const { raw: visitAttractions } = useAttractions()

  const nearbyMode = !!origin
  const searchMode = !nearbyMode && !!search

  // 최종 리뷰 7: 하트를 누르는 순간 목록이 다시 정렬돼 방금 누른 행이 손가락 밑에서 맨 위로
  // 튀어 올라갔다. 원인은 두 겹이다 — (1) isSaved 가 매 렌더 새 클로저라 아래 useMemo 의
  // deps 에 있으면 무조건 재계산되고, (2) useBakeries 가 매 렌더 새 배열(bakeries)을 돌려줘
  // deps 에서 isSaved 를 빼도 재계산 자체는 계속 일어난다. 그래서 "재계산을 막는" 대신
  // "정렬 기준을 고정"한다: 찜 여부 스냅샷을 목록 맥락(근처 모드/구/검색어/데이터 건수)이
  // 바뀔 때만 새로 찍고, 그 사이의 하트 토글에는 순서가 반응하지 않게 한다.
  // (하트 아이콘 색은 isSaved 로 그대로 즉시 갱신된다 — 순서만 그 자리에 머문다.)
  const sortContextKey = nearbyMode ? 'nearby' : `${district ?? ''}|${search}|${bakeries.length}`
  const savedOrderRef = useRef({ key: null, ids: null })
  if (savedOrderRef.current.key !== sortContextKey) {
    savedOrderRef.current = { key: sortContextKey, ids: new Set(saved.map((b) => b.id)) }
  }

  const filtered = useMemo(() => {
    if (nearbyMode) {
      return bakeries
        .filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
        .map((b) => ({ ...b, distKm: haversineKm(origin, { lat: b.lat, lng: b.lng }) }))
        .sort((a, b) => a.distKm - b.distKm)
        .slice(0, NEARBY_LIMIT)
    }
    const base = search
      ? bakeries.filter((b) => (b.name || '').includes(search))
      : district
        ? bakeries.filter((b) => (b.address || '').includes(district))
        : bakeries
    const savedIds = savedOrderRef.current.ids
    return recommendation ? base : [...base].sort((a, b) => Number(savedIds.has(b.id)) - Number(savedIds.has(a.id)))
  }, [bakeries, district, nearbyMode, origin, search, sortContextKey, recommendation])

  // 순위 배지 → id. 리스트의 배열 위치(i)로 바로 매기면, 좌표가 없어 지도에 마커 자체가
  // 안 그려지는 항목(MarkerLayer.jsx가 lat/lng 없으면 건너뜀)이 상위 RANK_LIMIT 안에 있을 때
  // "리스트엔 번호가 있는데 지도엔 그 핀이 없는" 불일치가 생긴다(코드 리뷰 지적) — 좌표가
  // 있는 항목만 세어서 번호를 매기고, id로 지도 쪽(MarkerLayer)과 맞춘다.
  // recommendation(설문 결과 기반 추천)일 때만 번호가 의미 있다 — 일반 빵 지도(전체/구필터/
  // 검색/근처빵집)는 순서가 찜 우선 + API 응답 순일 뿐이라 번호를 달면 랭킹처럼 오해를 산다.
  const rankById = useMemo(() => {
    const map = new Map()
    if (!recommendation) return map
    let n = 0
    for (const b of filtered) {
      if (n >= RANK_LIMIT) break
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) continue
      map.set(b.id, ++n)
    }
    return map
  }, [filtered, recommendation])

  const selected = resolveMapSelection(filtered, selectedId)
  const effectiveSelectedId = selectedId && selected ? selected.id : null

  const nearbyLockers = useMemo(() => selected ? nearestLockers(selected) : [], [selected])

  const visitInfo = useMemo(() => {
    if (!selected) return null
    const attraction = nearestAttraction(selected, visitAttractions, { maxKm: 8 })
    return { attraction, locker: nearbyLockers[0] || null }
  }, [selected, visitAttractions, nearbyLockers])

  // 구를 바꾸면 이전 선택은 더 이상 유효하지 않으니 같이 초기화 → 지도가 대전 전체 시점으로 복귀한다.
  const selectDistrict = (d) => {
    setDistrict(d)
    setSelectedId(null)
  }

  const originAttraction = nearbyMode
    ? [{ id: '__nearby_origin__', name: origin.name, lat: origin.lat, lng: origin.lng }]
    : []

  useEffect(() => {
    if (isMobile && selectedId) mobilePanelRef.current?.scrollTo({ top: 0 })
  }, [isMobile, selectedId])

  const detailPanel = (selected && <aside className={isMobile ? 'bm-mobile-detail' : 'bm-floating-detail'}><div className="bm-bakery-detail-panel"><RecommendCard key={selected.id} bakery={selected} compact onAddToCourse={onAddToCourse} visitInfo={visitInfo} /></div>
            {nearbyLockers.length > 0 && <details className="bm-locker-details" key={selected.id}>
              <summary>주변 짐 보관소 <span>{nearbyLockers.length}곳</span></summary>
              <LuggageStorageSection lockers={nearbyLockers} label={selected.name} />
            </details>}
          </aside>)

  return (
    <div className="result result-browse">
      <p className="bm-sr-only" aria-live="polite" aria-atomic="true">
        {selected ? `${selected.name} 선택됨. ${selected.address || ''}${selected.distInfo ? `, ${selected.distInfo.from}에서 ${formatDistance(selected.distInfo.km)}` : ''}` : ''}
      </p>


      {error && <div className="banner error">데이터 오류: {String(error.message)}</div>}
      {loading && <div className="banner">불러오는 중…</div>}

      <div className={'result-body' + (listCollapsed ? ' list-collapsed' : '')}>
        <section className={'result-map' + (mapCollapsed ? ' is-collapsed' : '')}>
          <MapView
            bakeries={filtered}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
            attractions={recommendation && selectedId && selected?.nearSpot ? [selected.nearSpot] : originAttraction}
            highlightDistrict={district}
            search={debouncedSearch}
            nearbyMode={nearbyMode}
            rankById={rankById}
            lockers={nearbyLockers}
          />
      <header className="result-header">
        {/* 앱 내부 이력이 없으면 홈으로 돌아간다. */}
        <button
          type="button"
          className="result-back"
          onClick={onBack}
          aria-label="뒤로가기"
        >
          <svg viewBox="0 0 16 28" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 4 3 14 13 24" />
          </svg>
        </button>
        <h2>
          {recommendation?.illustration ? (
            <img className="bm-map-title-icon" src={recommendation.illustration} alt="" />
          ) : (
            <svg className="bm-map-title-icon bm-map-location-icon" viewBox="0 0 32 40" fill="none" aria-hidden="true">
              <ellipse cx="16" cy="36" rx="9" ry="3" fill="var(--line)" opacity=".45" />
              <path d="M16 2C8.8 2 3 7.8 3 15c0 9 13 20 13 20s13-11 13-20C29 7.8 23.2 2 16 2Z" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
              <circle cx="16" cy="15" r="5" fill="var(--card)" />
            </svg>
          )}
          <span>{recommendation && !searchMode && !district
            ? `${recommendation.title} · ${filtered.length}곳`
            : nearbyMode
            ? `${origin.name} 근처 빵집 (${filtered.length}곳)`
            : searchMode
              ? `'${search}' 검색 결과 (${filtered.length}곳)`
              : district
                ? `${district} · 빵집 ${filtered.length}곳`
                : `대전광역시 · 빵집 ${filtered.length}곳`}
          </span>
        </h2>
        {source === 'sample' && <span className="badge warn">샘플 데이터 (API 키 미설정)</span>}
        <button
          type="button"
          className="bm-list-toggle" aria-expanded={!listCollapsed}
          onClick={() => setListCollapsed((v) => !v)}
        >
          {listCollapsed ? '목록 보기' : '목록 숨기기'}
        </button>
      </header>
          {!isMobile && detailPanel}
          <button
            type="button"
            className="result-map-toggle"
            onClick={() => setMapCollapsed((v) => !v)}
          >
            {mapCollapsed ? '지도 펼치기 ▾' : '지도 접기 ▴'}
          </button>
        </section>

        <aside ref={mobilePanelRef} className={'result-list-col' + (listCollapsed ? ' is-collapsed' : '')}>
          {isMobile && detailPanel}
          {recommendation && <div className="bm-sidebar-back-row"><button type="button" className="bm-sidebar-back" onClick={onBack}>← 추천 결과로 돌아가기</button></div>}
          <div className="bm-sidebar-controls">
          {recommendation?.locationNotice && <p className={'bm-location-notice ' + (recommendation.locationTone || '')} role="status">{recommendation.locationNotice}</p>}
      {!nearbyMode && (
        <form
          className="bm-map-search-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (filtered.length > 0) setSelectedId(filtered[0].id)
          }}
        >
          <svg className="bm-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
          <input
            type="text"
            className="bm-map-search-input"
            placeholder="빵집 이름을 검색해보세요" aria-label="빵집 이름 검색"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedId(null)
            }}
          />
          {search && <button type="button" className="bm-search-clear" aria-label="검색어 지우기" onClick={() => { setSearch(''); setSelectedId(null) }}>×</button>}
        </form>
      )}

      {nearbyMode ? (
        <div className="bm-district-filters">
          <button type="button" className="bm-district-chip" onClick={onClearOrigin}>
            ← 전체 빵 지도 보기
          </button>
        </div>
      ) : searchMode ? (
        <div className="bm-district-filters">
          <button
            type="button"
            className="bm-district-chip"
            onClick={() => {
              setSearch('')
              // 이슈 #60 — 구 필터를 걸어둔 채 검색했다가 이 버튼을 누르면, 검색만 지워지고
              // 이전 구 필터로 돌아가 "전체로" 라벨과 실제 동작(구 필터 유지)이 어긋났다.
              setDistrict(null)
            }}
          >
            ← 전체 빵 지도 보기
          </button>
        </div>
      ) : (
        <div className="bm-district-filters">
          <button
            type="button"
            className={'bm-district-chip' + (!district ? ' active' : '')}
            onClick={() => selectDistrict(null)}
          >
            전체
          </button>
          {DISTRICTS.map((d) => (
            <button
              key={d}
              type="button"
              className={'bm-district-chip' + (district === d ? ' active' : '')}
              onClick={() => selectDistrict(d)}
            >
              {d}
            </button>
          ))}
        </div>
      )}

</div>
          <p className="bm-list-subheader"><span>{recommendation ? '추천 빵집' : '이 지역의 빵집'}</span><span>{filtered.length}곳</span></p>
          <ol className="rec-list">
            {filtered.map((b, i) => {
              return (
                <li
                  key={b.id}
                  className={'rec-list-item' + (b.id === selected?.id ? ' active' : '')}
                  onClick={() => setSelectedId(b.id)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedId(b.id) } }}
                >
                  {rankById.has(b.id) && <span className="rank">{rankById.get(b.id)}</span>}
                  <span className="rl-body">
                    <span className="rl-name-row">
                      <span className="rl-name">{b.name}</span>
                      <button
                        type="button"
                        className={'rl-heart-btn' + (isSaved(b.id) ? ' saved' : '')}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSave(b)
                        }}
                        aria-label={isSaved(b.id) ? '찜 해제' : '찜하기'}
                      >
                        <SaveHeartIcon filled={isSaved(b.id)} />
                      </button>
                    </span>
                    {b.isPossible && <span className="rl-tag">가능성 있음</span>}
                    {recommendation && b.distInfo && <span className="rl-dist">{b.distInfo.from}에서 {formatDistance(b.distInfo.km)}</span>}
                    {recommendation && b.nearSpot && <span className="rl-dist">근처 관광지 · {b.nearSpot.name} · {formatDistance(b.nearSpot.km)}</span>}
                    {nearbyMode ? (
                      Number.isFinite(b.distKm) && (
                        <span className="rl-dist">{formatDistance(b.distKm)}</span>
                      )
                    ) : (
                      b.address && <span className="rl-dist">{b.address}</span>
                    )}
                  </span>
                </li>
              )
            })}
            {!loading && filtered.length === 0 && (
              <li className="rec-list-empty">
                {nearbyMode
                  ? '근처에 표시할 빵집이 없어요.'
                  : searchMode
                    ? '검색 결과가 없어요.'
                    : district
                      ? '해당 구에는 표시할 빵집이 없어요.'
                      : recommendation
                        ? recommendation.emptyMessage
                        : '이 지역에는 표시할 빵집이 없어요.'}
              </li>
            )}
          </ol>
        </aside>


      </div>
    </div>
  )
}
