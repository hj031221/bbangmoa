import { create } from 'zustand'
import { DEFAULT_REGION } from '../config/regions'

// 앱 전역 상태 (가볍게 유지)
//  - answers: 설문 응답 { [questionId]: optionId }
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
  selectedBakeryId: null,

  setAnswer: (questionId, optionId) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: optionId } })),

  setOrigin: (origin) => set({ origin }),

  setDistrict: (district) => set({ district }),

  resetAnswers: () =>
    set({ answers: {}, origin: null, district: null, selectedBakeryId: null }),

  selectBakery: (id) => set({ selectedBakeryId: id }),
}))
