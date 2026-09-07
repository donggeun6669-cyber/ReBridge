# ReBridge (검고담임)

검정고시생·학교 밖 청소년을 위한 입시·진로 정보 웹앱. AI 공모전 출품작.
배포: https://gumgomentor.vercel.app

## ⚠️ 가장 중요한 규칙

- **앱 코드는 오직 `ReBridge_AI공모전용/Application_main_codes/` 안에만 있다.** 다른 위치의 옛 복사본은 절대 수정하지 말 것. GitHub 레포가 유일한 정본(single source of truth).
- 모든 npm 명령은 레포 루트가 아니라 위 폴더에서 실행한다.
- 코드·주석·커밋·문서 전부 한국어. 편집 시 한국어 유지.
- 작업 전 `git pull`, 작업 후 `git push`.

## 실행 방법 (`Application_main_codes/`에서)

```bash
npm install
npm run dev            # http://localhost:5173 — .env 없이도 실행됨(커뮤니티는 mock 모드)
npm run build          # dist/ 산출 — ⚠️ build 명령의 node node_modules/... 경로와
                       #   vite의 dependencies 위치는 Vercel 배포가 깨져서 되돌린 것.
                       #   "단순화"하지 말 것 (2026-07-30 실제 배포 실패)
npm run deploy         # npx vercel --prod (수동 배포 — 보통은 push 자동배포로 충분)
npm run verify         # 배포 캐시 우회 검증 (node verify-deploy.mjs)
```

전체 기능이 필요하면 `cp .env.example .env` 후 키를 채운다(키 목록은 `.env.example` 참고).

테스트/린트/CI 없음.

## 팀 작업 (3인) — 한 대의 맥, 하나의 계정을 번갈아 쓴다

**팀원(UI 담당)이 동근님 계정의 Claude Code에서 같은 폴더로 작업한다.**
그래서 대화 상대가 동근님이 아닐 수 있다. 상대가 자기 이름을 밝히면 그 이름으로 부르고,
밝히지 않으면 기본값("동근님")을 유지한다. UI 작업 요청은 아래를 전제로 답하라.

- **`git clone`·`npm install`을 안내하지 마라.** 이미 다 되어 있다.
  새 사람에게 필요한 건 `git pull` 하나뿐이다.
- 브랜치를 쓰지 않는다. `main`에서 바로 작업하고 push하면 곧장 배포된다.
  → **작업 시작 전 `git pull`을 반드시 먼저.** 같은 폴더를 여럿이 쓰므로
    다른 세션이 이미 push해 뒀을 수 있다.
- **두 사람이 동시에 작업하지 않는다.** 같은 폴더라 서로의 파일을 덮어쓴다.
- 커밋 author 는 항상 동근님(`donggeun6669-cyber`)으로 찍힌다. 누가 한 작업인지
  남기려면 커밋 메시지 본문에 적는다.
- 팀원의 주 업무는 UI(화면 모양·문구)다. 기능 구조를 바꾸자는 제안보다
  **눈에 보이는 것을 고치는 쪽**으로 도와라.
- "이 데이터 뭐 들어 있어?"라고 물으면 코드를 열기 전에
  **`https://gumgomentor.vercel.app/#data`(로컬은 `localhost:5173/#data`)를 먼저 안내한다.**

### ⚠️ 이 맥에는 옛 ReBridge 복사본이 3개 더 있다 — 열지 말 것

정본은 **`/Users/r_o_und_12/dev/GitHub/ReBridge`** 하나뿐이다.
(`~/Documents/GitHub` 는 `~/dev/GitHub` 로 가는 심볼릭 링크라 같은 폴더다.
 Claude Code 프로젝트 목록에 ReBridge 가 두 개로 보이는 건 그 때문이고, 둘 다 정본이다.)

아래는 전부 옛 복사본이다. **여기 파일을 고치면 GitHub 에 반영되지 않는다.**

| 경로 | 상태 |
| --- | --- |
| `~/Downloads/ReBridge` | 2026-06-02 커밋에서 멈춘 git 복사본 |
| `~/Downloads/리브릿지 파일원본/ReBridge` | git 아님. 단순 파일 복사본 |
| `~/Documents/DEAN/03_PROJECTS/Gumgomentor/ReBridge` | git 아님. 단순 파일 복사본 |

