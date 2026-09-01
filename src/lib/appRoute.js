export const APP_VIEW_PATHS = Object.freeze({
  home: '/',
  info: '/info',
  bread: '/bread-finder',
  map: '/bread-map',
  tour: '/tour',
  pilgrimage: '/pilgrimage',
  mypage: '/mypage',
})

const VIEW_BY_PATH = new Map(
  Object.entries(APP_VIEW_PATHS).map(([view, path]) => [path, view]),
)

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

export function getAppView(pathname) {
  return VIEW_BY_PATH.get(normalizePathname(pathname)) ?? 'home'
}

export function getAppPath(view) {
  return APP_VIEW_PATHS[view] ?? APP_VIEW_PATHS.home
}
