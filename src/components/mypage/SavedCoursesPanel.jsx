// src/components/mypage/SavedCoursesPanel.jsx
import { useState } from 'react'
import { useSavedCourses } from '../../hooks/useSavedCourses'
import { formatCourseLabel } from '../../lib/courseLabel'
import SavedCourseMap from './SavedCourseMap'

export default function SavedCoursesPanel({ onBack }) {
  const { courses, loading, removeCourse } = useSavedCourses()
  const [selectedId, setSelectedId] = useState(null)

  const selected = courses.find((c) => c.id === selectedId)

  if (selected) {
    return (
      <div className="mypage-panel">
        <div className="mypage-panel-header">
          <button type="button" className="mypage-back" onClick={() => setSelectedId(null)}>
            ‹
          </button>
          <h3>{formatCourseLabel(selected)}</h3>
        </div>
        <SavedCourseMap origin={selected.origin} stops={selected.stops} />
        <ol className="mypage-course-stops">
          {selected.stops.map((stop, i) => (
            <li key={stop.id ?? i}>
              {i + 1}. {stop.name}
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            removeCourse(selectedId)
            setSelectedId(null)
          }}
        >
          코스 삭제
        </button>
      </div>
    )
  }

  return (
    <div className="mypage-panel">
      <div className="mypage-panel-header">
        <button type="button" className="mypage-back" onClick={onBack}>
          ‹
        </button>
        <h3>찜한 코스 목록{courses.length > 0 && ` (${courses.length}개)`}</h3>
      </div>
      {loading ? (
        <p className="saved-empty">불러오는 중…</p>
      ) : courses.length === 0 ? (
        <p className="saved-empty">아직 저장한 코스가 없어요. 대전한바퀴에서 코스를 저장해보세요.</p>
      ) : (
        <ul className="saved-list">
          {courses.map((c) => (
            <li key={c.id} className="saved-item">
              <button
                type="button"
                className="mypage-course-item-btn"
                onClick={() => setSelectedId(c.id)}
              >
                {formatCourseLabel(c)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
