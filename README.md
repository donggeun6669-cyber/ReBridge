# 검고담임 (ReBridge)

> 학교를 나온 청소년에게, 담임이 해주던 일을 대신하는 앱.

검정고시생·학교 밖 청소년을 위한 입시·진로 안내 웹앱입니다.
대학별 PDF와 기관 자료에 흩어져 있는 정보를 한곳에 모아,
자신의 조건(검정고시 점수)으로 **지원 가능한 대학을 직접 확인**할 수 있게 합니다.

**🔗 라이브 데모 — https://gumgomentor.vercel.app** (설치 없이 바로 써볼 수 있습니다)

## 수상

| 공모전 | 결과 | 시기 |
| --- | --- | --- |
| 미래세대의 AI+X 정책실험: HUSS LIVING LAB 성과공유회 | **한국인사행정학회장상 (대상)** | 2026.07 |
| 사회문제 해결을 위한 AI 활용 아이디어 공모전 (뤼튼 연계) | **대상** | 2026.06 |

3인 팀 프로젝트입니다. 기획·데이터 구축·팀 리딩은 [정동근](https://donggeun-jeong.vercel.app)이 맡았습니다.

## 구축한 데이터

입시 관련 **원본 PDF 715개를 직접 수집**하고, Python 파이프라인으로 구조화했습니다.

| 데이터 | 규모 |
| --- | --- |
| 대학 | 351개 (4년제 213 · 전문대 138) |
| 2027학년도 검정고시 지원 가능 전형 | 2,496건 |
| 2028학년도 시행계획 전형 | 1,007건 |
| 4년제 합격선 | 2026학년도 184개 대학 · 2025학년도 118개 대학 |
| 전문대 합격선 | 2026학년도 110개 대학 · 2025학년도 116개 대학 |
| 비교내신 환산표 | 2027학년도 181개 대학 · 2028학년도 188개 대학 |
| 검정고시 출신 신입생 통계 | 206개 대학 (2024–2026) |
| 전국 꿈드림센터(지원기관) | 222개소 |

앱에서 **가공 없이 원본 그대로** 확인할 수 있습니다 → https://gumgomentor.vercel.app/#data

## 원칙

기획 전체는 [PRD](ReBridge_AI공모전용/Planning/PRD.md) 한 장에 있습니다. 핵심 원칙만 추리면:

1. **점수 분석은 규칙 기반.** AI 추론이 아니라 공개된 전형 규칙과 실제 입결 데이터로 계산합니다.
2. **추측 금지.** 자료에 없는 값은 만들어내지 않습니다. 자료가 없으면 "없음"이라고 정직하게 말합니다.
3. **합격 보장 표현 금지.** 제도가 다른 연도끼리는 직접 비교가 불가능하므로 모든 예측에 "참고용"을 명시합니다.

## 기술 구성

- **React 18 + Vite 6** (JS/JSX) · Vercel 배포
- 화면 전부 lazy 로딩 — 대형 JSON을 물고 있는 대입 화면들이 첫 로딩 번들에서 빠집니다
- **API 키는 Vercel 서버리스 프록시**(`api/careernet.js`)로 보호 — 파라미터 화이트리스트 + 레이트리밋
- 커뮤니티 백엔드는 Supabase 설계(스키마·RLS 완료, [schema.sql](ReBridge_AI공모전용/Application_main_codes/supabase/schema.sql)) —
  키가 없으면 **localStorage 목(mock) 모드로 자동 폴백**해 데모는 키 없이 전부 동작합니다
- 입시 데이터는 별도 **Python 툴체인**([data-pipeline](ReBridge_AI공모전용/data-pipeline))으로 PDF에서 추출·검증

## 바로 실행하기

```bash
git clone https://github.com/donggeun6669-cyber/ReBridge.git
cd ReBridge/ReBridge_AI공모전용/Application_main_codes
npm install
npm run dev   # → http://localhost:5173
```

**환경변수 없이 바로 실행됩니다.** 커뮤니티는 목 모드로, 진로 API는 비활성 상태로 동작합니다.
전체 기능에 필요한 키 목록은 [`.env.example`](ReBridge_AI공모전용/Application_main_codes/.env.example)에 있습니다.

## 저장소 구조

```
ReBridge_AI공모전용/
├── Application_main_codes/   앱 본체 (React + Vite) — 코드는 전부 여기
│   ├── src/components/       화면 단위 컴포넌트 (*Screen.jsx)
│   ├── src/lib/              로직 (점수 엔진, 페르소나, 커뮤니티 …)
│   ├── src/data/             구조화된 입시 데이터셋 (JSON)
│   ├── api/                  Vercel 서버리스 함수 (API 키 프록시)
│   └── supabase/schema.sql   커뮤니티 테이블 + RLS
├── Planning/PRD.md           기획·기능·데이터 현황 (한 장)
└── data-pipeline/            PDF → JSON 추출 툴체인 (Python, 오프라인)
```

개발 규칙과 아키텍처 상세는 [CLAUDE.md](CLAUDE.md)에 있습니다.

## UI를 고칠 때

| 하고 싶은 것 | 고칠 곳 |
| --- | --- |
| 화면 모양·배치 | `src/components/*Screen.jsx` |
| 색·여백·글씨 | `src/styles.css` (공통) · `src/styles.*.css` (화면별) |
| 홈 화면의 카드·아이콘·문구 | `src/components/TrackHome.jsx` 위쪽 `TRACK_DATA` |
| 안내 문구·용어·일정 | `src/data/` — 화면이 아니라 이쪽을 고쳐야 앱 전체가 같이 바뀜 |

**표에 뭐가 들어 있는지 모르겠으면 https://gumgomentor.vercel.app/#data 를 여세요.**
우리가 모은 데이터 26개를 가공 없이 그대로 보여줍니다. 필드 이름·실제 값·출처가 다 나옵니다.

### 알아둘 것

- **화면을 새로 만들면 `src/App.jsx`의 `KNOWN_SCREENS`에 이름을 넣어야 합니다.** 안 넣으면
  "준비 중" 안내만 뜹니다. react-router가 아니라 직접 만든 라우터를 씁니다.
- 색은 직접 쓰지 말고 `styles.css` 맨 위의 CSS 변수(`var(--brand)`, `var(--text-sub)` …)를 쓰세요.
- 화면 폭은 430px 고정입니다(모바일 기준). 넓은 화면에서도 그 폭으로 나옵니다.
- **검정고시 관련 안내 문구는 사실 확인 없이 고치지 마세요.** 자세한 건 [CLAUDE.md](CLAUDE.md)에.
- 배포 후 옛 화면이 보이면 캐시입니다 → 하드리프레시(⌘⇧R) 하거나 `npm run verify`.

## 배포

`main`에 push하면 Vercel이 자동으로 배포합니다.
배포 직후 화면이 안 바뀌어 보이면 브라우저 캐시입니다 — 프로필 화면 맨 아래의
`build MM-DD HH:mm` 스탬프로 어떤 빌드인지 즉시 확인할 수 있고, `npm run verify`로
라이브가 새 빌드를 서빙하는지 검증합니다.
