# 마이페이지 방문 스탬프 위젯 — 설계 (이슈 #63, 1단계)

**날짜:** 2026-09-01
**브랜치:** `feature-stamp` (base: `develop`)
**관련 이슈:** #63 ([FEAT] 마이페이지 방문 스탬프 + 방문 인증 + 공유)

## 배경 및 목표

마이페이지가 목록(찜한 빵/코스/기록장/친구) 나열뿐이라 "대전 빵집을 얼마나 돌았나"에 대한
성취·진행감이 없다. 기록장(`diary_entries`)에 남긴 빵집 좌표를 대전 5개 구 경계와 대조해
**구별 방문도를 파생**하고, 마이페이지 홈·모달·친구 화면에 위젯으로 보여준다.

이 스펙은 이슈 #63의 **1단계만** 다룬다. 1단계는 DB 변경이 없다. 방문 인증(2단계,
`verified` 컬럼 + GPS 캡처)과 공유(3단계, 이미지 카드 + 공개 링크 + OG)는 후속 브랜치
(`feature-stamp-verify`, `feature-stamp-share`)에서 별도 스펙으로 진행한다.

## 브레인스토밍으로 확정된 결정

- **구별 SVG path 생성**: `daejeonStampPaths.js`는 정적 문자열을 박제하지 않고 **모듈 로드 시
  `DISTRICT_RINGS`에서 계산**한다. 작은 `projectRing()` 헬퍼로 viewBox에 투영하고 동결 상수로
  export. 경계 데이터 단일 출처 유지, projection 로직만 단위테스트. 5개 폴리곤 약 100점이라
  런타임 비용 무시 가능.
- **친구 페이지의 스탬프 띠 탭 동작**: 본인과 동일 — 탭하면 그 친구의 구별 %/진행 바 모달이
  열린다(읽기 전용). 공유 버튼은 1단계에 없으므로 모달 구성은 본인·친구 동일, 코드 경로 하나로
  재사용.
- **`count`("구별 인증 빵집 수")의 정의**: 지표 문구가 "빵집 수"이므로 **`bakery_id` 기준 중복
  제거한 빵집 수**. 같은 빵집을 3번 기록해도 그 구의 count는 1.
- **1단계 분자**: `verified` 컬럼이 없으므로 **전체 기록**으로 계산한다. 2단계 병합 시
  `computeVisitStamps` 시그니처에 필터 인자를 추가하며 분자를 `verified` 기록만 세도록 바꾼다
  (시그니처 변경 예정).

## 제외 사항 (이슈 원문 + 이번 논의)

- `diary_entries` 컬럼 추가(`visit_lat`/`visit_lng`/`verified`/`verified_at`) — 2단계.
- `create_diary_entry` RPC, RLS `with check` 강화, GPS `getCurrentPosition` 캡처 — 2단계.
- 기록장 카드의 인증/미인증 뱃지 — 2단계.
- `StampShareCard`, SVG→canvas→`navigator.share`, 다운로드 폴백 — 3단계.
- `/s/:shareCode` 공개 페이지, `get_public_stamp` RPC, `og-stamp` Edge Function — 3단계.
- 컴포넌트 단위 테스트 — 레포에 컴포넌트 테스트 관례가 없어 lib/data 테스트만 작성.
- 이동속도 휴리스틱, 사진 EXIF GPS 인증 — 이슈에서 이미 후속 이슈로 분리.

## 1. `src/lib/districtFromPoint.js` (신설)

좌표 하나를 대전 5개 구 중 하나로 분류한다.

### 1.1 API

```js
districtOf({ lat, lng }) → '동구' | '중구' | '서구' | '유성구' | '대덕구' | null
```

- `src/data/daejeonDistricts.js`의 `DISTRICT_RINGS`(`{ 구이름: [[lat,lng], …] }`)를 사용.
- 각 링에 대해 ray-casting point-in-polygon. 링 좌표가 `[lat, lng]`이므로 **lat을 y, lng을 x로
  일관 처리**한다(ray-casting은 좌표계 방향과 무관하므로 뒤집어도 결과 동일).
