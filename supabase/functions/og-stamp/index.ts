import { withSupabase } from 'npm:@supabase/server@^1'
import handler from './index.tsx'

// 공개 OG 이미지 엔드포인트. 인증은 get_public_stamp RPC의 제한된 집계 계약이 담당한다.
export default { fetch: withSupabase({ auth: 'none' }, handler) }
