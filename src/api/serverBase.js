// 새 백엔드(bbangmoa-server) 연결용. 값이 없으면(.env에 안 넣었으면)
// 이 파일을 참조하는 곳도 아무 동작을 안 해 기존 동작이 그대로 유지된다.
import { hasKey } from './http'

export const SERVER_BASE = import.meta.env.VITE_API_BASE || ''
export const serverEnabled = () => hasKey(SERVER_BASE)
