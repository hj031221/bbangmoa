// 새 백엔드(bbangmoa-server) 연결용. 값이 없으면(.env에 안 넣었으면)
// 이 파일을 참조하는 곳도 아무 동작을 안 해 기존 동작이 그대로 유지된다.
import { hasKey } from './http'

// 대시보드에서 실수로 앞뒤 공백이나 마지막 / 를 넣어도
// https://api.example.com//api/... 형태가 되지 않게 한 번 정규화한다.
export const SERVER_BASE = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/+$/, '')
export const serverEnabled = () => hasKey(SERVER_BASE)
