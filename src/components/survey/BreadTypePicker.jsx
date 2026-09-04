import { BREAD_CANDIDATES } from '../../data/breadCandidates'

// 빵 종류 바로가기(이슈 #73 B1) — 먹고 싶은 빵이 이미 정해진 사용자를 위한 지름길.
// 설문 0단계(출발지 선택) 아래에 놓여, 칩을 누르면 설문을 통째로 건너뛰고 그 빵으로
// 바로 결과(간략 리빌 → 지도)로 이동한다. 칩만 렌더하고 제목/설명은 호출부가 붙인다.
export default function BreadTypePicker({ onPick }) {
  return (
    <div className="survey-bread-chips">
      {BREAD_CANDIDATES.map((bread) => (
        <button
          key={bread.id}
          type="button"
          className="survey-bread-chip"
          onClick={() => onPick(bread.id)}
        >
          <img className="survey-bread-chip-img" src={bread.illustration} alt="" aria-hidden="true" />
          {bread.name}
        </button>
      ))}
    </div>
  )
}
