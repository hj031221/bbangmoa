import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 관광공사 API(data.go.kr)는 브라우저에서 직접 호출 시 CORS로 막힌다.
// 개발 중에는 아래 dev proxy로 우회한다: 프론트는 `/tourapi/...`로 호출하면
// Vite가 https://apis.data.go.kr 로 대신 요청해 준다.
// 배포 시에는 동일 경로(`/tourapi`)를 서버리스 함수(Vercel 등)로 프록시하면 코드 변경이 없다.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tourapi': {
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tourapi/, ''),
      },
    },
  },
})
