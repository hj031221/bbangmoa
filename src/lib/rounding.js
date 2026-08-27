// 각 값을 반올림하되 합계가 정확히 targetSum이 되도록 보정한다(최대 나머지법). 구간별로 각자
// Math.round 하면 합이 총계(헤더 표시값)와 어긋날 수 있다(예: 11+11+11=33분인데 헤더는
// 반올림된 32분 — 대전한바퀴 구간별 시간 표시에서 실제로 겪은 문제). 나머지가 큰 항목부터
// 하나씩 올림해 합을 맞춘다.
// src/api/*.js는 import.meta.env를 참조해 plain node --test로 직접 import가 안 되므로,
// 이 함수처럼 API 파일 안에서만 쓰이는 순수 유틸도 테스트하려면 lib/에 둬야 한다.
export function roundToSum(values, targetSum) {
  const floors = values.map(Math.floor)
  const remainder = targetSum - floors.reduce((a, b) => a + b, 0)
  const order = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  const result = [...floors]
  for (let k = 0; k < remainder && k < order.length; k++) result[order[k].i] += 1
  return result
}
