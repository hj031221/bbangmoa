// TMAP 보행자 API의 GeoJSON FeatureCollection 응답을 구간별로 파싱한다(순수 함수 — import.meta.env를
// 안 써서 plain node 테스트가 가능하다. src/api/tmap.js가 fetch 이후 이 함수만 부른다).
//
// 구조(실제 호출로 검증됨, docs/가이드_TMAP_보행자API.md):
//  - 맨 처음 Point(pointType:'SP')의 properties.totalDistance/totalTime이 전체 합계.
//  - LineString feature의 distance/time을 순서대로 누적하면 구간 거리/시간이 나오고,
//    경유지 Point(pointType:'PP1'..'PPn')를 만날 때마다 구간 경계로 끊는다
//    (GP="안내점"은 턴바이턴 안내용이라 구간 경계가 아님 — 무시하고 계속 누적).
//  - 마지막 Point(pointType:'EP')에서 마지막 구간을 닫는다.
//
// pointsCount: 요청에 넣은 지점 개수(출발+경유+도착) — 구간 개수가 안 맞으면(예: passList가
// 무시됐거나 응답이 잘림) 신뢰 안 하고 null(카카오 다중경유지와 동일 원칙).
// → { totalDistance(m), totalTime(초), legs: [{ distanceM, timeS, path:[{lat,lng},...] }] } | null
export function parsePedestrianResponse(data, pointsCount) {
  const features = data?.features || []
  let totalDistance
  let totalTime
  const legs = []
  let curDistance = 0
  let curTime = 0
  let curPath = []

  for (const f of features) {
    const geom = f.geometry
    const props = f.properties || {}
    if (geom?.type === 'Point') {
      const [lng, lat] = geom.coordinates
      if (props.pointType === 'SP') {
        totalDistance = props.totalDistance
        totalTime = props.totalTime
        curPath.push({ lat, lng })
      } else if (props.pointType === 'EP') {
        curPath.push({ lat, lng })
        legs.push({ distanceM: curDistance, timeS: curTime, path: curPath })
      } else if (/^PP\d+$/.test(props.pointType)) {
        curPath.push({ lat, lng })
        legs.push({ distanceM: curDistance, timeS: curTime, path: curPath })
        curPath = [{ lat, lng }]
        curDistance = 0
        curTime = 0
      }
    } else if (geom?.type === 'LineString') {
      curDistance += props.distance || 0
      curTime += props.time || 0
      for (const [lng, lat] of geom.coordinates) curPath.push({ lat, lng })
    }
  }

  if (!Number.isFinite(totalTime) || legs.length !== pointsCount - 1) return null
  return { totalDistance, totalTime, legs }
}
