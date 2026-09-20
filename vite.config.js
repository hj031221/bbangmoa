import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 공유 미리보기 크롤러는 og:image에 절대 URL(https://도메인/...)을 기대한다.
// index.html의 %SITE_ORIGIN%을 배포 도메인으로 치환하고, 로컬 개발처럼 도메인을 모르면 빈 문자열로 둔다.
// 프로덕션은 고정 도메인, 프리뷰 배포는 해당 배포 주소, VITE_SITE_URL이 있으면 그것이 최우선.
const PRODUCTION_ORIGIN = 'https://breadmoa.com'
const siteOriginPlugin = {
  name: 'site-origin-html',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      const origin =
        process.env.VITE_SITE_URL ||
        (process.env.VERCEL_ENV === 'production'
          ? PRODUCTION_ORIGIN
          : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : '')
      return html.replaceAll('%SITE_ORIGIN%', origin.replace(/\/$/, ''))
    },
  },
}

// 관광공사 API(data.go.kr)는 브라우저에서 직접 호출 시 CORS로 막힌다.
// 개발 중에는 아래 dev proxy로 우회한다: 프론트는 `/tourapi/...`로 호출하면
// Vite가 https://apis.data.go.kr 로 대신 요청해 준다.
// 배포 시에는 동일 경로(`/tourapi`)를 서버리스 함수(Vercel 등)로 프록시하면 코드 변경이 없다.
export default defineConfig({
  plugins: [react(), siteOriginPlugin],
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
