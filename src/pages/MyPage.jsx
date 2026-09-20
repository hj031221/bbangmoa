import { useAuth } from '../hooks/useAuth'
import ProfileCard from '../components/mypage/ProfileCard'
import SavedBakeriesPanel from '../components/mypage/SavedBakeriesPanel'
import SavedCoursesPanel from '../components/mypage/SavedCoursesPanel'
import DiaryPanel from '../components/mypage/DiaryPanel'
import SavedBakeriesPreview from '../components/mypage/SavedBakeriesPreview'
import SavedCoursesPreview from '../components/mypage/SavedCoursesPreview'
import DiaryPreview from '../components/mypage/DiaryPreview'
import FriendsPreview from '../components/mypage/FriendsPreview'
import FriendsPanel from '../components/mypage/FriendsPanel'
import VisitStampBand from '../components/mypage/VisitStampBand'

// 마이페이지 — 프로필 카드 + 찜한 빵/찜한 코스/기록장/친구목록 4개 패널.
// 로그인 필수: 비로그인 상태면 안내만 보여준다(로그인은 상단 AuthMenu 에서).
// panel 이 'home' 이 아니면 해당 패널만 전체 화면으로 보여주고 '‹' 로 home 으로 돌아간다.
// friend 가 설정돼 있으면 friendBakeries/friendCourses/friendDiary 패널이 그 친구 데이터를
// 읽기 전용으로 보여준다(SavedBakeriesPanel 등을 targetUserId+readOnly 로 그대로 재사용).
export default function MyPage({ pageState, onPageChange, onBack, onLoadCourse, onViewBakeryOnMap }) {
  const { user, loading } = useAuth()
  const { panel, friend } = pageState
  const setPanel = (panel) => onPageChange({ ...pageState, panel })
  // '‹' 는 다른 화면의 onBack(goBackInApp)처럼 히스토리를 한 칸 되돌린다 — 패널 전환은 전부
  // onPageChange 로 항목을 남기므로 직전 항목이 곧 상위 패널이다. 여기서 onPageChange 로 새
  // 항목을 push 하면 '‹' 뒤에 브라우저 뒤로가기가 방금 떠난 패널로 되돌아온다.
  // 인자는 되돌릴 항목이 없을 때(주소창 직접 진입 등) 대신 갈 패널 상태.
  const backTo = (nextPanel, nextFriend = friend) => onBack({ panel: nextPanel, friend: nextFriend })

  if (loading) return null

  if (!user) {
    return (
      <div className="mypage-gate">
        <h2>마이페이지</h2>
        <p>로그인하면 찜한 빵/코스와 기록장을 모아볼 수 있어요.</p>
      </div>
    )
  }

  const backToFriendList = () => backTo('friends', null)

  if (panel === 'friends') {
    return (
      <FriendsPanel
        onBack={() => backTo('home')}
        onSelectFriend={(f) => {
          onPageChange({ panel: 'friendDetail', friend: f })
        }}
      />
    )
  }

  if (panel === 'friendDetail' && friend) {
    return (
      <div className="mypage-panel">
        <div className="mypage-panel-header">
          <button type="button" className="mypage-back" onClick={backToFriendList}>
            ‹
          </button>
          <span className="friend-avatar friend-avatar-sm" aria-hidden="true">
            {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" /> : (friend.nickname?.[0] || '?')}
          </span>
          <h3>{friend.nickname}님의 마이페이지</h3>
        </div>
        <VisitStampBand targetUserId={friend.userId} nickname={friend.nickname} />
        <div className="friend-detail-menu">
          <button
            type="button"
            className="friend-detail-menu-btn"
            onClick={() => setPanel('friendBakeries')}
          >
            찜한 빵 목록
          </button>
          <button
            type="button"
            className="friend-detail-menu-btn"
            onClick={() => setPanel('friendCourses')}
          >
            찜한 코스 목록
          </button>
          <button
            type="button"
            className="friend-detail-menu-btn"
            onClick={() => setPanel('friendDiary')}
          >
            기록장
          </button>
        </div>
      </div>
    )
  }

  if (panel === 'friendBakeries' && friend) {
    return (
      <SavedBakeriesPanel
        targetUserId={friend.userId}
        readOnly
        onBack={() => backTo('friendDetail')}
        onViewOnMap={onViewBakeryOnMap}
      />
    )
  }

  if (panel === 'friendCourses' && friend) {
    return (
      <SavedCoursesPanel
        targetUserId={friend.userId}
        readOnly
        friendNickname={friend.nickname}
        onBack={() => backTo('friendDetail')}
      />
    )
  }

  if (panel === 'friendDiary' && friend) {
    return (
      <DiaryPanel
        targetUserId={friend.userId}
        readOnly
        friendNickname={friend.nickname}
        onBack={() => backTo('friendDetail')}
      />
    )
  }

  if (panel === 'bakeries')
    return (
      <SavedBakeriesPanel onBack={() => backTo('home')} onViewOnMap={onViewBakeryOnMap} />
    )

  if (panel === 'courses')
    return (
      <SavedCoursesPanel onBack={() => backTo('home')} onLoadCourse={onLoadCourse} />
    )

  if (panel === 'diary') return <DiaryPanel onBack={() => backTo('home')} />

  return (
    <div className="mypage-home">
      <ProfileCard />
      <div className="mypage-home-main">
        <div className="mypage-home-heading">
          <h2>마이페이지</h2>
          <p>마음에 들었던 빵과 코스를 찜하고 기록장에 그 날의 빵을 기록해보세요!</p>
        </div>
        <VisitStampBand />
        <div className="mypage-preview-grid">
          <SavedBakeriesPreview onExpand={() => setPanel('bakeries')} />
          <SavedCoursesPreview onExpand={() => setPanel('courses')} />
          <DiaryPreview onExpand={() => setPanel('diary')} />
          <FriendsPreview onExpand={() => setPanel('friends')} />
        </div>
      </div>
    </div>
  )
}
