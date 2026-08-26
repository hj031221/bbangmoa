import { useEffect, useMemo, useState } from 'react'
import { fetchAttractions } from '../api'
import { tagSite } from '../lib/attractionTagging.js'
import { useAppStore } from '../store/useAppStore'

// 관광지 데이터 접근 창구. 화면들은 daejeonTour.json / TAGGED_ATTRACTIONS 를 직접
// import 하지 말고 이 훅을 통해 가져온다.
//
// 관광공사 areaBasedList2(관광지+문화시설)를 지역당 세션 1회 실시간 호출한다.
// (인메모리 캐시일 뿐 로컬 저장소/디스크에 쓰지 않음 — 새로고침하면 다시 호출된다.)
//
//   tagged  : 태그(themes/traits/companion) 부여된 관광지[] — 이미지 있는 것만 (추천·상세용)
//   raw     : 태그 없는 원본 관광지[] — 이미지 유무 무관 전체 (좌표 매칭 등 폭넓게 쓸 때)
//   loading : 로딩 중 여부
//   error   : 에러 객체 | null
const cache = new Map() // regionId → 정규화된 attraction[]

export function useAttractions() {
  const regionId = useAppStore((s) => s.regionId)
  const [all, setAll] = useState(() => cache.get(regionId) || [])
  const [loading, setLoading] = useState(!cache.has(regionId))
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true

    if (cache.has(regionId)) {
      setAll(cache.get(regionId))
      setLoading(false)
      return
    }

    setLoading(true)
    fetchAttractions(regionId)
      .then((items) => {
        if (!alive) return
        cache.set(regionId, items)
        setAll(items)
      })
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [regionId])

  const tagged = useMemo(() => all.filter((a) => a.image).map(tagSite), [all])

  return { tagged, raw: all, loading, error }
}
