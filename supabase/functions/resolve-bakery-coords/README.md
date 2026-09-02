# resolve-bakery-coords

`bakery_id`(`tour:` / `kakao:` 접두)로 서버가 신뢰하는 좌표를 외부 API에서 확보해
`bakery_coords` 테이블에 upsert 한다. `create_diary_entry` RPC가 방문 인증(`verified`)을
이 테이블 좌표로만 판정하므로(이슈 #69), 프런트는 기록 저장 직전에 이 함수를 1회 호출한다.

- `tour:{contentId}` → KorService2 `detailCommon2`
- `kakao:{id}` → Kakao Local 키워드 검색(대전 rect) 후 `doc.id` 정확 일치 항목

응답은 항상 `200 { "resolved": boolean }`. 실패·미해결은 `resolved: false`이며 에러를 던지지 않는다.

## 시크릿

| 이름 | 발급처 |
|---|---|
| `KAKAO_REST_KEY` | Kakao Developers — **서버 전용** REST 키(클라이언트 `VITE_KAKAO_REST_KEY`와 분리 발급) |
| `TOUR_API_KEY` | 공공데이터포털 KorService2 (`VITE_TOUR_API_KEY`와 같은 값 사용 가능) |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`는 플랫폼이 자동 주입한다.

## 배포

    supabase secrets set KAKAO_REST_KEY=... TOUR_API_KEY=...
    supabase functions deploy resolve-bakery-coords

## 로컬 실행

    supabase functions serve resolve-bakery-coords --env-file supabase/functions/.env.local
    # .env.local: KAKAO_REST_KEY / TOUR_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
