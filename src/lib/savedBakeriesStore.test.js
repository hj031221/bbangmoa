import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// node 환경에는 localStorage 가 없으니 최소 구현을 심는다(스토어가 쓰는 API 는 get/setItem 뿐).
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const {
  getSavedSnapshot, subscribeSaved, setSavedList, reloadSavedFromLocal, toggleSavedBakery,
} = await import('./savedBakeriesStore.js')

const A = { id: 'a', name: '가게A' }
const B = { id: 'b', name: '가게B' }

beforeEach(() => {
  store.clear()
  setSavedList([], { persist: true })
})

test('토글은 항상 최신 공유 스냅샷 기준으로 계산된다 — 낡은 스냅샷을 든 두 번째 호출자가 첫 찜을 지우지 않는다', () => {
  // 화면에 훅 인스턴스가 둘 마운트된 상황 재현: 둘 다 렌더 시점엔 빈 목록([])을 봤다.
  const staleSnapshotSeenByBothComponents = getSavedSnapshot()
  assert.deepEqual(staleSnapshotSeenByBothComponents, [])

  // 인스턴스1이 A를 찜한다.
  toggleSavedBakery(A, { persist: true })
  // 인스턴스2는 아직 리렌더 전이라 낡은 [] 를 들고 있지만, 토글은 스토어 스냅샷을 다시 읽으므로
  // B 를 A 위에 덮어쓰지 않고 A 옆에 더한다.
  toggleSavedBakery(B, { persist: true })

  assert.deepEqual(getSavedSnapshot().map((b) => b.id), ['a', 'b'])
  assert.deepEqual(JSON.parse(localStorage.getItem('bbangmoa_saved')).map((b) => b.id), ['a', 'b'])
})

test('구독자는 어느 인스턴스가 토글하든 즉시 통지받는다', () => {
  let notified = 0
  const unsubscribe = subscribeSaved(() => { notified += 1 })

  toggleSavedBakery(A, { persist: true })
  assert.equal(notified, 1)
  toggleSavedBakery(B, { persist: true })
  assert.equal(notified, 2)

  unsubscribe()
  toggleSavedBakery(A, { persist: true })
  assert.equal(notified, 2, '구독 해제 후에는 통지되지 않는다')
})

test('같은 빵집을 다시 토글하면 목록에서 빠진다', () => {
  toggleSavedBakery(A, { persist: true })
  const { alreadySaved } = toggleSavedBakery(A, { persist: true })
  assert.equal(alreadySaved, true)
  assert.deepEqual(getSavedSnapshot(), [])
})

test('getSnapshot 은 값이 안 바뀌면 같은 참조를 돌려준다(useSyncExternalStore 무한 루프 방지)', () => {
  const first = getSavedSnapshot()
  assert.equal(getSavedSnapshot(), first)
  toggleSavedBakery(A, { persist: true })
  assert.notEqual(getSavedSnapshot(), first)
})

test('persist:false 면 화면 상태만 바뀌고 localStorage 에는 남기지 않는다(로그인 상태 DB 캐시)', () => {
  setSavedList([A], { persist: false })
  assert.deepEqual(getSavedSnapshot().map((b) => b.id), ['a'])
  assert.equal(JSON.parse(localStorage.getItem('bbangmoa_saved')).length, 0)
})

test('reloadSavedFromLocal 은 localStorage 기준으로 되돌린다(로그아웃 복귀)', () => {
  localStorage.setItem('bbangmoa_saved', JSON.stringify([B]))
  setSavedList([A], { persist: false })
  reloadSavedFromLocal()
  assert.deepEqual(getSavedSnapshot().map((b) => b.id), ['b'])
})

test('깨진 localStorage 값은 빈 목록으로 폴백한다', () => {
  localStorage.setItem('bbangmoa_saved', '{not json')
  reloadSavedFromLocal()
  assert.deepEqual(getSavedSnapshot(), [])
})
