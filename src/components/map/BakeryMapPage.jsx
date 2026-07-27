import { useMemo, useState } from 'react'
import { useBakeries } from '../../hooks/useBakeries'
import { getRegion } from '../../config/regions'
import MapView from './MapView'
import RecommendCard from './RecommendCard'

const DISTRICTS = getRegion().districts

// "빵 지도" 메뉴 전용 화면. 취향 설문 없이 지역 전체 빵집을 지도에 뿌리고,
// 구 단위 필터 칩으로 표시 범위를 좁힌다. (설문 기반 추천 화면인 MapResult 와는 별개)
export default function BakeryMapPage() {
  const [district, setDistrict] = useState(null) // null = 전체
  const [selectedId, setSelectedId] = useState(null)
  const { bakeries, loading, error, source } = useBakeries({
    regionId: undefined,
    answers: {},
    origin: null,
    limit: Infinity,
  })

  const filtered = useMemo(
    () => (district ? bakeries.filter((b) => (b.address || '').includes(district)) : bakeries),
    [bakeries, district],
  )
  const selected = filtered.find((b) => b.id === selectedId) || null

  // 구를 바꾸면 이전 선택은 더 이상 유효하지 않으니 같이 초기화 → 지도가 대전 전체 시점으로 복귀한다.
  const selectDistrict = (d) => {
    setDistrict(d)
    setSelectedId(null)
  }

  return (
    <div className="result">
      <header className="result-header">
        <h2>빵집 지도 ({filtered.length}곳)</h2>
        {source === 'sample' && <span className="badge warn">샘플 데이터 (API 키 미설정)</span>}
      </header>

      {error && <div className="banner error">데이터 오류: {String(error.message)}</div>}
      {loading && <div className="banner">불러오는 중…</div>}

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

      <div className="result-body">
        <section className="result-map">
          <MapView
            bakeries={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            highlightDistrict={district}
          />
        </section>

        <aside className="result-side">
          <RecommendCard bakery={selected} />
          <ol className="rec-list">
            {filtered.map((b) => (
              <li
                key={b.id}
                className={'rec-list-item' + (b.id === selectedId ? ' active' : '')}
                onClick={() => setSelectedId(b.id)}
              >
                <span className="rl-name">{b.name}</span>
                {b.address && <span className="rl-dist">{b.address}</span>}
              </li>
            ))}
            {!loading && filtered.length === 0 && (
              <li className="rec-list-empty">해당 구에는 표시할 빵집이 없어요.</li>
            )}
          </ol>
        </aside>
      </div>
    </div>
  )
}
