// 대전시 공식 "대전의 맛" 빵집 목록(daejeon.go.kr, 2026-08 기준 100곳)에서 뽑은
// "이 빵집은 실제로 이 빵을 판다"는 큐레이션 데이터.
// Kakao/관광공사 API 는 빵집의 name/address/category 만 줄 뿐 메뉴 정보가 없어서,
// 빵 타입 keyword 를 빵집 이름/카테고리 문자열에 substring 매칭하는 것만으로는
// (특히 치아바타/포카치아/퀸아망처럼 상호명에 잘 안 들어가는 빵일수록) 매칭이 잘 안 되는 문제가 있었다.
// 이 파일은 그 빈틈을 메우는 보조 데이터로, src/lib/breadRecommend.js 의 matchBakeries 가
// keyword 매칭보다 먼저 확인한다.
//
// breadIds 는 원본 대표메뉴 문구를 src/data/breadCandidates.js 의 20종 ID 로 수동 분류한 것이라
// 근사치다(예: "치즈식빵"→breadLoaf, "휘낭시에"만 있고 대응 항목이 없으면 매칭 없음).
// dong 은 참고용(원본 목록의 구/동 표기)일 뿐 실제 좌표 매칭에는 쓰지 않는다 — 이름으로만 연결한다.
export const BAKERY_BREAD_MENU = [
  { name: '레시피', dong: '대덕구 중리동', breadIds: ['breadLoaf', 'saltBread'] },
  { name: '춘당사', dong: '대덕구 송촌동', breadIds: [] },
  { name: '오늘의빵집', dong: '대덕구 덕암동', breadIds: ['campagne', 'croissant'] },
  { name: '빵굽는나라', dong: '대덕구 석봉동', breadIds: ['croissant', 'creamBread'] },
  { name: '디아베이커리', dong: '대덕구 법동', breadIds: ['cake', 'redBeanBread'] },
  { name: '가또앤브레드', dong: '대덕구 송촌동', breadIds: ['redBeanBread', 'creamBread'] },
  { name: '에코브레드하우스', dong: '대덕구 비래동', breadIds: ['saltBread'] },
  { name: '스톤봉베이크샵', dong: '대덕구 석봉동', breadIds: ['scone'] },
  { name: '오렌지블로썸', dong: '대덕구 송촌동', breadIds: ['breadLoaf', 'eggTart'] },
  { name: '보보로베이커리', dong: '대덕구 송촌동', breadIds: ['baguette', 'saltBread'] },

  { name: '몽심', dong: '대덕구 오정동', breadIds: ['madeleine', 'saltBread', 'breadLoaf'] },
  { name: '한스브레드', dong: '유성구 상대동', breadIds: ['croissant', 'breadLoaf', 'redBeanBread'] },
  { name: '파이코코', dong: '유성구 문지동', breadIds: ['eggTart'] },
  { name: '토우베이크하우스', dong: '유성구 신성동', breadIds: ['saltBread'] },
  { name: '이츠올라잇', dong: '유성구 궁동', breadIds: ['madeleine', 'saltBread', 'scone'] },
  { name: '오씨또베이커스', dong: '유성구 죽동', breadIds: ['baguette', 'croissant', 'ciabatta'] },
  { name: '써틴브레드', dong: '유성구 지족동', breadIds: ['ciabatta', 'baguette', 'saltBread', 'eggTart'] },
  { name: '빨강벽돌집', dong: '유성구 원내동', breadIds: ['cake', 'croissant'] },
  { name: '밀로베이크샵', dong: '유성구 궁동', breadIds: ['saltBread', 'ciabatta', 'bagel', 'scone'] },
  { name: '리피피', dong: '유성구 신성동', breadIds: [] },

  { name: '라 프레즈', dong: '유성구 지족동', breadIds: ['breadLoaf', 'saltBread'] },
  { name: '이상화베이커리', dong: '유성구 죽동', breadIds: ['donut', 'ciabatta'] },
  { name: '마들렌과자점', dong: '유성구 지족동', breadIds: ['madeleine'] },
  { name: '리저트 베이크샵', dong: '유성구 노은동', breadIds: ['saltBread', 'ciabatta'] },
  { name: '파티세리소신', dong: '유성구 궁동', breadIds: ['eggTart'] },
  { name: '파셀', dong: '유성구 죽동', breadIds: ['baguette', 'focaccia'] },
  { name: '크리베리', dong: '유성구 봉명동', breadIds: ['breadLoaf', 'redBeanBread', 'donut'] },
  { name: '베이커리아른', dong: '유성구 도룡동', breadIds: ['scone'] },
  { name: '르뺑99-1', dong: '유성구 봉명동', breadIds: ['croissant'] },
  { name: '은샘치아바타', dong: '유성구 신성동', breadIds: ['ciabatta'] },

  { name: '베이커리하모니', dong: '유성구 상대동', breadIds: ['baguette', 'ciabatta', 'saltBread'] },
  { name: '오드카라멜', dong: '유성구 상대동', breadIds: ['croissant', 'cake', 'kouignAmann'] },
  { name: '하루팡', dong: '유성구 봉명동', breadIds: [] },
  { name: '파이룸', dong: '유성구 봉명동', breadIds: ['madeleine', 'eggTart'] },
  { name: '시나피 건강빵 연구소', dong: '유성구 지족동', breadIds: ['breadLoaf', 'redBeanBread'] },
  { name: '시나몬', dong: '유성구 죽동', breadIds: ['saltBread'] },
  { name: '슬로우브레드', dong: '유성구 전민동', breadIds: ['croissant', 'madeleine'] },
  { name: '베이커리온쉼', dong: '유성구 학하동', breadIds: ['ciabatta'] },
  { name: '그린베이커리', dong: '유성구 관평동', breadIds: ['eggTart'] },
  { name: '연선흠베이커리', dong: '유성구 지족동', breadIds: ['saltBread'] },

  { name: '꾸드뱅', dong: '유성구 지족동', breadIds: ['cake', 'croissant', 'eggTart'] },
  { name: '북촌35', dong: '서구 관저동', breadIds: [] },
  { name: '햐로', dong: '서구 도안동', breadIds: ['baguette', 'ciabatta'] },
  { name: '코리아팥빵', dong: '서구 둔산동', breadIds: ['redBeanBread'] },
  { name: '작은빵집 토포', dong: '서구 도안동', breadIds: ['baguette'] },
  { name: '원주율', dong: '서구 탄방동', breadIds: [] },
  { name: '오픈오븐', dong: '서구 갈마동', breadIds: ['saltBread', 'eggTart'] },
  { name: '비머스트', dong: '서구 도안동', breadIds: ['saltBread', 'cake', 'ciabatta'] },
  { name: '몽글베이커리', dong: '서구 도안동', breadIds: ['breadLoaf'] },
  { name: '만년빵집', dong: '서구 만년동', breadIds: ['ciabatta', 'breadLoaf', 'campagne'] },

  { name: '당신을위한빵집', dong: '서구 월평동', breadIds: ['baguette'] },
  { name: '달코미', dong: '서구 관저동', breadIds: ['redBeanBread', 'campagne', 'breadLoaf'] },
  { name: '나무상자', dong: '서구 갈마동', breadIds: ['baguette'] },
  { name: '트리플디', dong: '서구 둔산동', breadIds: ['cake'] },
  { name: '손수베이커리', dong: '서구 관저동', breadIds: [] },
  { name: '빵앗간', dong: '서구 관저동', breadIds: ['anBread'] },
  { name: '빵드슈', dong: '서구 둔산동', breadIds: ['saltBread', 'eggTart'] },
  { name: '몰랑몰랑', dong: '서구 관저동', breadIds: ['breadLoaf', 'saltBread'] },
  { name: '다람당', dong: '서구 둔산동', breadIds: ['saltBread', 'scone', 'bagel'] },
  { name: '시오네 베이크샵', dong: '서구 탄방동', breadIds: ['saltBread', 'eggTart'] },

  { name: '라블랑제', dong: '서구 도안동', breadIds: ['bagel', 'baguette'] },
  { name: '관저당', dong: '서구 관저동', breadIds: ['baguette'] },
  { name: '캘리포니아베이커리', dong: '서구 둔산동', breadIds: [] },
  { name: '내가잘가는빵집', dong: '서구 갈마동', breadIds: ['breadLoaf', 'saltBread'] },
  { name: '플래닛타르트', dong: '서구 갈마동', breadIds: ['eggTart'] },
  { name: '싶빵공장', dong: '서구 도안동', breadIds: ['croissant'] },
  { name: '소솜', dong: '서구 도안동', breadIds: [] },
  { name: '베이크오프', dong: '서구 관저동', breadIds: ['baguette'] },
  { name: '케이크퍼즐', dong: '서구 갈마동', breadIds: ['madeleine', 'eggTart'] },
  { name: '마이츄이브레드', dong: '서구 관저동', breadIds: ['croissant', 'saltBread'] },

  { name: '블루본즈베이크플레이스', dong: '중구 대흥동', breadIds: ['saltBread'] },
  { name: '백조베이커리', dong: '중구 은행동', breadIds: ['breadLoaf'] },
  { name: '문화동베이커리', dong: '중구 문화동', breadIds: ['saltBread', 'breadLoaf'] },
  { name: '두건호텔리어', dong: '중구 태평동', breadIds: ['saltBread'] },
  { name: '다다제과점', dong: '중구 오류동', breadIds: [] },
  { name: '정직한롤케이크', dong: '중구 용두동', breadIds: [] },
  { name: '오븐브라더스', dong: '중구 목동', breadIds: ['eggTart'] },
  { name: '버터포인트', dong: '중구 오류동', breadIds: ['saltBread'] },
  { name: '버터업', dong: '중구 대사동', breadIds: ['eggTart'] },
  { name: '로삐아노', dong: '중구 문화동', breadIds: ['breadLoaf', 'donut'] },

  { name: '굿베이글', dong: '중구 문화동', breadIds: ['bagel'] },
  { name: '극동제과', dong: '중구 대사동', breadIds: [] },
  { name: '정성을다하는 베이커리', dong: '중구 유천동', breadIds: ['redBeanBread', 'friedBread'] },
  { name: '로로네베이커리', dong: '중구 대흥동', breadIds: ['breadLoaf'] },
  { name: '콜드버터베이크샵', dong: '중구 대흥동', breadIds: ['saltBread', 'eggTart'] },
  { name: '세이비건', dong: '중구 선화동', breadIds: ['ciabatta', 'cake'] },
  { name: '소금한조각', dong: '동구 자양동', breadIds: ['saltBread'] },
  { name: '스노이', dong: '동구 삼성동', breadIds: ['bagel'] },
  { name: '크로바제과점', dong: '동구 용운동', breadIds: ['breadLoaf'] },
  { name: '굿베이커리', dong: '동구 가양동', breadIds: ['breadLoaf', 'ciabatta', 'creamBread'] },

  { name: '요이그', dong: '동구 용운동', breadIds: ['bagel'] },
  { name: '롤라', dong: '동구 신촌동', breadIds: ['cake'] },
  { name: '모모베이커리', dong: '동구 대성동', breadIds: ['baguette', 'cake'] },
  { name: '모노브레드타임', dong: '동구 가오동', breadIds: ['ciabatta', 'breadLoaf'] },
  { name: '언니네빵집', dong: '동구 가양동', breadIds: ['saltBread'] },
  { name: '프랑세즈', dong: '동구 판암동', breadIds: ['saltBread'] },
  { name: '지은집', dong: '동구 신흥동', breadIds: ['cake', 'eggTart', 'scone'] },
  { name: '나래베이커리', dong: '동구 성남동', breadIds: ['breadLoaf', 'cake'] },
  { name: '파시파시', dong: '동구 성남동', breadIds: ['breadLoaf', 'cake'] },
  { name: '정동문화사', dong: '동구 원동', breadIds: ['eggTart'] },
]

import { nameKey } from '../api/normalize'

const BAKERY_BREAD_MENU_BY_KEY = new Map(
  BAKERY_BREAD_MENU.map((entry) => [nameKey(entry.name), entry.breadIds]),
)

// 실제 API 빵집 이름 → 큐레이션된 breadIds[] | null(큐레이션 데이터에 없는 빵집)
export function curatedBreadIdsFor(bakeryName) {
  return BAKERY_BREAD_MENU_BY_KEY.get(nameKey(bakeryName)) ?? null
}
