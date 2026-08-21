import { useSavedCourses } from '../../hooks/useSavedCourses'
import { formatCourseLabel } from '../../lib/courseLabel'
import PreviewChevron from './PreviewChevron'
import { PinIcon } from './PreviewIcons'

// 마이페이지 홈 미리보기 카드. 개수 제한 없이 저장한 만큼 세로로 늘어난다.
// 상세(경로/삭제)는 헤더 클릭 시 SavedCoursesPanel 로 이동해서 본다.
export default function SavedCoursesPreview({ onExpand }) {
  const { courses, loading } = useSavedCourses()

  return (
    <div className="mypage-preview-panel">
      <button type="button" className="mypage-preview-header" onClick={onExpand}>
        <span className="mypage-preview-icon-badge" aria-hidden="true">
          <PinIcon />
        </span>
        <span className="mypage-preview-title">찜한 코스 목록</span>
        <PreviewChevron />
      </button>
      <div className="mypage-preview-body">
        {loading ? (
          <p className="mypage-preview-empty">불러오는 중…</p>
        ) : courses.length === 0 ? (
          <p className="mypage-preview-empty">아직 저장한 코스가 없어요.</p>
        ) : (
          <ol className="mypage-preview-course-list">
            {courses.map((c, i) => (
              <li key={c.id} className="mypage-preview-course-item">
                <span className="mypage-preview-course-num" aria-hidden="true">{i + 1}</span>
                {formatCourseLabel(c)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
