// src/components/mypage/SavedCoursesPanel.jsx
import { useState } from 'react'
import { useSavedCourses } from '../../hooks/useSavedCourses'
import { formatCourseLabel, formatCourseMeta } from '../../lib/courseLabel'
import SavedCourseMap from './SavedCourseMap'
import CourseNameModal from '../tour/CourseNameModal'

export default function SavedCoursesPanel({ onBack, targetUserId, readOnly = false, friendNickname, onLoadCourse }) {
  const { courses, loading, removeCourse, renameCourse } = useSavedCourses(targetUserId)
  const [selectedId, setSelectedId] = useState(null)
  const [renameOpen, setRenameOpen] = useState(false)

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
        {/* 이슈 #60 — <ol>이 이미 자동으로 번호를 매기는데 텍스트에도 {i+1}.을 또 붙여서
            "1. 1. 파시파시"처럼 중복 표시됐다. 수동 접두어 제거, <ol> 자동 번호만 남긴다. */}
        <ol className="mypage-course-stops">
          {selected.stops.map((stop, i) => (
            <li key={stop.id ?? i}>{stop.name}</li>
          ))}
        </ol>
        {!readOnly && (
          <div className="mypage-course-detail-actions">
            {onLoadCourse && (
              <button type="button" className="primary-btn" onClick={() => onLoadCourse(selected)}>
                이 코스 불러오기
              </button>
            )}
            <button type="button" className="ghost-btn" onClick={() => setRenameOpen(true)}>
              이름 수정
            </button>
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
        )}
        {renameOpen && (
          <CourseNameModal
            heading="코스 이름 수정"
            initialValue={selected.title}
            existingNames={courses.filter((c) => c.id !== selectedId).map((c) => c.title)}
            onClose={() => setRenameOpen(false)}
            onSubmit={(title) => renameCourse(selectedId, title)}
          />
        )}
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
        <p className="saved-empty">
          {readOnly
            ? `${friendNickname}님이 아직 저장한 코스가 없어요.`
            : '아직 저장한 코스가 없어요. 대전한바퀴에서 코스를 저장해보세요.'}
        </p>
      ) : (
        <ul className="saved-list">
          {courses.map((c) => (
            <li key={c.id} className="saved-item">
              <button
                type="button"
                className="mypage-course-item-btn"
                onClick={() => setSelectedId(c.id)}
              >
                <span className="mypage-course-name">{c.title}</span>
                <span className="mypage-course-meta">{formatCourseMeta(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
