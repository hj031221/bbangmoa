import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStampCardSvg } from './stampShareImage.js'

const STAMP = {
  perDistrict: [
    { name: '동구', count: 3, target: 3, completedSlots: 3, goalPct: 100, completed: true },
    { name: '중구', count: 1, target: 3, completedSlots: 1, goalPct: 33, completed: false },
    { name: '서구', count: 0, target: 3, completedSlots: 0, goalPct: 0, completed: false },
    { name: '유성구', count: 0, target: 3, completedSlots: 0, goalPct: 0, completed: false },
    { name: '대덕구', count: 0, target: 3, completedSlots: 0, goalPct: 0, completed: false },
  ],
  visitedBakeryCount: 4,
  completedSlots: 4,
  totalSlots: 15,
  goalPct: 27,
  completedDistrictCount: 1,
}

test('1080x1350 SVG 문자열을 만든다', () => {
  const svg = buildStampCardSvg({ nickname: '홍길동', stamp: STAMP, targetPerDistrict: 3 })
  assert.ok(svg.startsWith('<svg'), 'svg 로 시작')
  assert.ok(svg.trimEnd().endsWith('</svg>'), 'svg 로 끝')
  assert.match(svg, /width="1080"/)
  assert.match(svg, /height="1350"/)
})

test('닉네임과 핵심 수치가 들어간다', () => {
  const svg = buildStampCardSvg({ nickname: '홍길동', stamp: STAMP, targetPerDistrict: 3 })
  assert.ok(svg.includes('홍길동님의 대전 빵 스탬프'))
  assert.ok(svg.includes('스탬프 4/15'))
  assert.ok(svg.includes('목표 달성률 27%'))
  for (const d of STAMP.perDistrict) assert.ok(svg.includes(d.name), `${d.name} 포함`)
})

test('닉네임이 없으면 "내 대전 빵 스탬프"', () => {
  const svg = buildStampCardSvg({ nickname: null, stamp: STAMP, targetPerDistrict: 5 })
  assert.ok(svg.includes('내 대전 빵 스탬프'))
  assert.ok(!svg.includes('님의 대전 빵 스탬프'))
})

test('닉네임의 특수문자를 이스케이프한다', () => {
  const svg = buildStampCardSvg({ nickname: '<b>&"x', stamp: STAMP, targetPerDistrict: 3 })
  assert.ok(!svg.includes('<b>'), '원본 태그가 그대로 들어가면 안 됨')
  assert.ok(svg.includes('&lt;b&gt;&amp;&quot;x'))
})
