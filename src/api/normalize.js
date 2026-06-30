// 서로 다른 소스(관광공사 / 카카오)를 공통 Bakery 객체로 정규화하고 병합한다.
// 화면 컴포넌트는 이 Bakery 형태만 알면 된다.
//
// Bakery = {
//   id, source, name, address, phone, lat, lng,
//   category, thumbnail, url, contentId, contentTypeId, tags[]
// }
import { deriveTags } from '../data/tasteTags'

// 관광공사 KorService2 아이템 → Bakery
export function normalizeTour(item) {
  const lat = parseFloat(item.mapy)
  const lng = parseFloat(item.mapx)
  const b = {
    id: `tour:${item.contentid}`,
    source: 'tour',
    name: item.title || '',
    address: item.addr1 || '',
    phone: item.tel || '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    category: item.cat3 || item.lclsSystm3 || '',
    thumbnail: item.firstimage || item.firstimage2 || null,
    url: null,
    contentId: item.contentid || null,
    contentTypeId: item.contenttypeid || null,
  }
  b.tags = deriveTags(b)
  return b
}

// 카카오 로컬 document → Bakery
export function normalizeKakao(doc) {
  const lat = parseFloat(doc.y)
  const lng = parseFloat(doc.x)
  const b = {
    id: `kakao:${doc.id}`,
    source: 'kakao',
    name: doc.place_name || '',
    address: doc.road_address_name || doc.address_name || '',
    phone: doc.phone || '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    category: doc.category_name || '',
    thumbnail: null,
    url: doc.place_url || null,
    contentId: null,
    contentTypeId: null,
  }
  b.tags = deriveTags(b)
  return b
}

// 이름 정규화 (공백/괄호/지점표기 제거) — 중복 판정용
function nameKey(name) {
  return (name || '')
    .replace(/\s+/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/(본점|점|지점)$/g, '')
    .toLowerCase()
}

// 이름+좌표(약 100m 격자) 복합 키.
// 이름만 쓰면 프랜차이즈(뚜레쥬르·파리바게뜨 등)의 서로 다른 지점이 전부 한 곳으로 합쳐진다.
// → 좌표(소수 3자리 ≈ 111m)를 키에 섞어 다른 지점은 살리고, 같은 가게(타 소스)는 병합한다.
function dedupKey(b) {
  return `${nameKey(b.name)}@${b.lat.toFixed(3)},${b.lng.toFixed(3)}`
}

// 좌표 없는 항목 제거 + 중복 병합.
//  1) 카카오는 멀티쿼리로 같은 가게가 여러 번 오므로 place id 로 1차 dedup
//  2) 관광공사 우선(상세/대표이미지 풍부)으로 두고, 이름+좌표 키로 카카오 보강/추가
export function mergeBakeries(tourItems, kakaoDocs) {
  // 1) 카카오 원본 place id 기준 1차 중복 제거
  const seenId = new Set()
  const kakaoUniqDocs = kakaoDocs.filter((d) => {
    const id = d?.id
    if (!id) return true
    if (seenId.has(id)) return false
    seenId.add(id)
    return true
  })

  const tour = tourItems.map(normalizeTour).filter((b) => b.lat && b.lng)
  const kakao = kakaoUniqDocs.map(normalizeKakao).filter((b) => b.lat && b.lng)

  // 2) 이름+좌표 복합 키로 병합
  const byKey = new Map()
  for (const b of tour) byKey.set(dedupKey(b), b)
  for (const b of kakao) {
    const k = dedupKey(b)
    if (byKey.has(k)) {
      // 이미 있으면: 비어있는 필드만 카카오 값으로 채운다
      const exist = byKey.get(k)
      exist.phone = exist.phone || b.phone
      exist.url = exist.url || b.url
      exist.address = exist.address || b.address
    } else {
      byKey.set(k, b)
    }
  }
  return [...byKey.values()]
}
