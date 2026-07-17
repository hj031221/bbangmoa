import { create } from 'zustand'
import { DEFAULT_REGION } from '../config/regions'

// 앱 전역 상태 (가볍게 유지)
//  - answers: 설문 응답 { [questionId]: optionId }
//  - regionId: 현재 지역(도시 단위, 지금은 대전 하나)
//  - district: 설문 1단계에서 고른 구(동구/중구/서구/유성구/대덕구 등, 도시 내 세부 지역)
//  - selectedBakeryId: 지도/카드에서 선택된 빵집
export const useAppStore = create((set) => ({
  regionId: DEFAULT_REGION,
  district: null,
  answers: {},
  selectedBakeryId: null,

  setAnswer: (questionId, optionId) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: optionId } })),

  setDistrict: (district) => set({ district }),

  resetAnswers: () => set({ answers: {}, district: null, selectedBakeryId: null }),

  selectBakery: (id) => set({ selectedBakeryId: id }),
}))