- 구 순회 순서는 `DISTRICT_RINGS`의 객체 삽입 순서(동구 → 중구 → 서구 → 유성구 → 대덕구)로
  고정. **첫 번째로 포함하는 링이 이긴다** — 경계를 공유하는 두 구 사이 점도 결정적으로 한 구에
  귀속된다.
- `lat` 또는 `lng`가 `Number.isFinite`가 아니면 즉시 `null`.
- 어느 링에도 안 들어가면 `null`.

### 1.2 point-in-polygon

표준 홀짝 ray-casting. 폴리곤이 닫혀 있든(첫 점 = 끝 점) 아니든 동작하도록 `j = (i + n - 1) % n`
방식으로 모든 변을 순회한다. `DISTRICT_RINGS`의 링은 첫 점과 끝 점이 같게 저장돼 있는데, 중복
꼭짓점이 있어도 홀짝 카운트에는 영향 없다.

### 1.3 테스트 `src/lib/districtFromPoint.test.js`

- 구별 대표 내부 좌표 5개가 각각 자기 구로 분류된다. (구 중심 근처 좌표를 손으로 고른다 —
  예: 동구 대전역 `36.3315,127.4348`, 중구 성심당 `36.3277,127.4276`, 서구 둔산 `36.3515,127.3781`,
  유성구 봉명 `36.3540,127.3360`, 대덕구 오정 `36.4350,127.4200` — 실제 링과 대조해 확정.)
- 경계 밖 1점(예: 서울 `37.5665,126.9780`) → `null`.

## 2. `src/lib/visitStamps.js` (신설)

기록장 배열에서 구별 방문도를 파생한다.

### 2.1 API

```js
computeVisitStamps(entries) → {
  perDistrict: [{ name, count, pct }, …],  // 5개, 정규 순서(DISTRICT_RINGS 순서)
  overallPct,                               // 5개 pct 평균, 반올림
  conqueredCount,                           // pct === 100 인 구 수 (0~5)
}
```

### 2.2 계산

1. `entries`를 순회하며 각 기록의 좌표를 뽑는다: `entry.bakery?.lat`, `entry.bakery?.lng`
   (`diary_entries.bakery` jsonb에 빵집 원본이 통째로 저장되고, 정규화된 빵집 shape은
   `lat`/`lng`를 가진다 — `sampleBakeries.js`, `useBakeries.js` 참조).
2. `districtOf({ lat, lng })` 호출. `null`이면(좌표 없음 / 경계 밖) 그 기록은 **제외**.
3. 구별로 방문한 **빵집 id 집합**을 모은다. id는 `entry.bakery_id ?? entry.bakery?.id`.
   같은 빵집 중복 기록은 집합이라 1로 합쳐진다.
4. 구별 `count = 집합 크기`, `pct = Math.round(Math.min(count / 3, 1) * 100)`.
   3곳 이상이면 100(정복), 초과분은 100으로 캡.
5. `perDistrict`는 `DISTRICT_RINGS`의 5개 구를 그 순서대로, 방문 없는 구는 `count: 0, pct: 0`.
6. `overallPct = Math.round(5개 pct 합 / 5)`. 분모는 **항상 5** (매칭 실패 기록이 있어도).
7. `conqueredCount = perDistrict.filter(d => d.pct === 100).length`.

### 2.3 1단계 시그니처 주의

1단계는 인자가 `entries` 하나. 2단계에서 인증 기록만 세도록 `computeVisitStamps(entries, { verifiedOnly })`
같은 형태로 확장 예정 — 이 스펙 범위에서는 전체 기록을 센다. 주석으로 남긴다.

### 2.4 테스트 `src/lib/visitStamps.test.js`

- **3곳 캡**: 한 구에 서로 다른 빵집 4곳 기록 → 그 구 `count: 4, pct: 100`, `conqueredCount`에 포함.
- **중복 제거**: 같은 빵집 3번 기록 → 그 구 `count: 1, pct: 33`.
- **미분류 제외**: 좌표 없는 기록 + 경계 밖 기록을 섞어도 분모 5 유지, 그 기록들은 어느 count에도
  안 잡힘.
