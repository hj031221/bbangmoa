// ⚠️ 폴백 전용 샘플. API 키가 하나도 설정되지 않았을 때만 화면이 비지 않도록 보여준다.
// 키가 설정되면 실제 API 응답으로 완전히 대체된다. (목업 우선 개발이 아님 — 빈 화면 방지용)
// 좌표는 대략값이며 데모 표시용일 뿐이다.
export const SAMPLE_BAKERIES = [
  { id: 'sample:1', source: 'sample', name: '성심당 본점', address: '대전 중구 대종로480번길 15', phone: '', lat: 36.3277, lng: 127.4276, category: '베이커리', thumbnail: null, url: null, tags: ['famous', 'meal', 'togo'] },
  { id: 'sample:2', source: 'sample', name: '성심당 케익부띠끄', address: '대전 중구 은행동', phone: '', lat: 36.3271, lng: 127.4271, category: '디저트·케이크', thumbnail: null, url: null, tags: ['dessert', 'famous'] },
  { id: 'sample:3', source: 'sample', name: '하레하레 둔산점', address: '대전 서구 둔산동', phone: '', lat: 36.3515, lng: 127.3781, category: '베이커리카페', thumbnail: null, url: null, tags: ['mood', 'dessert'] },
  { id: 'sample:4', source: 'sample', name: '동네 소금빵집', address: '대전 유성구 봉명동', phone: '', lat: 36.3540, lng: 127.3360, category: '소금빵·식사빵', thumbnail: null, url: null, tags: ['meal', 'value'] },
  { id: 'sample:5', source: 'sample', name: '관저동 가성비베이커리', address: '대전 서구 관저동', phone: '', lat: 36.2962, lng: 127.3320, category: '동네빵집', thumbnail: null, url: null, tags: ['value', 'meal'] },
]
