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
npm run deploy         # vercel --prod
npm run verify         # 배포 캐시 우회 검증 (node verify-deploy.mjs)
```

테스트/린트/CI 없음.

## 아키텍처

- **React 18 + Vite 6**, JS/JSX (TypeScript 아님, `"type":"module"`).
- **커스텀 라우터** — react-router 아님. `src/App.jsx`가 `{screen, params}` 스택을 들고 `goTo()`/`goBack()`을 모든 화면에 prop으로 넘긴다. 새 화면은 `KNOWN_SCREENS`(+ 탭 루트면 `TAB_ROOTS`)에 등록해야 함. 안 하면 "준비 중" placeholder.
- **페르소나 기반 UI** (`src/lib/persona.js`) — `{stage, goal}`에 따라 노출 기능/탭이 달라짐. 상태는 localStorage `rebridge_profile`. 모든 사용자에게 모든 기능을 보여주지 않는 게 원칙.
- **점수 엔진은 규칙 기반, AI 아님** (`src/lib/scoreEngine.js`). 2025 입결(9등급)과 2028 전형(5등급)은 직접 비교 불가 — UI는 "참고용"임을 명시하고 합격 보장 표현 금지.
- **커뮤니티 백엔드는 Supabase, 없으면 자동으로 localStorage mock으로 폴백** (`src/lib/supabaseClient.js`). 데모 인증코드 `DREAM-TEST` / `DREAM-DEMO` 시드됨.

## 디렉터리 (`Application_main_codes/`)

- `src/components/` — `*Screen.jsx` 화면들 + `BottomNav`, `SplashScreen`, `TrackShell`
- `src/lib/` — 로직 (persona, scoreEngine, careernet, community, auth, youthVerify …)
- `src/data/` — 정적 데이터셋 (universities.json, admissions.json, jobData.js, glossary.js …)
- `api/` — Vercel 서버리스 함수 (`careernet.js`) — API 키 프록시
- `supabase/schema.sql` — 커뮤니티 테이블 + RLS + `redeem_code` RPC
- `data-pipeline/` — 별도 Python 툴체인. 대학 PDF에서 admissions JSON 추출 (앱과 무관, 오프라인)

## 보안 주의

- **비밀 키는 서버리스 함수에서만.** `CAREERNET_API_KEY` 등 비밀 키는 `VITE_` 접두사 붙이지 말 것 (붙이면 클라이언트 번들에 노출됨). 과거 이 문제가 있었고 서버리스 프록시로 수정함 — 되돌리지 말 것.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`는 공개용(RLS 보호)이라 노출 정상. `service_role` 키는 클라이언트에서 절대 사용 금지.
- `.env`는 gitignore됨. `.env.example`만 커밋.

## 알아둘 것

- `dist/`, `.vercel/`가 git에 추적됨(의도적, 배포 방식 때문).
- 배포 후 Vercel 엣지/브라우저 캐시로 옛 UI가 보일 수 있음 → 하드리프레시 / `npm run verify`. 프로필 화면에 빌드 스탬프 표시됨.
