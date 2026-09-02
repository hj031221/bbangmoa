import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStampCardSvg, getStampGoalMessage } from './stampShareImage.js'

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

test('사이트 폰트 CSS를 SVG defs 안에 포함한다', () => {
  const fontCss = '<style>@font-face{font-family:BbangMoa}</style>'
  const svg = buildStampCardSvg({ nickname: '홍길동', stamp: STAMP, targetPerDistrict: 3, fontCss })
  assert.ok(svg.includes(fontCss))
  assert.ok(svg.includes('BbangMoa Round'))
})

test('실제 로고 data URL을 좌측 상단 심볼로 포함한다', () => {
  const logoDataUrl = 'data:image/png;base64,logo-test'
  const svg = buildStampCardSvg({
    nickname: '홍길동',
    stamp: STAMP,
    targetPerDistrict: 3,
    logoDataUrl,
  })
  assert.ok(svg.includes(`href="${logoDataUrl}"`))
  assert.ok(svg.includes('viewBox="0 0 338 375"'))
})

test('목표 달성률 구간별로 카드 상단 문구가 달라진다', () => {
  assert.equal(getStampGoalMessage(0), '첫 스탬프부터 시작해 볼까요?')
  assert.equal(getStampGoalMessage(24), '한 곳씩 빵집을 발견하는 중')
  assert.equal(getStampGoalMessage(49), '빵집을 차근차근 알아가는 중')
  assert.equal(getStampGoalMessage(74), '어느새 절반 넘게 채웠어요')
  assert.equal(getStampGoalMessage(99), '다섯 구 완주가 눈앞이에요')
  assert.equal(getStampGoalMessage(100), '대전 5개 구를 모두 채웠어요')
})

test('이모지 경계에서 닉네임을 잘라도 깨진 surrogate를 만들지 않는다', () => {
  const svg = buildStampCardSvg({
    nickname: 'abcdefghijk😀더긴이름',
    stamp: STAMP,
    targetPerDistrict: 3,
  })
  assert.doesNotThrow(() => encodeURIComponent(svg))
  assert.ok(svg.includes('abcdefghijk😀님의'))
})
