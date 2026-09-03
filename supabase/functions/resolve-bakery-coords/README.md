# resolve-bakery-coords

`bakery_id`(`tour:` / `kakao:` 접두)로 서버가 신뢰하는 좌표를 외부 API에서 확보해
`bakery_coords` 테이블에 upsert 한다. `create_diary_entry` RPC가 방문 인증(`verified`)을
이 테이블 좌표로만 판정하므로(이슈 #69), 프런트는 기록 저장 직전에 이 함수를 1회 호출한다.

- `tour:{contentId}` → KorService2 `detailCommon2`
- `kakao:{id}` → Kakao Local 키워드 검색(대전 rect) 후 `doc.id` 정확 일치 항목

응답은 항상 `200 { "resolved": boolean }`. 실패·미해결은 `resolved: false`이며 에러를 던지지 않는다.

## 인증

`config.toml` 의 `verify_jwt = true` 는 **서명만** 검증한다 — 클라 번들에 실린 공개 `anon` 키도
유효한 서명 JWT라 이것만으로는 익명 호출을 막지 못한다. 그래서 핸들러가 추가로 토큰 payload 의
`role` 을 확인해 `authenticated` 가 아닌 토큰은 `{ resolved: false }` 로 즉시 거부한다.
(preflight `OPTIONS` 는 JWT 없이 통과 — CORS 응답만 하고 끝낸다.)

## 시크릿

| 이름 | 발급처 |
|---|---|
| `KAKAO_REST_KEY` | Kakao Developers — **서버 전용** REST 키(클라이언트 `VITE_KAKAO_REST_KEY`와 분리 발급) |
| `TOUR_API_KEY` | 공공데이터포털 data.go.kr — **전용 키를 따로 발급**(자체 쿼터). 클라의 `VITE_TOUR_API_KEY`와 **같은 값을 쓰지 말 것** — 여기서 쿼터가 소진되면 메인 빵집 목록까지 죽는다 |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`는 플랫폼이 자동 주입한다.

## 배포

    supabase secrets set KAKAO_REST_KEY=... TOUR_API_KEY=...
    supabase functions deploy resolve-bakery-coords

## 로컬 실행

    supabase functions serve resolve-bakery-coords --env-file supabase/functions/.env.local
    # .env.local: KAKAO_REST_KEY / TOUR_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