- **빈 입력**: `computeVisitStamps([])` → 5개 구 전부 `pct: 0`, `overallPct: 0`, `conqueredCount: 0`.
- **평균**: 한 구만 정복(pct 100), 나머지 0 → `overallPct: 20`.

## 3. `src/components/mypage/daejeonStampPaths.js` (신설)

`DISTRICT_RINGS`를 SVG 좌표계로 투영한 path 데이터를 로드 시 계산해 export한다.

### 3.1 투영

- 5개 링 **전체**의 위/경도 bbox를 한 번 계산한다(모든 구가 같은 좌표 공간을 공유해야 지도가
  맞물린다).
- `lng → x` (서→동 증가), `lat → y` (북이 위로 오도록 **y 뒤집기**).
- 균일 스케일: `scale = min((W - 2·pad) / bboxWidthLng, (H - 2·pad) / bboxHeightLat)`.
  종횡비 보존. 대전은 동서로 조금 넓어 `W ≈ 320`, `H`는 계산된 종횡비로, `pad ≈ 8`.
- `projectRing(ring) → "M x0 y0 L x1 y1 … Z"` (좌표는 소수점 2자리 반올림).

### 3.2 export

```js
export const STAMP_VIEWBOX = `0 0 ${W} ${H}`        // 계산된 값
export const DISTRICT_PATHS = Object.freeze([        // DISTRICT_RINGS 순서
  { name: '동구', d: 'M …' }, …
])
```

`projectRing`도 export해 테스트에서 직접 부른다.

### 3.3 테스트 `src/components/mypage/daejeonStampPaths.test.js`

- `DISTRICT_PATHS`가 5개, `name`이 `DISTRICT_RINGS` 키와 순서까지 일치.
- 각 `d`가 `M`으로 시작하고 `Z`로 끝난다.
- `d`에서 뽑은 모든 수가 유한하고 `0 ≤ x ≤ W`, `0 ≤ y ≤ H` 범위 안.

## 4. `src/components/mypage/VisitStampBand.jsx` (신설)

마이페이지 홈·친구 기록장 상단에 놓이는 전체폭 띠.

### 4.1 props

- `targetUserId?: string` — 있으면 친구 조회, 없으면 본인.
- `nickname?: string` — 친구 모달 제목용(선택).

### 4.2 동작

- `const { entries, loading } = useDiaryEntries(targetUserId)`
- `const stamp = useMemo(() => computeVisitStamps(entries), [entries])`
- `const [open, setOpen] = useState(false)`
- 렌더: 전체폭 `<button type="button" className="visit-stamp-band" onClick={() => setOpen(true)}>`
  - 왼쪽: 미니 SVG (`STAMP_VIEWBOX` + `DISTRICT_PATHS`, 각 구를 그 구 `pct`로 채도/투명도 채움 —
    `fillOpacity = 0.15 + 0.85 * pct/100`, stroke는 항상 보이게).
  - 가운데/오른쪽: `대전 {stamp.overallPct}%` 텍스트 + 진행 바(`.visit-stamp-bar` >
    `.visit-stamp-bar-fill` `style={{ width: `${stamp.overallPct}%` }}`) + `{stamp.conqueredCount}/5 구 정복`.
- `loading && entries.length === 0`이면 같은 레이아웃을 0% 플레이스홀더로 렌더(레이아웃 튐 방지),
  버튼은 비활성.
- `open && <VisitStampModal stamp={stamp} nickname={nickname} onClose={() => setOpen(false)} />`
- 비로그인 게이트 불필요 — 이 컴포넌트는 `MyPage`의 로그인된 분기에서만 마운트된다.

## 5. `src/components/mypage/VisitStampModal.jsx` (신설)

`src/components/tour/CourseNameModal.jsx` 패턴을 그대로 따른다.

### 5.1 구조

- `createPortal(…, document.body)`
- 바깥 `<div className="auth-modal-overlay" onClick={onClose}>`, 안 `<div className="auth-modal" onClick={stopPropagation}>`
- `✕` 버튼(`.auth-modal-close`, `aria-label="닫기"`), 배경 클릭 닫기, `Escape` 닫기(`onCloseRef` 패턴으로
  리스너는 마운트/언마운트에만), `document.body.style.overflow = 'hidden'` 잠금 + 복원.

