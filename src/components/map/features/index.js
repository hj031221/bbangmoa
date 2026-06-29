// ★ 지도 확장기능 레지스트리 (플러그인 포인트) ★
//
// 사용자가 줄 "지도 추가기능 리스트"를 여기에 모듈로 등록한다.
// 각 기능 = { id, label, enabled, setup({ map, kakao }) => cleanupFn? }
//   - enabled: true 인 기능만 MapView 가 실행한다 (켜고/끄기)
//   - setup: 지도 준비 완료 후 1회 호출. 정리 함수를 반환하면 언마운트 시 호출된다.
//
// 아래는 패턴 예시(클러스터링). 기본은 enabled:false 로 꺼두었다.
// 새 기능을 추가하려면 객체 하나를 배열에 더하기만 하면 된다.

const clustering = {
  id: 'clustering',
  label: '마커 클러스터링',
  enabled: false, // 사용자가 원하면 true 로
  setup({ map, kakao }) {
    if (!kakao.maps.MarkerClusterer) return
    // 실제 클러스터링은 MarkerLayer 와 마커 소유권을 조율해야 하므로
    // 기능 확정 시 MarkerLayer 와 함께 연결한다. 지금은 골격만.
    // const clusterer = new kakao.maps.MarkerClusterer({ map, averageCenter: true, minLevel: 6 })
    // return () => clusterer.clear()
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

// MapView 가 실제로 실행할 기능 = enabled 인 것만
export function getEnabledFeatures() {
  return MAP_FEATURES.filter((f) => f.enabled)
}
