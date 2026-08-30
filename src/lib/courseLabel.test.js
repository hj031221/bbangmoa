import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCourseLabel, formatCourseMeta } from './courseLabel.js'

test('formatCourseLabel: 제목/날짜/스탑 수/이동수단을 조합한다', () => {
  const row = {
    title: '대전한바퀴',
    travel_mode: 'car',
    stops: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    created_at: '2026-08-18T12:00:00.000Z',
  }
  assert.equal(formatCourseLabel(row), '대전한바퀴 · 8/18 저장 · 3곳 · 자동차')
})

test('formatCourseLabel: 이동수단 매핑 — transit/walk', () => {
  const base = { title: '대전한바퀴', stops: [], created_at: '2026-01-05T00:00:00.000Z' }
  assert.equal(formatCourseLabel({ ...base, travel_mode: 'transit' }), '대전한바퀴 · 1/5 저장 · 0곳 · 대중교통')
  assert.equal(formatCourseLabel({ ...base, travel_mode: 'walk' }), '대전한바퀴 · 1/5 저장 · 0곳 · 도보')
})

test('formatCourseLabel: 알 수 없는 이동수단은 원본 값을 그대로 노출', () => {
  const row = { title: '대전한바퀴', travel_mode: 'bike', stops: [], created_at: '2026-01-05T00:00:00.000Z' }
  assert.equal(formatCourseLabel(row), '대전한바퀴 · 1/5 저장 · 0곳 · bike')
})

test('formatCourseMeta: 날짜·스탑 수만 — 이동수단/"저장" 단어는 안 넣는다', () => {
  const row = {
    title: '대전한바퀴',
    travel_mode: 'car',
    stops: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    created_at: '2026-08-18T12:00:00.000Z',
  }
  assert.equal(formatCourseMeta(row), '8/18 · 3곳')
})
