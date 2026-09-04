// 6) 지금 시작하기 — 마지막 행동 유도. Hero 와 동일한 CTA 로 이어준다.
export default function FinalCta({ onStart }) {
  return (
    <section className="bm-final" id="bm-final">
      <h2>이제 당신만의 빵지순례를 시작하세요</h2>
      <button className="bm-btn-primary" onClick={onStart}>
        내 취향 빵집은?
      </button>
    </section>
  )
}
