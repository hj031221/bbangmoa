import { useEffect, useRef, useState } from 'react'
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
  const [descExpanded, setDescExpanded] = useState(false)
  const [descTruncated, setDescTruncated] = useState(false)
  const descRef = useRef(null)

  useEffect(() => {
    setDetail(null)
    setDescExpanded(false)
    setDescTruncated(false)
    if (!bakery?.contentId || !tourEnabled()) return
    let alive = true
    getDetail(bakery.contentId)
      .then((d) => alive && setDetail(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [bakery])

  const overview = detail?.overview?.replace(/<[^>]+>/g, '') || ''

  // 이슈 #74-3 리뷰 지적: "더보기" 노출 여부를 글자 수(overview.length > 100)로 판단하면
  // 실제 화면 폭에서 3줄을 넘겨 잘렸는지와 어긋난다(짧아도 잘리거나, 길어도 안 잘리는 경우
  // 둘 다 생김) — 접힌 상태에서 실제 DOM이 overflow 됐는지(scrollHeight > clientHeight)를
  // 재서 판단한다. 펼친 상태에선 clamp 자체가 없어 항상 같아지므로 재지 않고 이전 값을 유지.
  useEffect(() => {
    if (descExpanded) return
    const el = descRef.current
    if (!el) {
      setDescTruncated(false)
      return
    }
    const measure = () => setDescTruncated(el.scrollHeight > el.clientHeight + 1)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [overview, descExpanded])

  if (!bakery) {
    return <div className="rec-card empty">마커 또는 목록에서 빵집을 선택하세요.</div>
  }

  const image = bakery.thumbnail || detail?.firstimage || null
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
      {overview && (
        <div className={'rec-desc-wrap' + (descExpanded ? ' expanded' : '')}>
          {/* 데스크탑은 원문 그대로 보여주고, 모바일 3줄 clamp는 CSS(.rec-desc-wrap)가 담당한다.
              1000자 슬라이스는 뷰포트와 무관하게 원문이 지나치게 길 때만 걸리는 안전장치. */}
          <p className="rec-desc" ref={descRef}>
            {overview.length > 1000 ? overview.slice(0, 1000) + '…' : overview}
          </p>
          {descTruncated && (
            <button
              type="button"
              className="rec-desc-toggle"
              onClick={() => setDescExpanded((v) => !v)}
            >
              {descExpanded ? '접기' : '더보기'}
            </button>
          )}
        </div>
      )}
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
