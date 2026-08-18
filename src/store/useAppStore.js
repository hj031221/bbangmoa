import { create } from 'zustand'
import { DEFAULT_REGION } from '../config/regions'

// 앱 전역 상태 (가볍게 유지)
//  - answers: 빵모아 설문 응답 { [questionId]: optionId }
//  - tourAnswers: 관광모아 설문 응답 { [questionId]: optionId } — answers와 별개 네임스페이스로 둔다.
//                 두 설문 모두 질문 id가 q0~q5라 같은 객체를 쓰면 응답이 서로 덮어써진다.
//  - regionId: 현재 지역(도시 단위, 지금은 대전 하나)
//  - origin: 설문 0단계에서 고른 정밀 출발 위치 { lat, lng, label, source }
//            source: 'preset' | 'gps' | 'pick'. 결과(거리·정렬)로 흐른다.
//  - district: (호환용) 옛 구 선택 상태 — 검색 필터로는 더 이상 안 씀
//  - selectedBakeryId: 지도/카드에서 선택된 빵집
export const useAppStore = create((set) => ({
  regionId: DEFAULT_REGION,
  origin: null,
  district: null,
  answers: {},
  tourAnswers: {},
  selectedBakeryId: null,

  setAnswer: (questionId, optionId) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: optionId } })),

  setTourAnswer: (questionId, optionId) =>
    set((s) => ({ tourAnswers: { ...s.tourAnswers, [questionId]: optionId } })),

  setOrigin: (origin) => set({ origin }),

  setDistrict: (district) => set({ district }),

  resetAnswers: () =>
    set({ answers: {}, origin: null, district: null, selectedBakeryId: null }),

  resetTourAnswers: () => set({ tourAnswers: {} }),

  selectBakery: (id) => set({ selectedBakeryId: id }),
}))
