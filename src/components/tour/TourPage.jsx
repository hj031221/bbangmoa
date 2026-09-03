import { useMemo, useEffect, useState } from 'react'
import { useAttractions } from '../../hooks/useAttractions'
import { getDetail, getAttractionIntro, tourEnabled, reverseGeocodeAddress, kakaoLocalEnabled } from '../../api'
import { hoursBadgeText, parseHours } from '../../lib/hours'
import { getRegion } from '../../config/regions'

const DISTRICTS = getRegion().districts
const DESC_MAX = 160
const PAGE_SIZE = 21

// 이슈 #70 3번: attractionTagging.js가 이미 부여해둔 themes/companion 태그를 구 필터와
// 같은 칩 UI로 노출한다. companion은 0~100 점수라 동등 비교가 안 돼 처음엔 임계값(60점)
// 필터 + 내림차순 정렬로 다뤘는데, 리뷰에서 고정 관광지 173곳 기준 (구×테마×동행) 125개
// 조합 중 89개(71.2%)가 빈 결과로 나온다는 게 확인됐다 — "드물다"던 애초 판단이 틀렸다.
// 필터로 결과를 아예 지우지 않도록 companion은 정렬 기준으로만 쓴다(이슈 #70에 명시된 대안).
const THEME_OPTIONS = [
  { id: 'nature', label: '자연' },
  { id: 'history', label: '역사' },
  { id: 'culture', label: '문화' },
  { id: 'education', label: '교육' },
  { id: 'etc', label: '기타' },
]
const COMPANION_OPTIONS = [
  { id: 'solo', label: '혼자' },
  { id: 'couple', label: '연인과' },
  { id: 'friends', label: '친구와' },
  { id: 'childrenFamily', label: '아이와' },
  { id: 'parentsFamily', label: '부모님과' },
]

// 관광공사 개요 텍스트 끝에 흔히 붙는 "(출처 : OO)" 를 본문과 분리해 별도 표기한다.
function splitOverview(raw) {
  const text = raw?.replace(/<[^>]+>/g, '').trim() || ''
  const match = text.match(/\(출처\s*[:：]\s*([^)]+)\)\s*$/)
  if (!match) return { text, source: '' }
  return { text: text.slice(0, match.index).trim(), source: match[1].trim() }
}

