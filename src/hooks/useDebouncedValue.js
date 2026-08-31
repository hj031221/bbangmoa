// src/hooks/useDebouncedValue.js
import { useEffect, useState } from 'react'

// value가 delay(ms) 동안 더 안 바뀌면 그 값을 반영한다. 검색어처럼 매 키 입력마다
// 비싼 부수효과(지도 재조정 등)를 트리거하고 싶지 않을 때 트리거용 값만 지연시키는 용도.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
