import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useBakeries } from '../hooks/useBakeries'
import MapView from '../components/map/MapView'
import RecommendCard from '../components/map/RecommendCard'

export default function MapResultPage() {
  const navigate = useNavigate()
  const regionId = useAppStore((s) => s.regionId)
  const answers = useAppStore((s) => s.answers)
  const selectedBakeryId = useAppStore((s) => s.selectedBakeryId)
  const selectBakery = useAppStore((s) => s.selectBakery)

  const { bakeries, loading, error, source } = useBakeries({ regionId, answers })
  const selected = bakeries.find((b) => b.id === selectedBakeryId) || bakeries[0]

  return (
    <div className="page result">
      <header className="result-header">
        <button className="ghost-btn" onClick={() => navigate('/survey')}>
          ← 설문 다시
        </button>
        <h2>대전 빵집 추천 ({bakeries.length}곳)</h2>
        {source === 'sample' && (
          <span className="badge warn">샘플 데이터 (API 키 미설정)</span>
        )}
      </header>

      {error && <div className="banner error">데이터 오류: {String(error.message)}</div>}
      {loading && <div className="banner">불러오는 중…</div>}

      <div className="result-body">
        {/* 지도 */}
        <section className="result-map">
          <MapView
            bakeries={bakeries}
            selectedId={selected?.id}
            onSelect={selectBakery}
          />
        </section>

        {/* 추천 리스트 + 상세카드 (지도 추가기능은 features 레지스트리로 확장) */}
        <aside className="result-side">
          <RecommendCard bakery={selected} />
          <ol className="rec-list">
            {bakeries.map((b, i) => (
              <li
                key={b.id}
                className={'rec-list-item' + (b.id === selected?.id ? ' active' : '')}
                onClick={() => selectBakery(b.id)}
              >
                <span className="rank">{i + 1}</span>
                <span className="rl-name">{b.name}</span>
                {typeof b.score === 'number' && b.score > 0 && (
                  <span className="rl-score">{b.score}</span>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {/* 팀 내부용 기획안 바로가기 (지도 화면 우하단) */}
      <a className="plan-link" href="/계획.html" target="_blank" rel="noreferrer">📋 기획안</a>
    </div>
  )
}
