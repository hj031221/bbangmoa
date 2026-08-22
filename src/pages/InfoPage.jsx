import Hero from '../components/landing/Hero'
import ProblemSection from '../components/landing/ProblemSection'
import FeaturesSection from '../components/landing/FeaturesSection'
import HowItWorksSection from '../components/landing/HowItWorksSection'
import PersonaSection from '../components/landing/PersonaSection'
import FinalCta from '../components/landing/FinalCta'
import logo from '../assets/logo-typeA-full.png'

// 메인 랜딩에서 분리된 "빵모아 소개" 파트 전체(서비스 소개 / 문제 제기 / 하는 일 / 이용 방법 / 추천 대상 / CTA).
// 메뉴의 "서비스 소개" 클릭 시 이 컨텐츠로 전환된다. 상단 메뉴바는 LandingPage 가 공통으로 띄운다.
export default function InfoPage({ onStart }) {
  return (
    <>
      <Hero onStart={onStart} />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PersonaSection />
      <FinalCta onStart={onStart} />

      <div className="bm-footer">
        <img src={logo} alt="빵모아 로고" />
        <span>빵모아</span>
        <span className="bm-footer-credit">· 『2026 관광데이터 활용 공모전』 출품작</span>
      </div>
    </>
  )
}
