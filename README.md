# ReBridge (검고담임)

검정고시생·학교 밖 청소년을 위한 입시·진로 안내 웹앱.
흩어져 있는 대학·전형·지원센터 정보를 한곳에 모아, 자신의 조건으로 지원 가능 여부를 확인할 수 있게 합니다.

- **라이브:** https://rebridge-rho.vercel.app
- **기획·데이터 현황:** [PRD](ReBridge_AI공모전용/Planning/PRD.md)
- **개발 규칙:** [CLAUDE.md](CLAUDE.md)

## 수상

- 「사회문제 해결을 위한 AI 활용 아이디어 공모전」 **대상** (뤼튼 연계)
- 「미래세대의 AI+X 정책실험: HUSS LIVING LAB 성과공유회」 **한국인사행정학회장상(대상)**

## 데이터

대학 351개 · 전형 1,007건 · 꿈드림센터 222개소 · 2025 입시결과 118개 대학 264레코드 · 2028 전형 비교 188개 대학 574레코드 — 입시 관련 원본 PDF 247개를 직접 수집해 구축 (React 18 + Vite 6, Supabase, Vercel)

---

## 프로젝트 위치 (중요)

앱 코드는 저장소 루트가 아니라 아래 폴더 안에 있습니다. **항상 이 폴더에서 작업합니다.**

```
ReBridge_AI공모전용/Application_main_codes/
```

정본은 이 GitHub 저장소 하나뿐입니다. 로컬 다른 폴더의 옛 복사본에서 고치면 변경이 사라진 것처럼 보입니다.

---

## 처음 시작

```bash
git clone https://github.com/donggeun6669-cyber/ReBridge.git
```

그다음 앱 폴더로 이동해서 설치합니다.

```bash
cd ReBridge/ReBridge_AI공모전용/Application_main_codes && npm install
```

환경변수 파일을 만듭니다. `.env`는 git에 올라가지 않으니 직접 만들어야 합니다.

```bash
cp .env.example .env
```

`.env`에 채울 실제 키는 팀 리더에게 받으세요. 키가 없어도 앱은 실행됩니다
(커뮤니티는 localStorage 목 모드로, 진로 API는 비활성 상태로 동작).

개발 서버를 띄웁니다. → http://localhost:5173

```bash
npm run dev
```

---

## 매일 작업 흐름

작업 **전** 최신 받기:

```bash
git pull
```

작업 **후** 올리기:

```bash
git add -A && git commit -m "무엇을 바꿨는지" && git push
```

이 두 개만 지키면 "내 수정이 사라졌다" 사고가 안 납니다.

---

## 배포

**`main`에 push하면 Vercel이 자동으로 배포합니다.** 별도 명령이 필요 없습니다.
저장소 push 권한이 있는 사람은 누구나 이 방식으로 배포할 수 있습니다.

수동 배포가 필요한 경우에만:

```bash
npm run deploy
```

라이브가 실제로 새 빌드를 서빙하는지 확인:

```bash
npm run verify
```

### "배포했는데 화면이 안 바뀐다" 싶으면

1. 프로필 화면 맨 아래 `build MM-DD HH:mm` 시각을 확인하세요. 방금 배포한 시각이면 최신입니다.
2. 그래도 옛날로 보이면 **브라우저 캐시**입니다. 시크릿창으로 열거나 주소 뒤에 `?v=1`을 붙이세요.
3. `npm run verify`로 라이브 상태를 바로 확인할 수 있습니다.

`rebridge-<해시>-...vercel.app` 같은 주소는 그 빌드에 박제되니 공유하지 마세요. 위 고정 주소만 씁니다.

---

## 환경변수

| 키 | 용도 | 비고 |
| --- | --- | --- |
| `CAREERNET_API_KEY` | 커리어넷 직업정보 API | **서버 전용.** `VITE_` 접두사 절대 금지 |
| `VITE_SUPABASE_URL` | 커뮤니티 백엔드 | 공개돼도 안전(RLS 보호) |
| `VITE_SUPABASE_ANON_KEY` | 커뮤니티 백엔드 | 공개돼도 안전(RLS 보호) |

Vercel 프로젝트에 이미 등록돼 있습니다(`npx vercel env ls`로 확인).
`VITE_` 접두사가 붙은 키는 클라이언트 번들에 그대로 노출되므로, 비밀 키에는 절대 붙이지 마세요.

---

## 폴더 구조

```
ReBridge_AI공모전용/
├── Application_main_codes/   앱 본체 (React + Vite)
├── Planning/PRD.md           기획·기능·데이터 현황 (한 장)
└── data-pipeline/            입시 데이터 추출 툴체인 (Python, 오프라인)
```
