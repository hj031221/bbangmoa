import { BREAD_CANDIDATES } from '../../data/breadCandidates'

// 홈 화면 "바로 찾기" (이슈 #73 B1) — 먹고 싶은 빵이 이미 정해진 사용자를 위한 지름길.
// 칩을 누르면 취향 설문을 건너뛰고 그 빵으로 바로 결과(간략 리빌 → 지도)로 이동한다.
export default function BreadTypePicker({ onPick }) {
  return (
    <section className="bm-bread-picker" id="bm-bread-picker">
      <h2 className="bm-bread-picker-title">바로 찾기</h2>
      <p className="bm-bread-picker-desc">
        먹고 싶은 빵이 정해졌다면, 설문 없이 바로 골라보세요
      </p>
      <div className="bm-bread-picker-chips">
        {BREAD_CANDIDATES.map((bread) => (
          <button
            key={bread.id}
            type="button"
            className="bm-bread-chip"
            onClick={() => onPick(bread.id)}
          >
            <span className="bm-bread-chip-emoji" aria-hidden="true">
              {bread.emoji}
            </span>
            {bread.name}
          </button>
        ))}
      </div>
    </section>
  )
}
