import { useMemo, useState } from 'react'
import { useBakeries } from '../../hooks/useBakeries'
import { useSavedBakeries } from '../../hooks/useSavedBakeries'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { getRegion } from '../../config/regions'
import { haversineKm, formatDistance } from '../../lib/distance'
import MapView from './MapView'
import RecommendCard from './RecommendCard'
import MapSelectionSummary from './MapSelectionSummary'
import { SaveHeartIcon } from '../mypage/PreviewIcons'
import { curatedBreadIdsFor } from '../../data/bakeryBreadMenu'
import { getBreadById } from '../../data/breadCandidates'

const DISTRICTS = getRegion().districts
const NEARBY_LIMIT = 10

// "빵 지도" 메뉴 전용 화면. 취향 설문 없이 지역 전체 빵집을 지도에 뿌리고,
// 구 단위 필터 칩으로 표시 범위를 좁힌다. (설문 기반 추천 화면인 MapResult 와는 별개)
//
// origin 이 주어지면(관광지 상세의 "근처 빵집 보기") 구 필터 대신 origin 기준 거리순
// 상위 NEARBY_LIMIT 곳만 보여주는 "근처 빵집" 모드로 전환된다.
export default function BakeryMapPage({
  origin = null,
  onClearOrigin,
  initialSearch = '',
  initialSelectedId = null,
  onBack,
}) {
  const [district, setDistrict] = useState(null) // null = 전체
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  // 이슈 #70 1번: 모바일에서 sticky 지도 접기/펼치기 — 데스크톱에선 버튼 자체가 CSS로 숨는다.
  const [mapCollapsed, setMapCollapsed] = useState(false)
  // 이슈 #80 지도 UI 개편: 데스크톱에서 리스트를 접어 지도를 넓게 보고 싶을 때.
  const [listCollapsed, setListCollapsed] = useState(false)
  const [search, setSearch] = useState(initialSearch.trim())
  // 목록 필터링(filtered)은 매 키 입력마다 즉시 반응해야 하지만, 지도 재조정(MapView의
  // search prop)까지 그대로 즉시 반응하면 타이핑 한 글자마다 지도가 움직인다(리뷰 지적) —
  // 지도 쪽에만 디바운스된 값을 넘긴다.
  const debouncedSearch = useDebouncedValue(search, 300)
  const { bakeries, loading, error, source } = useBakeries({
    regionId: undefined,
    answers: {},
    origin: null,
    limit: Infinity,
  })
  // 찜한 빵집을 목록 위쪽에 먼저 보여준다(§CP10-6) — "근처 빵집"(nearbyMode)은 거리순이
  // 핵심이라 여긴 적용하지 않는다.
  const { isSaved, toggleSave } = useSavedBakeries()

  const nearbyMode = !!origin
  const searchMode = !nearbyMode && !!search

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
    return [...base].sort((a, b) => Number(isSaved(b.id)) - Number(isSaved(a.id)))
  }, [bakeries, district, nearbyMode, origin, search, isSaved])

  // 목록 항목의 "대표메뉴" — 큐레이션 데이터(bakeryBreadMenu.js)에서 이 빵집이 판다고 확인된
  // 빵 중 첫 번째. 없으면 표시하지 않는다(추측성 정보를 지어내지 않음).
  const signatureBreadName = (bakeryName) => {
    const ids = curatedBreadIdsFor(bakeryName)
    if (!ids || ids.length === 0) return null
    return getBreadById(ids[0])?.name ?? null
  }

  const selected = filtered.find((b) => b.id === selectedId) || null

  // 구를 바꾸면 이전 선택은 더 이상 유효하지 않으니 같이 초기화 → 지도가 대전 전체 시점으로 복귀한다.
  const selectDistrict = (d) => {
    setDistrict(d)
    setSelectedId(null)
  }

  const originAttraction = nearbyMode
    ? [{ id: '__nearby_origin__', name: origin.name, lat: origin.lat, lng: origin.lng }]
    : []

  return (
    <div className="result result-browse">
      <header className="result-header">
        {onBack && (
          <button type="button" className="result-back" onClick={onBack} aria-label="처음으로">
            <svg viewBox="0 0 16 28" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 4 3 14 13 24" />
            </svg>
          </button>
        )}
        <h2>
          {nearbyMode
            ? `${origin.name} 근처 빵집 (${filtered.length}곳)`
            : searchMode
              ? `'${search}' 검색 결과 (${filtered.length}곳)`
              : `대전광역시 · 빵집 ${filtered.length}곳`}
        </h2>
        {source === 'sample' && <span className="badge warn">샘플 데이터 (API 키 미설정)</span>}
        <button
          type="button"
          className="bm-list-toggle"
          onClick={() => setListCollapsed((v) => !v)}
        >
          {listCollapsed ? '목록 보기' : '목록 숨기기'}
        </button>
      </header>

      {error && <div className="banner error">데이터 오류: {String(error.message)}</div>}
      {loading && <div className="banner">불러오는 중…</div>}

      {!nearbyMode && (
        <form
          className="bm-map-search-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (filtered.length > 0) setSelectedId(filtered[0].id)
          }}
        >
          <input
            type="text"
            className="bm-map-search-input"
            placeholder="빵집 이름 검색…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedId(null)
            }}
          />
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

      <div className="result-body">
        <section className={'result-map' + (mapCollapsed ? ' is-collapsed' : '')}>
          <MapView
            bakeries={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            attractions={originAttraction}
            highlightDistrict={district}
            search={debouncedSearch}
            nearbyMode={nearbyMode}
          />
          <MapSelectionSummary bakery={selected} />
          <button
            type="button"
            className="result-map-toggle"
            onClick={() => setMapCollapsed((v) => !v)}
          >
            {mapCollapsed ? '지도 펼치기 ▾' : '지도 접기 ▴'}
          </button>
        </section>

        <aside className={'result-list-col' + (listCollapsed ? ' is-collapsed' : '')}>
          <p className="bm-list-subheader">이 지역의 빵집 {filtered.length}곳</p>
          <ol className="rec-list">
            {filtered.map((b, i) => {
              const signature = nearbyMode ? null : signatureBreadName(b.name)
              return (
                <li
                  key={b.id}
                  className={'rec-list-item' + (b.id === selectedId ? ' active' : '')}
                  onClick={() => setSelectedId(b.id)}
                >
                  <span className="rank">{i + 1}</span>
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
                    {signature && <span className="rl-signature">{signature}</span>}
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
                    : '해당 구에는 표시할 빵집이 없어요.'}
              </li>
            )}
          </ol>
        </aside>

        <aside className={'result-detail-col' + (mapCollapsed ? ' is-collapsed' : '')}>
          <RecommendCard bakery={selected} />
        </aside>
      </div>
    </div>
  )
}
