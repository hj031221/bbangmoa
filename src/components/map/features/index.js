// ★ 지도 확장기능 레지스트리 (플러그인 포인트) ★
//
// 사용자가 줄 "지도 추가기능 리스트"를 여기에 모듈로 등록한다.
// 각 기능 = { id, label, enabled, setup({ map, kakao }) => cleanupFn? }
//   - enabled: true 인 기능만 MapView 가 실행한다 (켜고/끄기)
//   - setup: 지도 준비 완료 후 1회 호출. 정리 함수를 반환하면 언마운트 시 호출된다.
//
// 새 기능을 추가하려면 객체 하나를 배열에 더하기만 하면 된다.

// 마커 클러스터링: 마커 소유권을 MarkerLayer 와 조율해야 하므로 일반 setup 대신
// create() 팩토리로 MarkerClusterer 인스턴스를 만들어 MapView 가 MarkerLayer 에 넘긴다.
// (generic setup 루프는 my-location 같은 사이드이펙트 전용 기능만 처리)
const clustering = {
  id: 'clustering',
  label: '마커 클러스터링',
  enabled: true,
  minLevel: 6, // 이 레벨 이상(=줌아웃)에서만 묶음. 줌인(레벨<6)하면 개별 마커
  gridSize: 80,
  // MarkerClusterer 인스턴스 생성. SDK clusterer 라이브러리 없으면 null.
  create({ map, kakao }) {
    if (!kakao.maps.MarkerClusterer) return null
    const base = {
      color: '#fff',
      textAlign: 'center',
      fontWeight: '700',
      fontSize: '13px',
      background: 'rgba(224,145,58,0.9)', // 앱 팔레트(주황) — 대전 마스크/윤곽과 충돌 없음
      border: '2px solid #fff',
      boxShadow: '0 1px 4px rgba(74,53,32,0.4)',
    }
    return new kakao.maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: this.minLevel,
      gridSize: this.gridSize,
      disableClickZoom: false, // 클러스터 클릭 시 줌인
      styles: [
        { ...base, width: '38px', height: '38px', borderRadius: '19px', lineHeight: '36px' },
        { ...base, width: '48px', height: '48px', borderRadius: '24px', lineHeight: '46px' },
        { ...base, width: '58px', height: '58px', borderRadius: '29px', lineHeight: '56px' },
      ],
    })
  },
}

const myLocation = {
  id: 'my-location',
  label: '내 위치 표시',
  enabled: false,
  setup({ map, kakao }) {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude)
      new kakao.maps.Marker({ position: loc, map })
    })
  },
}

// 등록된 모든 기능
export const MAP_FEATURES = [clustering, myLocation]

// MapView 가 generic 루프로 실행할 기능 = enabled 이고 setup 을 가진 것만
// (clustering 은 create 로 따로 처리하므로 여기서 제외됨)
export function getEnabledFeatures() {
  return MAP_FEATURES.filter((f) => f.enabled && typeof f.setup === 'function')
}

// 클러스터링 on/off + 인스턴스 팩토리 (MapView 전용)
export function clusteringEnabled() {
  return clustering.enabled
}
export function createClusterer({ map, kakao }) {
  return clustering.enabled ? clustering.create({ map, kakao }) : null
}
