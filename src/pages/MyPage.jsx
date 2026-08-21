import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import ProfileCard from '../components/mypage/ProfileCard'
import SavedBakeriesPanel from '../components/mypage/SavedBakeriesPanel'
import SavedCoursesPanel from '../components/mypage/SavedCoursesPanel'
import DiaryPanel from '../components/mypage/DiaryPanel'

// 마이페이지 — 프로필 카드 + 찜한 빵/찜한 코스/기록장/친구목록(준비중) 4개 패널.
// 로그인 필수: 비로그인 상태면 안내만 보여준다(로그인은 상단 AuthMenu 에서).
// panel 이 'home' 이 아니면 해당 패널만 전체 화면으로 보여주고 '‹' 로 home 으로 돌아간다.
export default function MyPage() {
  const { user, loading } = useAuth()
  const [panel, setPanel] = useState('home') // 'home' | 'bakeries' | 'courses' | 'diary' | 'friends'

  if (loading) return null

  if (!user) {
    return (
      <div className="mypage-gate">
        <h2>마이페이지</h2>
        <p>로그인하면 찜한 빵/코스와 기록장을 모아볼 수 있어요.</p>
      </div>
    )
  }

  if (panel === 'friends') {
    return (
      <div className="mypage-panel">
        <div className="mypage-panel-header">
          <button type="button" className="mypage-back" onClick={() => setPanel('home')}>
            ‹
          </button>
          <h3>친구목록</h3>
        </div>
        <p className="saved-empty">친구 기능은 준비 중이에요.</p>
      </div>
    )
  }

  if (panel === 'bakeries') return <SavedBakeriesPanel onBack={() => setPanel('home')} />

  if (panel === 'courses') return <SavedCoursesPanel onBack={() => setPanel('home')} />

  if (panel === 'diary') return <DiaryPanel onBack={() => setPanel('home')} />

  return (
    <div className="mypage-home">
      <ProfileCard />
      <div className="mypage-panel-grid">
        <button type="button" className="mypage-panel-card" onClick={() => setPanel('bakeries')}>
          <span className="mypage-panel-icon" aria-hidden="true">❤️</span>
          찜한 빵 목록
        </button>
        <button type="button" className="mypage-panel-card" onClick={() => setPanel('courses')}>
          <span className="mypage-panel-icon" aria-hidden="true">📍</span>
          찜한 코스 목록
        </button>
        <button type="button" className="mypage-panel-card" onClick={() => setPanel('diary')}>
          <span className="mypage-panel-icon" aria-hidden="true">📄</span>
          기록장
        </button>
        <button
          type="button"
          className="mypage-panel-card mypage-panel-card-disabled"
          onClick={() => setPanel('friends')}
          aria-disabled="true"
        >
          <span className="mypage-panel-icon" aria-hidden="true">👥</span>
          친구목록
        </button>
      </div>
    </div>
  )
}
