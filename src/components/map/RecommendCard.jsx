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
export default function RecommendCard({ bakery, compact = false, onAddToCourse, visitInfo = null }) {
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

  // <br>/</p>를 줄바꿈으로 먼저 바꿔야 원문의 문단 구분이 살아남는다 — 태그를 그냥
  // 지워버리면(구버전) 문단이 다 붙어서 한 덩어리 텍스트가 됐다.
  const overview = detail?.overview
    ?.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || ''

  // 이슈 #74-3 리뷰 지적: "더보기" 노출 여부를 글자 수(overview.length > 100)로 판단하면
  // 실제 화면 폭에서 3줄을 넘겨 잘렸는지와 어긋난다(짧아도 잘리거나, 길어도 안 잘리는 경우
  // 둘 다 생김) — 접힌 상태에서 실제 DOM이 overflow 됐는지(scrollHeight > clientHeight)를
  // 재서 판단한다. 펼친 상태에선 clamp 자체가 없어 항상 같아지므로 재지 않고 이전 값을 유지.
  useEffect(() => {
    if (compact || descExpanded) return
    const el = descRef.current
    if (!el) {
      setDescTruncated(false)
      return
    }
    const measure = () => setDescTruncated(el.scrollHeight > el.clientHeight + 1)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [overview, descExpanded, compact])

  if (!bakery) {
    return <div className="rec-card empty">마커 또는 목록에서 빵집을 선택하세요.</div>
  }

  const image = bakery.thumbnail || detail?.firstimage || null
  const saved = isSaved(bakery.id)

  return (
    <div className={'rec-card' + (compact ? ' rec-card-compact' : '')}>
      <div className={compact ? 'rec-content' : 'rec-content-default'}>
      {!compact && image && <img className="rec-img" src={image} alt={bakery.name} />}
      <div className="rec-name-row">
        <h3 className="rec-name">{bakery.name}</h3>
        <button
          type="button"
          className={'save-btn' + (saved ? ' saved' : '')}
          onClick={() => toggleSave(bakery)} aria-label={saved ? '찜 해제' : '찜하기'}
        >
          <SaveHeartIcon filled={saved} />
          {!compact && (saved ? '찜함' : '찜하기')}
        </button>
      </div>
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
        <div className={'rec-desc-wrap' + (compact || descExpanded ? ' expanded' : '')}>
          {/* 데스크탑은 원문 그대로 보여주고, 모바일 3줄 clamp는 CSS(.rec-desc-wrap)가 담당한다.
              1000자 슬라이스는 뷰포트와 무관하게 원문이 지나치게 길 때만 걸리는 안전장치. */}
          <p className="rec-desc" ref={descRef}>
            {!compact && overview.length > 1000 ? overview.slice(0, 1000) + '…' : overview}
          </p>
          {!compact && descTruncated && (
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
      {compact && !overview && visitInfo && (
        <div className="rec-visit-info">
          <h4>방문 참고 정보</h4>
          <dl>
            {visitInfo.attraction && <div><dt>가까운 관광지</dt><dd>{visitInfo.attraction.name}<small>직선 {formatDistance(visitInfo.attraction.km)}</small></dd></div>}
            <div className={!visitInfo.locker ? 'rec-no-locker' : undefined}><dt>가까운 짐 보관소</dt><dd>{visitInfo.locker ? <>{visitInfo.locker.name}<small>직선 {formatDistance(visitInfo.locker.km)}</small></> : '5km 내에 보관소가 없어요'}</dd></div>
            {!visitInfo.attraction && !visitInfo.locker && <div><dt>방문 전 확인</dt><dd>{bakery.phone ? `매장 문의 · ${bakery.phone}` : '매장 상세에서 위치와 이용 정보를 확인해 주세요.'}</dd></div>}
          </dl>
        </div>
      )}
      <div className="rec-meta">
        <span>출처: {bakery.source === 'tour' ? '관광공사' : bakery.source === 'kakao' ? '카카오' : '샘플'}</span>
      </div>
      </div>
      <div className={compact ? 'rec-footer' : 'rec-footer-default'}>
      {bakery.url && (
        <a className="rec-link" href={bakery.url} target="_blank" rel="noreferrer">
          카카오맵에서 보기 →
        </a>
      )}
      {(user || (compact && onAddToCourse)) && (
        <div className="rec-actions">
          {compact && onAddToCourse && Number.isFinite(bakery.lat) && Number.isFinite(bakery.lng) && <button type="button" className="bm-course-btn" onClick={() => onAddToCourse(bakery)}>코스에 담기</button>}
          {user && <>
          <button type="button" className="save-btn" onClick={() => setDiaryOpen(true)}>
            <PaperIcon />
            기록 남기기
          </button></>}
        </div>
      )}
      </div>
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
