// Append without changing existing stops or the user's visit order.
export function appendCourseStops(stops = [], orderIds, additions = []) {
  const ids = new Set(stops.map((stop) => stop.id))
  const added = additions.filter((stop) => {
    if (ids.has(stop.id)) return false
    ids.add(stop.id)
    return true
  })
  return {
    stops: [...stops, ...added],
    orderIds: [...(orderIds || stops.map((stop) => stop.id)), ...added.map((stop) => stop.id)],
  }
}
