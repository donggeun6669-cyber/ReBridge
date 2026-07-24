# ReBridge (검고담임)

검정고시생·학교 밖 청소년을 위한 입시·진로 정보 웹앱. AI 공모전 출품작.
배포: https://rebridge-rho.vercel.app

## ⚠️ 가장 중요한 규칙

- **앱 코드는 오직 `ReBridge_AI공모전용/Application_main_codes/` 안에만 있다.** 다른 위치의 옛 복사본은 절대 수정하지 말 것. GitHub 레포가 유일한 정본(single source of truth).
- 모든 npm 명령은 레포 루트가 아니라 위 폴더에서 실행한다.
- 코드·주석·커밋·문서 전부 한국어. 편집 시 한국어 유지.
- 작업 전 `git pull`, 작업 후 `git push`.

## 실행 방법 (`Application_main_codes/`에서)

```bash
npm install
cp .env.example .env   # 값은 팀에서 받아 채움
npm run dev            # http://localhost:5173
npm run build          # dist/ 산출 (node node_modules/vite/bin/vite.js build)
npm run deploy         # npx vercel --prod (수동 배포 — 보통은 push 자동배포로 충분)
npm run verify         # 배포 캐시 우회 검증 (node verify-deploy.mjs)
```

테스트/린트/CI 없음.

## 아키텍처

- **React 18 + Vite 6**, JS/JSX (TypeScript 아님, `"type":"module"`).
- **커스텀 라우터** — react-router 아님. `src/App.jsx`가 `{screen, params}` 스택을 들고 `goTo()`/`goBack()`을 모든 화면에 prop으로 넘긴다. 새 화면은 `KNOWN_SCREENS`(+ 탭 루트면 `TAB_ROOTS`)에 등록해야 함. 안 하면 "준비 중" placeholder.
- **페르소나 기반 UI** (`src/lib/persona.js`) — `{stage, goal}`에 따라 노출 기능/탭이 달라짐. 상태는 localStorage `rebridge_profile`. 모든 사용자에게 모든 기능을 보여주지 않는 게 원칙.
- **점수 엔진은 규칙 기반, AI 아님** (`src/lib/scoreEngine.js`). 2025 입결(9등급)과 2028 전형(5등급)은 직접 비교 불가 — UI는 "참고용"임을 명시하고 합격 보장 표현 금지.
- **커뮤니티 백엔드는 Supabase, 없으면 자동으로 localStorage mock으로 폴백** (`src/lib/supabaseClient.js`). 데모 인증코드 `DREAM-TEST` / `DREAM-DEMO`는 mock 모드에서만 시드·노출된다.
- 기획·기능·데이터 현황은 `ReBridge_AI공모전용/Planning/PRD.md` 한 장에 통합돼 있다.

## 디렉터리 (`Application_main_codes/`)

- `src/components/` — `*Screen.jsx` 화면들 + `BottomNav`, `SplashScreen`, `TrackHome`
- `src/lib/` — 로직 (persona, scoreEngine, careernet, community, auth, youthVerify …)
- `src/data/` — 정적 데이터셋 (universities.json, admissions.json, jobData.js, glossary.js …)
- `api/` — Vercel 서버리스 함수 (`careernet.js`) — API 키 프록시
- `supabase/schema.sql` — 커뮤니티 테이블 + RLS + `redeem_code` RPC
- `data-pipeline/` — 별도 Python 툴체인. 대학 PDF에서 admissions JSON 추출 (앱과 무관, 오프라인). `sources/`에 공공데이터 원본 보존 — 삭제 금지

## 보안 주의

- **비밀 키는 서버리스 함수에서만.** `CAREERNET_API_KEY` 등 비밀 키는 `VITE_` 접두사 붙이지 말 것 (붙이면 클라이언트 번들에 노출됨). 과거 이 문제가 있었고 서버리스 프록시로 수정함 — 되돌리지 말 것.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`는 공개용(RLS 보호)이라 노출 정상. `service_role` 키는 클라이언트에서 절대 사용 금지.
- `.env`는 gitignore됨. `.env.example`만 커밋.
- **커뮤니티 권한은 클라이언트 검사에 의존하지 말 것.** '우리 센터' 보드 읽기/쓰기와 인증코드 사용 제한은 `supabase/schema.sql`의 RLS·RPC에서 서버가 강제한다 — 클라이언트 조건문만 고치면 우회된다.
- `api/careernet.js`는 파라미터 화이트리스트 + same-origin 검사 + 레이트리밋으로 잠겨 있다. 새 파라미터가 필요하면 `ALLOWED_PARAMS`에 추가할 것(전체 통과로 되돌리지 말 것).
- 카카오맵 JS 앱키(`src/lib/kakaoMap.js`)가 소스에 하드코딩된 건 **정상**이다(브라우저 SDK라 숨길 수 없음). 보호는 카카오 콘솔의 허용 도메인 등록으로 한다 — 키를 숨기려는 리팩터링은 무의미하니 하지 말 것.
- **지도는 현재 꺼져 있다** (`MAP_ENABLED = false`). 도메인 등록 확인 전까지 SDK 호출 차단 중이며, 동근님 확인 후 `true`로 되돌린다. 지도 관련 버그처럼 보이는 건 대부분 이 스위치 때문이니 먼저 확인할 것.
- 외부 API는 커리어넷·Supabase·카카오맵 3개뿐. 나머지 정부 사이트 도메인은 전부 단순 링크다. 상세는 `Planning/PRD.md` §7.

## 배포 구조 (2026-07 정리)

- **GitHub `main` 푸시 → Vercel 자동 배포.** 레포가 Vercel 프로젝트 **`gumgomentor`**(프로덕션, https://rebridge-rho.vercel.app)에 Git 연동돼 있다. push 권한 있는 협업자는 누구나 push만으로 배포된다.
- `gumgomentor-beta` 프로젝트는 옛 수동 배포용 잔재 — 사용하지 않는다.
- 서버 비밀 키(`CAREERNET_API_KEY`)와 Supabase 공개 키(`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`)는 Vercel 프로젝트 환경변수에 등록되어 있음(`npx vercel env ls`로 확인).
- `dist/`, `.vercel/`, `.env*`는 전부 gitignore됨(추적 안 됨).

## 알아둘 것

- 배포 후 Vercel 엣지/브라우저 캐시로 옛 UI가 보일 수 있음 → 하드리프레시 / `npm run verify`. 프로필 화면에 빌드 스탬프 표시됨.
