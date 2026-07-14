import { create } from 'zustand'
import { DEFAULT_REGION } from '../config/regions'

// 앱 전역 상태 (가볍게 유지)
//  - answers: 설문 응답 { [questionId]: optionId }
//  - regionId: 현재 지역
//  - selectedBakeryId: 지도/카드에서 선택된 빵집
export const useAppStore = create((set) => ({
  regionId: DEFAULT_REGION,
  answers: {},
  selectedBakeryId: null,

  setAnswer: (questionId, optionId) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: optionId } })),

  resetAnswers: () => set({ answers: {}, selectedBakeryId: null }),

  selectBakery: (id) => set({ selectedBakeryId: id }),
}))
