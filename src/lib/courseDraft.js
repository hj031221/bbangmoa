// 코스 하나에 담을 수 있는 경유지 최대 개수.
export const MAX_COURSE_STOPS = 6

// Append without changing existing stops or the user's visit order.
// 상한(MAX_COURSE_STOPS)을 넘는 추가분은 버리고 개수를 dropped 로 알려준다.
export function appendCourseStops(stops = [], orderIds, additions = []) {
  const ids = new Set(stops.map((stop) => stop.id))
  const fresh = additions.filter((stop) => {
    if (ids.has(stop.id)) return false
    ids.add(stop.id)
    return true
  })
  const room = Math.max(0, MAX_COURSE_STOPS - stops.length)
  const added = fresh.slice(0, room)
  return {
    stops: [...stops, ...added],
    orderIds: [...(orderIds || stops.map((stop) => stop.id)), ...added.map((stop) => stop.id)],
    dropped: fresh.length - added.length,
  }
}