// "관광모아" 메뉴 전용 화면. 명소를 원형 사진 그리드로 둘러보다가(허브),
// 하나를 고르면 같은 화면 안에서 상세 뷰로 전환된다(빵 지도의 selectedId 패턴과 동일).
export default function TourPage({
  onShowBakeryMap,
  initialDistrict = null,
  initialSelectedId = null,
  cameFromReveal = false, // 관광모아 결과 카드에서 바로 상세로 들어온 경우
  onExitToReveal, // 그 경우의 "뒤로가기" 목적지(허브 그리드가 아니라 결과 화면)
}) {
  const { tagged: ATTRACTIONS, loading } = useAttractions()
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [district, setDistrict] = useState(initialDistrict) // null = 전체
  const [theme, setTheme] = useState(null) // null = 전체
  const [companion, setCompanion] = useState(null) // null = 전체
  const [page, setPage] = useState(1)
  const selected = ATTRACTIONS.find((a) => a.id === selectedId) || null
  const filtered = useMemo(() => {
    let list = district ? ATTRACTIONS.filter((a) => (a.addr || '').includes(district)) : ATTRACTIONS
    if (theme) list = list.filter((a) => a.themes?.includes(theme))
    if (companion) {
      list = [...list].sort((a, b) => (b.companion?.[companion] ?? 0) - (a.companion?.[companion] ?? 0))
    }
    return list
  }, [ATTRACTIONS, district, theme, companion])

  // 딥링크(initialSelectedId)로 들어온 경우, 데이터가 아직 로딩 중이면 ATTRACTIONS가 비어있어
  // selected를 못 찾는다 — 그대로 두면 상세뷰 대신 허브 그리드가 잠깐 잘못 보였다가(§finding3)
  // 데이터 도착 후에야 상세뷰로 바뀐다. 로딩 중엔 허브를 그리지 않고 기다린다.
  if (loading && selectedId) {
    return (
      <div className="tour-hub">
        <div className="banner">불러오는 중…</div>
      </div>
    )
  }

  if (selected) {
    return (
      <AttractionDetail
        attraction={selected}
        onBack={
          cameFromReveal && selectedId === initialSelectedId
            ? () => onExitToReveal?.()
            : () => setSelectedId(null)
        }
        onShowBakeryMap={onShowBakeryMap}
      />
    )
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // 필터를 바꾸면 목록이 새로 좁혀지므로 페이지도 1로 되돌린다.
  const selectDistrict = (d) => {
    setDistrict(d)
    setPage(1)
  }
  const selectTheme = (t) => {
    setTheme(t)
    setPage(1)
  }
  const selectCompanion = (c) => {
    setCompanion(c)
    setPage(1)
  }

  return (
    <div className="tour-hub">
      <header className="tour-hub-header">
        <h2>관광명소도 모아모아</h2>
        <p>대전의 다양한 관광명소와 그 근처 빵집도 둘러보세요! ({filtered.length}곳)</p>
      </header>
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
      <div className="bm-district-filters">
        <button
          type="button"
          className={'bm-district-chip' + (!theme ? ' active' : '')}
          onClick={() => selectTheme(null)}
        >
          테마 전체
        </button>
        {THEME_OPTIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'bm-district-chip' + (theme === t.id ? ' active' : '')}
            onClick={() => selectTheme(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="bm-district-filters">
        <button
          type="button"
          className={'bm-district-chip' + (!companion ? ' active' : '')}
          onClick={() => selectCompanion(null)}
        >
          동행 전체
        </button>
        {COMPANION_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={'bm-district-chip' + (companion === c.id ? ' active' : '')}
            onClick={() => selectCompanion(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="tour-grid">
        {pageItems.map((a) => (
          <button type="button" key={a.id} className="tour-tile" onClick={() => setSelectedId(a.id)}>
            <img src={a.image} alt={a.name} loading="lazy" />
            <span className="tour-tile-name">{a.name}</span>
          </button>
        ))}
        {pageItems.length === 0 && (
          <p className="tour-empty">
            {loading ? '불러오는 중…' : '조건에 맞는 명소가 없어요. 필터를 조금 넓혀보세요.'}
          </p>
        )}
      </div>
      <TourPagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  )
}

function TourPagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <nav className="tour-pagination" aria-label="페이지 선택">
      <button type="button" className="tour-page-nav" disabled={page === 1} onClick={() => onChange(page - 1)}>
        ‹
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          className={'tour-page-btn' + (p === page ? ' active' : '')}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="tour-page-nav"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        ›
      </button>
    </nav>
  )
}

// 관광지 상세 뷰. contentId(=attraction.id)가 있으면 detailCommon2 로 설명(overview)·전화(tel)를 보강한다.
function AttractionDetail({ attraction, onBack, onShowBakeryMap }) {
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [preciseAddr, setPreciseAddr] = useState(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [hours, setHours] = useState(null)
  const [rest, setRest] = useState('')
  const { id, name, image, addr, lat, lng, contentTypeId } = attraction

  useEffect(() => {
    setDescExpanded(false)
  }, [id])

  useEffect(() => {
    setDetail(null)
    if (!id || !tourEnabled()) return
    let alive = true
    setDetailLoading(true)
    getDetail(id)
      .then((d) => alive && setDetail(d))
      .catch(() => {})
      .finally(() => alive && setDetailLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  // 영업시간/휴무 — 목록엔 안 담고 상세를 열 때만 그때 조회한다(186곳 전부를 매번 부를 필요 없음).
  useEffect(() => {
    setHours(null)
    setRest('')
    if (!id || !contentTypeId || !tourEnabled()) return
    let alive = true
    getAttractionIntro(id, contentTypeId)
      .then((intro) => {
        if (!alive || !intro) return
        setHours(parseHours(intro.rawHours))
        setRest(intro.rest)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id, contentTypeId])

  // 관광공사 정적 주소가 "OO동"까지만 있는 경우가 많아, 좌표로 도로명 주소를 보강한다.
  useEffect(() => {
    setPreciseAddr(null)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !kakaoLocalEnabled()) return
    let alive = true
    reverseGeocodeAddress(lat, lng)
      .then((a) => alive && setPreciseAddr(a))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [lat, lng])

  const badge = hoursBadgeText(hours)
  const displayAddr = preciseAddr || addr
  const { text: overviewText, source: overviewSource } = splitOverview(detail?.overview)
  const isDescLong = overviewText.length > DESC_MAX
  const overview =
    isDescLong && !descExpanded ? `${overviewText.slice(0, DESC_MAX)}…` : overviewText

  return (
    <div className="tour-detail">
      <div className="tour-detail-header">
        <button type="button" className="tour-back" onClick={onBack} aria-label="돌아가기">
          <svg viewBox="0 0 16 28" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 4 3 14 13 24" />
          </svg>
        </button>
      </div>
      <div className="tour-detail-body">
        {image && <img className="tour-detail-img" src={image} alt={name} />}
        <div className="tour-detail-info">
          <div className="tour-detail-name-row">
            <h2>{name}</h2>
            {badge && (
              <span className={'badge' + (badge.startsWith('영업 중') ? ' open' : ' closed')}>
                {badge}
              </span>
            )}
          </div>
          {displayAddr && <p className="tour-detail-addr">📍 {displayAddr}</p>}
          {hours?.open && hours?.close && (
            <p className="tour-detail-hours">🕒 {hours.open} ~ {hours.close}</p>
          )}
          {detail?.tel && <p className="tour-detail-tel">📞 {detail.tel}</p>}
          {rest && <p className="tour-detail-rest">📅 휴무: {rest}</p>}
          {overview ? (
            <>
              <p className="tour-detail-desc">
                {overview}
                {isDescLong && (
                  <button
                    type="button"
                    className="tour-desc-toggle"
                    onClick={() => setDescExpanded((v) => !v)}
                  >
                    {descExpanded ? '접기' : '더보기'}
                  </button>
                )}
              </p>
              {overviewSource && <p className="tour-detail-source">🔖 출처: {overviewSource}</p>}
            </>
          ) : (
            detailLoading && <p className="tour-detail-desc tour-detail-desc-loading">설명을 불러오는 중…</p>
          )}
          <button
            type="button"
            className="primary-btn tour-nearby-btn"
            onClick={() => onShowBakeryMap({ name, lat, lng })}
          >
            근처 빵집 보기 →
          </button>
        </div>
      </div>
    </div>
  )
}