작업 경로가 위 셋 중 하나면 **손대지 말고 먼저 알려라.**

## ⚠️ v1 숨김 플래그는 걷어냈다 (2026-09-07)

2026-09-03 커밋 `1be9c03`에서 `V1_UNIV_ONLY = true`로 커뮤니티·진로(job)·학습(study)
트랙을 **가려뒀다가, 2026-09-07에 전부 되살리고 플래그 자체를 제거했다.**
지금은 세 트랙과 커뮤니티가 모두 노출되는 게 정상이다.

- "진로 탭이 안 보인다 / 준비 중이 뜬다"는 보고가 오면 **플래그를 다시 찾지 말 것.** 없다.
  `src/App.jsx`의 `KNOWN_SCREENS`에 그 화면 이름이 있는지부터 확인한다.
- 다시 일부만 노출하고 싶어져도 **플래그를 되살리지 말 것.** 화면을 가리는 장치가
  11개 파일에 흩어져 유지보수가 어려웠다. 노출 범위는 페르소나/트랙으로 조절한다.

## 아키텍처

- **React 18 + Vite 6**, JS/JSX (TypeScript 아님, `"type":"module"`).
- **커스텀 라우터** — react-router 아님. `src/App.jsx`가 `{screen, params}` 스택을 들고 `goTo()`/`goBack()`을 모든 화면에 prop으로 넘긴다. 새 화면은 `KNOWN_SCREENS`(+ 탭 루트면 `TAB_ROOTS`)에 등록해야 함. 안 하면 "준비 중" placeholder.
- **페르소나 기반 UI** (`src/lib/persona.js`) — `{stage, goal}`에 따라 노출 기능이 달라짐. 상태는 localStorage `rebridge_profile`. 모든 사용자에게 모든 기능을 한꺼번에 보여주지 않는 게 원칙.
- **트랙 3개** — 홈에서 고른 길(`activeTrack`)에 따라 `TrackHome`이 다른 대시보드를 그린다.
  `study`(검정고시) · `univ`(대입) · `job`(일·진로). 카드·문구·바로가기는 전부
  `src/components/TrackHome.jsx` 위쪽 `TRACK_DATA` 한 곳에 있다.
  하단 탭은 트랙과 무관하게 항상 4개(홈·지원·커뮤니티·MY).
- **점수 엔진은 규칙 기반, AI 아님** (`src/lib/scoreEngine.js`).
  **연도는 전부 `src/data/meta.js` 한 곳에서 읽는다** — 화면에 연도를 하드코딩하지 말 것.
  현재: 지원 학년도 2027 · 합격선 기준 2026(비교용 2025) · 시행계획 2028.
  2028학년도부터 고교 내신이 5등급제라 그 이전(9등급)과 직접 비교가 불가능하다.
  UI는 "참고용"임을 명시하고 합격 보장 표현 금지.
- **커뮤니티 백엔드는 Supabase, 없으면 자동으로 localStorage mock으로 폴백** (`src/lib/supabaseClient.js`). 데모 인증코드 `DREAM-TEST` / `DREAM-DEMO`는 mock 모드에서만 시드·노출된다.
  - **Supabase 프로젝트는 `Rebridge(Gumgomentor)`(ref `oeghpijufjgekngzpasd`, 도쿄) 전용이다.**
    2026-08-30에 학원관리 앱과 같이 쓰던 프로젝트에서 분리했다. 학원 쪽(`donggeun6669-cyber's Project`)을
    다시 물리지 말 것 — 공개 저장소라 anon 키가 번들에 노출되는데, 그쪽엔 실명 학생 정보가 있다.
  - ⚠️ **폴백은 키가 '없을 때'만 동작한다.** 키가 있는데 프로젝트가 정지되면 mock으로 안 떨어지고
    커뮤니티가 조용히 먹통이 된다. 무료 플랜은 1주 미사용 시 자동 정지된다.
    2026-07~08에 한 달, **2026-09-07에 또 한 번** 실제로 정지돼 있었다(그날 복구함).
    **커뮤니티가 안 되면 코드를 보기 전에 프로젝트 상태부터 확인할 것** — Supabase 대시보드에서
    `Rebridge(Gumgomentor)`가 `INACTIVE`면 Restore를 누르면 몇 분 뒤 살아난다.
