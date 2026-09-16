import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_REGION, getRegion } from '../config/regions'
import { sanitizeOriginForSave } from '../lib/originPrivacy'

// 앱 전역 상태 (가볍게 유지)
//  - answers: 빵모아 설문 응답 { [questionId]: optionId }
//  - tourAnswers: 관광모아 설문 응답 { [questionId]: optionId } — answers와 별개 네임스페이스로 둔다.
//                 두 설문 모두 질문 id가 q0~q5라 같은 객체를 쓰면 응답이 서로 덮어써진다.
//  - regionId: 현재 지역(도시 단위, 지금은 대전 하나)
//  - origin: 설문 0단계에서 고른 정밀 출발 위치 { lat, lng, label, source }
//            source: 'preset' | 'gps' | 'pick' | 'search'. 결과(거리·정렬)로 흐른다.
//            gps는 코스 저장 시 원본 좌표를 서버로 보내지 않는다(originPrivacy.sanitizeOriginForSave)
//            — 화면에도 "GPS 위치는 저장되지 않아요"라고 안내한다(LocationStep). 아래 localStorage
//            영속화(persist)도 이 약속을 그대로 지켜야 하므로, gps 출처 origin은 저장 직전
//            sanitizeOriginForSave로 가까운 프리셋으로 치환한다(리뷰 지적 — 안 그러면 서버엔
//            안 보내면서 기기에는 원본 좌표를 그대로 남겨 화면 안내와 실제 동작이 어긋난다).
//            치환된 좌표라도 origin 자체는 남으므로 surveyDone(아래)은 새로고침 후에도 유지된다.
//  - district: (호환용) 옛 구 선택 상태 — 검색 필터로는 더 이상 안 씀
//  - selectedBakeryId: 지도/카드에서 선택된 빵집
//  - directBreadId: 빵 종류 바로가기(이슈 #73 B1) — 설문을 건너뛰고 특정 빵으로 바로 결과를 볼 때 그
//    빵 id. answers(설문 응답)와 상호배타 — 칩으로 진입하면 설문 응답을 비우고 이 값을 세팅한다.
//    세션 성격이라 아래 persist 대상에서는 제외한다(새로고침하면 설문 홈으로 돌아간다).
//
// answers/tourAnswers/origin/district는 localStorage에 영속화한다(이슈 #70 2번) — GNB를
// 한 번 거치거나 새로고침해도 "완료된 설문" 상태가 유지돼야 대전한바퀴 코스가 안 사라진다.
// pendingCourseLoad(1회성 전달값)·selectedBakeryId(화면별 임시 선택)는 세션 성격이라 제외한다.
export const useAppStore = create(
  persist(
    (set) => ({
      regionId: DEFAULT_REGION,
      origin: null,
      district: null,
      answers: {},
      tourAnswers: {},
      selectedBakeryId: null,
      directBreadId: null,
      // 마이페이지 "찜한 코스"에서 "불러오기"를 누르면 여기 담겼다가, 대전한바퀴 화면이 마운트되면서
      // 한 번 소비하고 다시 null로 비운다(§CP10-3). LandingPage가 화면 전환을, PilgrimagePage가 소비를 맡는다.
      pendingCourseLoad: null,
      courseDraft: null,
      setCourseDraft: (courseDraft) => set({ courseDraft }),

      setAnswer: (questionId, optionId) =>
        set((s) => ({ answers: { ...s.answers, [questionId]: optionId } })),

      setTourAnswer: (questionId, optionId) =>
        set((s) => ({ tourAnswers: { ...s.tourAnswers, [questionId]: optionId } })),

      setOrigin: (origin) => set({ origin }),

      setDistrict: (district) => set({ district }),

      resetAnswers: () =>
        set({ courseDraft: null, answers: {}, origin: null, district: null, selectedBakeryId: null, directBreadId: null }),

      // 빵 종류 바로가기 진입: 설문 응답을 비우고 고른 빵을 세팅한다(둘은 상호배타).
      setDirectBread: (breadId) =>
        set({ courseDraft: null, directBreadId: breadId, answers: {}, origin: null, district: null, selectedBakeryId: null }),

      // 바로가기 상태만 해제(설문 응답은 건드리지 않음) — 홈 CTA로 설문에 다시 들어갈 때 등.
      clearDirectBread: () => set({ directBreadId: null }),

      // 브라우저 뒤로/앞으로가기로 히스토리 상태를 복원할 때 전용(리뷰 지적) — setDirectBread는
      // "칩으로 새로 진입"을 의미해 answers/origin 을 같이 지우는데, 순수 뒤로가기는 화면
      // 상태만 되돌리는 거라 진행 중이던 설문 답변까지 지우면 안 된다. directBreadId 만 되돌린다.
      restoreDirectBread: (breadId) => set({ directBreadId: breadId }),

      resetTourAnswers: () => set({ tourAnswers: {}, courseDraft: null }),

      selectBakery: (id) => set({ selectedBakeryId: id }),

      setPendingCourseLoad: (course) => set({ pendingCourseLoad: course }),
    }),
    {
      name: 'bbangmoa-app-store',
      partialize: (s) => ({
        answers: s.answers,
        tourAnswers: s.tourAnswers,
        origin: sanitizeOriginForSave(s.origin, getRegion(s.regionId)),
        district: s.district,
      }),
    },
  ),
)
