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

## ⚠️ v1은 대입 트랙만 — `V1_UNIV_ONLY = true` (2026-09-17 다시 켬)

**v1(출시본) 범위는 대입 트랙 + 검정고시 안내 + 지원(꿈드림) + MY 뿐이다** (동근님 결정, 2026-09-03 · 2026-09-17 재확인).
커뮤니티·학습 트랙(공부 플래너·학습 로드맵)·직업 트랙·진로 허브는 **v2**다. `main`(=배포본)에서 보이면 안 된다.

- 스위치: `src/lib/persona.js`의 `V1_UNIV_ONLY`. 가리는 판단은 `isHiddenScreen()` 한 곳.
  화면·데이터·로직은 지우지 않았다 — 입구만 막았다.
- 경위: 09-03 `1be9c03`에서 켰는데, 09-07 `e7ecfa8`이 결정 없이 플래그째 지워서 V2가 배포돼 있었다.
  09-17 그 커밋을 되돌려(`revert`) 다시 켰다. 서연님 리디자인(인사→나이→상황 온보딩 등)은 유지했다.
- **V2 개발은 `v2` 브랜치에서 한다.** 09-17 시점의 전체 기능 상태를 그대로 보관해 뒀다.
  `main`에 V2 화면을 새로 붙일 때는 반드시 `isHiddenScreen`에 걸리는 이름(`community*`·`job-*`·`study-*`·`explore`)을 쓰거나 `V1_UNIV_ONLY`로 감싼다.
- **이 스위치를 `false`로 바꾸거나 지우는 건 동근님 승인 사항이다.** "진로 탭이 안 보인다"는 보고는 버그가 아니다.
- 새 화면에서 V2 화면으로 가는 버튼(`goTo('community')` 등)을 만들면 v1에서 "준비 중"으로 떨어진다. 버튼도 같이 가릴 것.

### ⚠️ `v2` 브랜치를 `main`에 합칠 때 — 충돌 예상 지점 (2026-09-17 메모)

`v2` 브랜치는 `04e6f95`(09-17 오전)에서 갈라졌다. 그 뒤 `main`에서 화면 구조를 크게 바꿨다
(커밋 `25976d5` 이후 — 하단 탭 제거·화면 합치기). **`v2`가 아래 파일을 고쳤다면 반드시 충돌한다.**

| `main`에서 한 일 | 파일 | `v2` 쪽 수정을 어디로 옮기나 |
|---|---|---|
| 삭제 | `components/BottomNav.jsx` | 하단 탭은 없다. 입구는 홈(`TrackHome`) 카드나 우측 상단 아이콘으로 |
| 삭제 | `components/SupportScreen.jsx` | `DreamdriveScreen.jsx` (공통 지원·나이 안내가 옮겨 가 있음). 커뮤니티 '후기' 버튼도 여기로 |
| 삭제 | `components/GlossaryScreen.jsx` | `HelpScreen.jsx` (용어 목록이 들어가 있음. 진로 용어는 트랙으로 분기) |
| 삭제 | `lib/homeSearch.js` | 홈 검색은 뺐다. 되살릴지 동근님께 먼저 확인 |
| 이름 변경 | `ChecklistScreen.jsx` → `ChecklistSection.jsx` | 화면이 아니라 `RoadmapScreen` 안의 구역이 됐다 |
| 크게 수정 | `TrackHome.jsx`, `App.jsx`, `RoadmapScreen.jsx`, `HelpScreen.jsx`, `MyPageScreen.jsx`, `lib/persona.js`(`getNav`·`activeTabId`) | `main` 구조를 기준으로 두고 `v2` 기능만 얹는다 |

합칠 때 원칙: **`main`의 구조(탭 없음·같은 기능은 한 화면)를 기준으로 하고, `v2`의 새 기능만 옮겨 심는다.**
충돌을 `v2` 쪽으로 밀면 위 정리가 통째로 되돌아간다. `git merge` 전에 동근님께 먼저 알릴 것.

## 아키텍처

- **React 18 + Vite 6**, JS/JSX (TypeScript 아님, `"type":"module"`).
- **커스텀 라우터** — react-router 아님. `src/App.jsx`가 `{screen, params}` 스택을 들고 `goTo()`/`goBack()`을 모든 화면에 prop으로 넘긴다. 새 화면은 `KNOWN_SCREENS`에 등록해야 함. `goTo('home')`만 스택을 비운다(하단 탭이 없어서 나머지는 전부 뒤로가기로 나온다 — 새 화면엔 뒤로 버튼 필수). 안 하면 "준비 중" placeholder.
- **페르소나 기반 UI** (`src/lib/persona.js`) — `{stage, goal}`에 따라 노출 기능이 달라짐. 상태는 localStorage `rebridge_profile`. 모든 사용자에게 모든 기능을 한꺼번에 보여주지 않는 게 원칙.
- **트랙 3개** (v1에서는 `univ` 하나만 노출 — 위 절 참고) — 홈에서 고른 길(`activeTrack`)에 따라 `TrackHome`이 다른 대시보드를 그린다.
  `study`(검정고시) · `univ`(대입) · `job`(일·진로). 카드·문구·바로가기는 전부
  `src/components/TrackHome.jsx` 위쪽 `TRACK_DATA` 한 곳에 있다.
  **하단 탭은 없다** (2026-09-17 동근님). 마이페이지는 홈 우측 상단 아이콘.
- **같은 기능은 한 화면에만** (2026-09-17 동근님). 합친 화면과, 예전 이름으로 와도 열리게 남긴 별칭:
  | 화면 | 합친 것 | 별칭(screen 이름) |
  |---|---|---|
  | `RoadmapScreen` "지금 시기에 할 일" | 내 로드맵 + 서류 체크리스트(`ChecklistSection`) | `checklist` → 서류 구역으로 스크롤 |
  | `HelpScreen` "담임에게 물어보기" | 자주 묻는 질문 + 입시 용어 | `glossary` (`termId`로 해당 용어 펼침) |
  | `DreamdriveScreen` "꿈드림센터 · 지원 혜택" | 꿈드림센터 찾기 + 지원 혜택(공통 지원·나이 안내) | `support` (`supportId`로 해당 지원 펼침) |
  홈(대입)은 바로가기 3개(대학 찾기·내 점수·꿈드림센터) + 지금 바로 2개뿐. 홈 검색창은 뺐다.
  같은 기능의 입구를 새로 만들지 말 것. MY에는 '나만의 것'(관심 대학 등)만 둔다.
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

- `src/components/` — `*Screen.jsx` 화면들 + `SplashScreen`, `TrackHome`(홈 본문), `ChecklistSection`
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
