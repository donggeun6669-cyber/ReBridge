# 공통 지시 (모든 에이전트)

앱: 검고담임 (React 18 + Vite). 앱 폴더 `APP=<레포 루트>/ReBridge_AI공모전용/Application_main_codes`.
현재 브랜치 `prd2-center-demo` = 기능 원본. (2026-09-28 작업. 동근님: "천천히 해. 끝나고 수정할 수 있다")

## 목표
팀원 서연이 Figma로 만든 UI 시안(PNG, 390×844)을 **그대로** 코드로 옮기고, 기존 기능(데이터·저장·계산·쪽지)을 연결한다.
시안 PNG 폴더: `ReBridge_AI공모전용/Planning/서연_UI시안_2026-09-28/` (레포 안)
(맨 위 9:41 상태바와 바깥 둥근 기기 테두리는 기기 화면이라 구현하지 않는다.)

## 절대 규칙
1. **시안을 바꾸지 않는다.** 배치·문구·색·아이콘·순서·크기를 시안과 같게. 시안에 없는 요소(버튼·안내문·배지)를 새로 넣지 않는다. 시안에 있는 걸 빼지 않는다.
   - 픽셀 값이 필요하면 python PIL 로 PNG 를 재서 맞춘다(여백·글자 크기·색). 색은 `src/sy/sy.css` 의 `--sy-*` 토큰을 우선 쓴다.
   - 아이콘은 `lucide-react`(이미 설치)에서 시안과 가장 비슷한 것.
2. 시안의 예시 값(예: '보라별', '92.4', '가천대학교')은 **실제 데이터/사용자 입력으로 바꿔 끼운다**. 데이터가 없을 때의 상태가 시안에 있으면 그 상태를 쓴다. 가짜 값을 지어내 넣지 않는다(시연 예시 글처럼 기존 코드에 이미 있는 예시 데이터는 써도 된다).
3. 시안 요소에 연결할 기존 기능이 없으면 모양은 그대로 두고, 누르면 가장 가까운 기존 화면으로 가게 하거나 아무 동작 없이 둔 뒤 **보고**한다.
4. 기존 기능 중 **시안에 넣을 자리가 없는 것은 넣지 않는다(보류)** → 목록으로 보고한다.
5. **기존 파일을 고치지 않는다.** `src/App.jsx`, `src/components/*`, `src/lib/*`, `src/data/*`, `src/sy/sy.css`, `src/sy/SyTabBar.jsx`, `src/sy/SyTop.jsx` 전부 읽기만. 
   네가 쓰는 파일은 **아래 '네 파일' 목록 + 네 전용 CSS 파일 `src/sy/sy-<묶음>.css` 하나 + 필요하면 `src/sy/<묶음>Util.js`** 뿐이다. 다른 에이전트가 같은 폴더에서 동시에 일한다.
   CSS 는 네 JSX 에서 `import './sy-<묶음>.css'` 로 불러온다. 클래스 이름은 `sy-<묶음>-` 접두사.
6. git 커밋·푸시·브랜치 조작 금지. npm install 금지.
7. 코드·주석 한국어.

## 이미 있는 것
- 라우팅: `src/App.jsx` 의 `SY_SCREENS` 가 화면 id → `src/sy/Sy*.jsx` 로 연결해 둠. 모든 Sy 화면은 props
  `{ goTo, goBack, params, screen, canGoBack, onProfileComplete }` 를 받는다. `goTo('화면id', {파라미터})`, `goBack()`.
  탭 첫 화면 id: `home` `centers` `univ-home` `community` `mypage` (goTo 하면 스택이 비워짐).
  SY_SCREENS 에 없는 id 로 goTo 하면 **예전 화면**(src/components)이 뜬다 — 시안이 없는 기능으로 보낼 때 그걸 쓴다.
- 공통: `src/sy/sy.css` (토큰 `--sy-bg` `--sy-green #315E59` `--sy-line` `--sy-ink` `--sy-ink-2` `--sy-peach #F7B89C` 등, 클래스 `.sy-screen` `.sy-top` `.sy-card` `.sy-btn` `.sy-chip`),
  `src/sy/SyTop.jsx` (`<SyTop title onBack action onAction actionTone="orange" />` = 〈 뒤로 + 제목 + 오른쪽 글자 버튼), 하단 탭은 App 이 그린다(화면에서 그리지 말 것).
  `.sy-screen` 은 좌우 20px 여백, 세로 스크롤. 글꼴 Pretendard.
- 기존 화면 구현(`src/components/*.jsx`)과 로직(`src/lib/*.js`)을 **읽고** 같은 함수·저장소를 불러 써라. 기존 화면이 하던 기능 로직을 새 화면에서 호출.

## 확인
- 다 만들면 `cd $APP && npx vite build` 가 통과해야 한다.
- 화면 확인: `cd $APP && npx vite --port <네 포트> --strictPort` 를 백그라운드로 띄우고(끝나면 꼭 종료),
  playwright 브라우저 도구(없으면 ToolSearch 로 `mcp__playwright__browser_navigate` 등 로드)로 390×844 에서
  `http://localhost:<포트>/#go=<화면id>&키=값` 을 열어 스크린샷을 찍고 시안 PNG 와 나란히 비교해 차이를 고친다.
  (#go= 는 dev 에서만 동작. 새로고침이 필요하면 navigate 를 다시.) 브라우저 도구가 안 되면 build 통과만으로 끝내고 그렇게 보고.

## 보고 (마지막 메시지, 짧게)
1. 만든 파일
2. 각 화면: 시안과 다른 점(있으면 전부, 이유)
3. 버튼별 연결: 어디로 가는지 / 기능이 없어 연결 못 한 것
4. 기존 기능 중 시안에 자리가 없어 보류한 것
5. 새로 쓴 화면 id 가 있으면(예: `location-consent`) 무엇인지
6. build 결과, 브라우저 확인 여부
