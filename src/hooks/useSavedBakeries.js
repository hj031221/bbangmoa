import { useEffect, useState } from 'react'

const STORAGE_KEY = 'bbangmoa_saved'

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// 찜한 빵집 저장 훅. 지금은 localStorage(브라우저별) 기반이고,
// 나중에 로그인 저장으로 승격할 때 이 훅 내부만 DB 조회/저장으로 바꾸면
// 화면 쪽 컴포넌트는 그대로 쓸 수 있다.
export function useSavedBakeries() {
  const [saved, setSaved] = useState(readSaved)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  }, [saved])

  const toggleSave = (bakery) => {
    setSaved((prev) =>
      prev.some((b) => b.id === bakery.id)
        ? prev.filter((b) => b.id !== bakery.id)
        : [...prev, bakery],
    )
  }

  const isSaved = (id) => saved.some((b) => b.id === id)

  return { saved, toggleSave, isSaved }
}