- 기획·기능·데이터 현황은 `ReBridge_AI공모전용/Planning/PRD.md` 한 장에 통합돼 있다.

## 디렉터리 (`Application_main_codes/`)

- `src/components/` — `*Screen.jsx` 화면들 + `BottomNav`, `SplashScreen`, `TrackHome`
- `src/lib/` — 로직 (persona, scoreEngine, careernet, community, auth, youthVerify …)
- `src/data/` — 정적 데이터셋 26개. 크게 두 갈래다.
  - **수집 데이터(JSON 12개)** — universities · admissions_2027(.min) · admissions(2028시행계획) ·
    cutlines_2025/2026 · cutlines_college_2025/2026 · comparative_2027/2028 · ged_freshmen · kkumdrim
  - **직접 쓴 안내(JS 14개)** — meta(연도·출처 단일 소스) · gedGuide · schedule · glossary ·
    checklists · policies · careerData · careerMentor · jobData …
  - `pdf_sources/`(2.5GB)는 파이프라인 입력물이고 gitignore된다. 앱은 읽지 않는다.
- `api/` — Vercel 서버리스 함수 (`careernet.js`) — API 키 프록시
- `supabase/schema.sql` — 커뮤니티 테이블 + RLS + `redeem_code` RPC
- `src/components/RawDataScreen.jsx` + `src/lib/rawDatasets.js` — **데이터 원본 화면(팀 내부용)**.
  `src/data/`의 파일을 가공 없이 표로 보여준다. 주소 뒤 `#data`로만 열린다
  (https://gumgomentor.vercel.app/#data). 사용자 동선에는 링크가 없다.
  UI를 고치기 전에 "실제로 어떤 필드가 있는지" 볼 때 쓴다.
  새 데이터 파일을 만들면 `rawDatasets.js`의 `DATASETS`에 한 줄 추가한다.
  ⚠️ 로더는 전부 동적 import다 — 정적 import로 바꾸면 첫 로딩 번들에 4MB가 얹힌다.
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

## 배포 구조 (2026-09-07 재확인)

- **GitHub `main` 푸시 → Vercel 자동 배포 → `gumgomentor.vercel.app` 자동 갱신.**
  레포가 Vercel 프로젝트 **`gumgomentor`**에 Git 연동돼 있고, 대외 주소가 그 프로젝트의
  프로덕션 도메인이다. **푸시 말고는 할 일이 없다** — `vercel alias`도, 수동 배포도 필요 없다.
  (2026-09-07 실측: 푸시 32초 뒤 새 배포에 `gumgomentor.vercel.app`이 붙어 있었다)
- 저장소는 **2026-07-30 공개(public)로 전환**했다. 과거 비공개 시절에는 Hobby 플랜 제약으로
  팀원 커밋이 HEAD면 자동배포가 거부됐는데(2026-06-23 실제 발생), 공개 전환으로 해소됐다.
  팀원 push 후 배포 성공 여부는 여전히 한 번 확인하는 게 안전하다.
- **주소는 `gumgomentor.vercel.app` 하나만 안내한다.**
  - `rebridge-rho.vercel.app` — 프로젝트 옛 이름(`rebridge`) 때문에 Vercel이 자동 생성한 주소.
    같은 배포를 가리키므로 **틀린 주소는 아니지만 대외에 쓰지 않는다.** 지우지도 말 것(자동 생성분).
  - 🏆 `gumgomentor-award.vercel.app` — 공모전 수상본(2026-06-04 배포) 동결. 자동배포가 닿지 않는
    고정 별칭이므로 **여기에 `vercel alias`를 다시 걸지 말 것.** 소스는 git 태그 `award-v1`.
  - `gumgomentor-beta.vercel.app`(3차 수정배포)는 프로젝트째 삭제했다.
- ⚠️ **수동 배포(`npx vercel --prod`)가 정말 필요하면 레포 루트에서 한다.** Vercel 프로젝트의
  Root Directory가 `ReBridge_AI공모전용/Application_main_codes`로 잡혀 있어서, 앱 폴더에서 돌리면
  "Root Directory does not exist"로 실패한다. (npm 명령은 앱 폴더에서 하는 규칙과 다르니 주의)
  다만 자동배포가 잘 도는 지금은 쓸 일이 없다.
- 서버 비밀 키(`CAREERNET_API_KEY`)와 Supabase 공개 키(`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`)는 Vercel 프로젝트 환경변수에 등록되어 있음(`npx vercel env ls`로 확인).
- `dist/`, `.vercel/`, `.env*`는 전부 gitignore됨(추적 안 됨).

## ⚠️ 검정고시 정보는 사실 확인 없이 고치지 말 것

이 앱의 존재 이유가 "정확한 안내"라 여기서 틀리면 다른 걸 다 잘해도 의미가 없다.
2026-08-30 점검에서 실제로 오류 3건·누락 2건이 나왔다(커밋 `68a1d8b`).

### 매년 해야 하는 일 — 검정고시 일정 갱신

`src/data/schedule.js`의 `GED_SESSIONS`는 **`GED_CONFIRMED_YEARS`에 있는 연도에만 확정값**이다.
공고 전 연도에는 화면이 날짜·D-day를 감추고 "예년엔 4월 초" 식으로만 안내한다.

새 연도 일정이 공고되면(보통 **12월~1월**에 시·도교육청 공고) 반드시 둘 다 한다:

1. `GED_SESSIONS`의 `apply`/`exam`/`result`를 그 해 공고값으로 교체
2. `GED_CONFIRMED_YEARS`에 그 연도를 추가

**둘 중 하나만 하면 안 된다.** 1번만 하면 확정 날짜인데 "공고 전"으로 표시되고,
2번만 하면 작년 날짜를 확정이라고 우기게 된다.

> 확인처: 국가평생교육진흥원 검정고시지원센터(gumsi.or.kr) · 거주지 시·도교육청 공고

### 고칠 때 지킬 것

- **공식 출처로 확인하고 고친다.** 시·도교육청, 찾기쉬운 생활법령정보(easylaw.go.kr),
  국가평생교육진흥원. 블로그·학원 사이트는 근거가 아니다. 기억에 의존해 쓰지 말 것.
- **확인한 출처를 코드 주석에 남긴다.** `gedGuide.js`가 그렇게 되어 있다.
- 공고 전 일정을 확정 날짜로 표시하지 않는다. D-day도 마찬가지다.

### 이미 확인된 사실 (다시 조사하지 말 것 — 2026-08-30 기준)

- 고졸 필수 6과목: 국어·수학·영어·사회·과학·한국사. 선택 1과목은
  **도덕·기술가정·체육·음악·미술 5개 중 택1** (`진로와직업`은 고졸 선택과목이 **아니다**).
- 합격: 전 과목 평균 60점 이상. 과목별 과락 없음.
- **결시는 0점 처리가 아니라 불합격이다.** 접수한 과목을 하나라도 안 보면 그 회차 불합격.
  ("한 과목 버리고 평균으로 넘긴다"는 전략은 성립하지 않는다 — 이 문구를 되돌리지 말 것)
- **과목합격제**: 불합격해도 60점 이상 과목은 인정되고, 다음 회차에 면제 신청하면
  그 점수가 합산된다.
- **응시 결격**: 고교 재학·졸업자, 자퇴/제적 후 **제적일부터 공고일까지 6개월 미경과자**,
  부정행위 후 2년 미경과자. (장애인복지법 등록 장애인의 학업 중단 퇴학은 6개월 규칙 예외)

## 알아둘 것

- 배포 후 Vercel 엣지/브라우저 캐시로 옛 UI가 보일 수 있음 → 하드리프레시 / `npm run verify`. 프로필 화면에 빌드 스탬프 표시됨.
