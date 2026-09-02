import { useEffect, useState } from 'react'
import { getDetail, tourEnabled } from '../../api'
import { TASTE_TAGS } from '../../data/tasteTags'
import { useSavedBakeries } from '../../hooks/useSavedBakeries'
import { useAuth } from '../../hooks/useAuth'
import { useDiaryEntries } from '../../hooks/useDiaryEntries'
import DiaryEntryModal from '../mypage/DiaryEntryModal'
import { SaveHeartIcon, PaperIcon } from '../mypage/PreviewIcons'
import { formatDistance } from '../../lib/distance'

// 선택된 빵집 상세 카드.
// 관광공사 출처(contentId 보유)면 detailCommon2 로 설명/대표이미지를 보강한다.
export default function RecommendCard({ bakery }) {
  const [detail, setDetail] = useState(null)
  const { toggleSave, isSaved } = useSavedBakeries()
  const { user } = useAuth()
  const { addEntry } = useDiaryEntries()
  const [diaryOpen, setDiaryOpen] = useState(false)

  useEffect(() => {
    setDetail(null)
    if (!bakery?.contentId || !tourEnabled()) return
    let alive = true
    getDetail(bakery.contentId)
      .then((d) => alive && setDetail(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [bakery])

  if (!bakery) {
    return <div className="rec-card empty">마커 또는 목록에서 빵집을 선택하세요.</div>
  }

  const image = bakery.thumbnail || detail?.firstimage || null
  const overview = detail?.overview?.replace(/<[^>]+>/g, '') || ''
  const saved = isSaved(bakery.id)

  return (
    <div className="rec-card">
      {image && <img className="rec-img" src={image} alt={bakery.name} />}
      <div className="rec-name-row">
        <h3 className="rec-name">{bakery.name}</h3>
        <button
          type="button"
          className={'save-btn' + (saved ? ' saved' : '')}
          onClick={() => toggleSave(bakery)}
        >
          <SaveHeartIcon filled={saved} />
          {saved ? '찜함' : '찜하기'}
        </button>
      </div>
      {user && (
        <div className="rec-actions">
          <button type="button" className="save-btn" onClick={() => setDiaryOpen(true)}>
            <PaperIcon />
            기록 남기기
          </button>
        </div>
      )}
      <div className="rec-tags">
        {bakery.tags?.map((t) => (
          <span key={t} className="rec-tag">
            #{TASTE_TAGS[t]?.label || t}
          </span>
        ))}
      </div>
      {bakery.address && <p className="rec-addr">📍 {bakery.address}</p>}
      {bakery.distInfo && (
        <p className="rec-dist">🚶 {bakery.distInfo.from}에서 {formatDistance(bakery.distInfo.km)}</p>
      )}
      {bakery.phone && <p className="rec-tel">📞 {bakery.phone}</p>}
      {overview && <p className="rec-desc">{overview.slice(0, 200)}…</p>}
      <div className="rec-meta">
        <span>출처: {bakery.source === 'tour' ? '관광공사' : bakery.source === 'kakao' ? '카카오' : '샘플'}</span>
      </div>
      {bakery.url && (
        <a className="rec-link" href={bakery.url} target="_blank" rel="noreferrer">
          카카오맵에서 보기 →
        </a>
      )}
      {diaryOpen && (
        <DiaryEntryModal
          bakery={bakery}
          onClose={() => setDiaryOpen(false)}
          onSubmit={(text, location) => addEntry(bakery, text, location)}
        />
      )}
    </div>
  )
}