### 5.2 props / 내용

- props: `stamp`, `nickname?`, `onClose`.
- 제목: `nickname ? `${nickname}님의 대전 빵 지도` : '내 대전 빵 지도'`.
- 확대된 5구 SVG(같은 `DISTRICT_PATHS`, 큰 크기, 구별 pct 채움 + 구 이름 라벨).
- 구별 목록: `stamp.perDistrict.map` → 구 이름, `{pct}%`, 미니 진행 바.
- 하단에 `대전 {stamp.overallPct}% · {stamp.conqueredCount}/5 구 정복` 요약.
- 공유 버튼 없음(3단계).

## 6. `src/pages/MyPage.jsx` (수정)

### 6.1 본인 홈

`return (<div className="mypage-home">…)` 안, `.mypage-home-main` 내부에서
`.mypage-home-heading`과 `.mypage-preview-grid` **사이**에 삽입:

```jsx
<div className="mypage-home-heading">…</div>
<VisitStampBand />
<div className="mypage-preview-grid">…</div>
```

### 6.2 친구 기록장

현재 `panel === 'friendDiary' && friend` 분기는 `<DiaryPanel … />`를 바로 `return`한다.
이를 래핑해 위에 띠를 올린다:

```jsx
if (panel === 'friendDiary' && friend) {
  return (
    <div className="mypage-friend-diary">
      <VisitStampBand targetUserId={friend.userId} nickname={friend.nickname} />
      <DiaryPanel
        targetUserId={friend.userId}
        readOnly
        friendNickname={friend.nickname}
        onBack={() => setPanel('friendDetail')}
      />
    </div>
  )
}
```

`import VisitStampBand from '../components/mypage/VisitStampBand'` 추가.

## 7. `src/styles.css` (수정)

파일 관례(kebab-case, 컴포넌트 프리픽스, 기존 색 토큰 `var(--…)`)를 따라 규칙 추가:

- `.visit-stamp-band` — 전체폭, flex 정렬, 패딩, `cursor: pointer`, hover/focus 상태, `:disabled` 흐리게.
- `.visit-stamp-band-map` — 미니 SVG 컨테이너 크기.
- `.visit-stamp-bar` / `.visit-stamp-bar-fill` — 트랙 + 채움(색 토큰, `transition: width`).
- `.visit-stamp-modal-map` — 모달 확대 SVG.
- `.visit-stamp-modal-list` / `.visit-stamp-modal-row` — 구별 목록 행(이름 / % / 미니 바).
- `.mypage-friend-diary` — 친구 분기 래퍼(세로 스택 간격).
- SVG 구 채움/스트로크 색은 기존 토큰 재사용, 없으면 팔레트에 맞춰 새 토큰 1~2개 추가.

## 8. 데이터 흐름

```
useDiaryEntries(targetUserId)
  → entries[]  (각 entry: { bakery_id, bakery: {…, lat, lng}, text, … })
  → computeVisitStamps(entries)
       · entry.bakery.{lat,lng} → districtOf() → 구 or null(제외)
       · 구별 bakery id 집합 → count → pct = round(min(count/3,1)*100)
  → { perDistrict[5], overallPct, conqueredCount }
  → VisitStampBand: 미니 SVG + overallPct + 진행 바 + 정복 수
       · 탭 → VisitStampModal: 확대 SVG + 구별 목록 (같은 stamp 객체)
```

## 9. 테스트

- `src/lib/districtFromPoint.test.js` — 구별 대표점 5 + 경계 밖 1.
- `src/lib/visitStamps.test.js` — 3곳 캡 / 중복 제거 / 미분류 제외 / 빈 입력 / 평균.
- `src/components/mypage/daejeonStampPaths.test.js` — path 5개 형식 + 범위.
- 전부 `npm test`(`node --test "src/**/*.test.js"`)로 실행.
- 수동 확인: 알려진 좌표의 빵집 여러 곳에 기록 남기고 홈 띠 %/모달 구별 수, 친구 화면 읽기 전용
  위젯 렌더 확인.
