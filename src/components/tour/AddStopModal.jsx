import { useState } from 'react'
import { useSavedBakeries } from '../../hooks/useSavedBakeries'

const TABS = [
  { id: 'bakery', label: '빵집 검색' },
  { id: 'attraction', label: '관광지 검색' },
]

// 전체 지도(설문 후보 풀 밖 포함)에서 빵집/관광지를 검색해 코스에 추가하는 모달.
// §07 확정사항: 개수 상한 없음, 후보 풀 밖도 허용.
export default function AddStopModal({
  bakeries,
  attractions,
  excludeIds,
  suggestedBakeryIds,
  suggestedAttractionIds,
  onAdd,
  onClose,
}) {
  const [tab, setTab] = useState('bakery')
  const [query, setQuery] = useState('')
  // CP11-4 — 설문에서 이미 후보로 나왔는데 지금 코스엔 없는 것들(취향 후보). 찜한 빵집을 검색
  // 결과 위로 올리던 기존 패턴(isSaved 정렬 + 아이콘)과 동일한 방식으로, 새 섹션을 따로 만들지
  // 않고 그 위에 우선순위 한 단계만 얹는다.
  const suggestedIds = tab === 'bakery' ? suggestedBakeryIds : suggestedAttractionIds
  // 찜한 빵집을 검색 결과 위쪽에 먼저 보여준다(피드백 추가요청) — 관광지는 찜 기능 자체가
  // 없어서 대상이 없다(범위 제외 확정).
  const { isSaved } = useSavedBakeries()

  // 이미 코스에 있는 항목도 목록에서 안 지우고 "이미 추가됨"으로 흐리게 보여준다 — 전엔 그냥
  // 걸러서 안 보이게 했는데, 찜한 빵집이 이미 코스에 들어있는 경우 "찜한 게 검색에 안 뜬다"로
  // 오해하기 쉬웠다(실제론 우선노출이 아니라 제외 필터에 걸린 것). 코스 안에 있다는 걸 눈에
  // 보이게 하는 쪽이 더 명확하다.
  // 30개 상한은 "아직 안 넣은" 후보에만 건다 — 이미 코스에 있는 항목까지 그 상한에 같이
  // 밀려들어가면(코스 상한이 애초에 적어 개수는 적지만, 정렬상 항상 맨 뒤라) 검색 결과가 많을 때
  // 잘려서 안 보이는, 지금 고치려는 것과 똑같은 증상이 재발한다.
  const pool = tab === 'bakery' ? bakeries : attractions
  const queried = pool
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .filter((p) => !query.trim() || p.name.includes(query.trim()))
  const addable = queried.filter((p) => !excludeIds.has(p.id))
  const already = queried.filter((p) => excludeIds.has(p.id))
  const sortedAddable = [...addable].sort((a, b) => {
    const suggestedDiff = Number(!!suggestedIds?.has(b.id)) - Number(!!suggestedIds?.has(a.id))
    if (suggestedDiff !== 0) return suggestedDiff
    return tab === 'bakery' ? Number(isSaved(b.id)) - Number(isSaved(a.id)) : 0
  })
  const filtered = [...sortedAddable.slice(0, 30), ...already]

  return (
    <div className="pil-modal-backdrop" onClick={onClose}>
      <div className="pil-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pil-modal-head">
          <div className="pil-modal-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" className="pil-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <input
          className="pil-modal-search"
          type="text"
          placeholder={tab === 'bakery' ? '빵집 이름 검색…' : '관광지 이름 검색…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="pil-modal-list">
          {filtered.length === 0 && <div className="pil-modal-empty">검색 결과가 없어요.</div>}
          {filtered.map((p) => {
            const added = excludeIds.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                className={'pil-modal-row' + (added ? ' added' : '')}
                onClick={() =>
                  !added && onAdd({ type: tab, id: p.id, name: p.name, lat: p.lat, lng: p.lng })
                }
                disabled={added}
              >
                <span>
                  {tab === 'bakery' && isSaved(p.id) && <span aria-hidden="true">❤️ </span>}
                  {p.name}
                  {suggestedIds?.has(p.id) && <span className="pil-modal-suggested-tag">취향 후보</span>}
                </span>
                <span className="pil-modal-plus">{added ? '이미 추가됨' : '+'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
