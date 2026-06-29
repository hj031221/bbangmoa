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

// 좌표 없는 항목 제거 + 이름 기준 중복 병합.
// 관광공사 항목을 우선(상세/대표이미지가 풍부)으로 두고, 카카오로 보강한다.
export function mergeBakeries(tourItems, kakaoDocs) {
  const tour = tourItems.map(normalizeTour).filter((b) => b.lat && b.lng)
  const kakao = kakaoDocs.map(normalizeKakao).filter((b) => b.lat && b.lng)

  const byKey = new Map()
  for (const b of tour) byKey.set(nameKey(b.name), b)
  for (const b of kakao) {
    const k = nameKey(b.name)
    if (byKey.has(k)) {
      // 이미 관광공사에 있으면: 비어있는 필드만 카카오 값으로 채운다
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
