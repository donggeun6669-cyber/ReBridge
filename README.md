# ReBridge

검정고시생·학교 밖 청소년을 위한 입시 정보 앱.

---

## 📁 프로젝트 위치 (중요)

실제 앱 코드는 저장소 루트가 아니라 아래 폴더 안에 있어요. **항상 이 폴더에서 작업/배포합니다.**

```
ReBridge_AI공모전용/Application_main_codes/
```

> ⚠️ 옛날에 만든 다른 복사본(예: `~/Documents/Codex/...` 안의 추출본)에서 작업하면 변경이 사라진 것처럼 보입니다. **정본은 이 GitHub 저장소 하나뿐**입니다. 다른 폴더에서 고치지 마세요.

기술 스택: Vite + React 18 / 배포: Vercel

---

## 🚀 처음 시작 (맥북·새 팀원 공통)

```bash
# 1) 클론
git clone https://github.com/donggeun6669-cyber/ReBridge.git
cd ReBridge/ReBridge_AI공모전용/Application_main_codes

# 2) 패키지 설치
npm install

# 3) 환경변수 파일 만들기 (.env 는 git에 안 올라가니 직접 만들어야 함)
cp .env.example .env
#   → .env 를 열어서 실제 API 키를 채워 넣으세요.
#   키는 보안상 git에 없으니, 팀 리더에게 따로 받아서 넣습니다.

# 4) 개발 서버 실행 → 브라우저에서 http://localhost:5173
npm run dev
```

---

## 🧑‍💻 매일 작업 흐름 (협업 규칙)

```bash
git pull            # 작업 시작 전 항상 최신 받기 (충돌 예방)
# ... 코드 수정 ...
git add -A
git commit -m "무엇을 바꿨는지"
git push            # 끝나면 바로 올리기 (안 올리면 다른 사람이 못 봄)
```

- **작업 전 `git pull`, 작업 후 `git push`** — 이 두 개만 지키면 "내 수정이 사라졌다" 사고가 안 납니다.
- 커밋 안 한 변경은 다른 기기/다음 작업에서 덮어쓰일 수 있어요. 작은 단위로 자주 커밋하세요.

---

## 📦 빌드 & 배포 (Vercel)

```bash
npm run build       # 로컬 빌드 확인 (dist/ 생성)
npm run deploy      # 프로덕션 배포 (= vercel --prod)
npm run verify      # 라이브가 실제로 새 빌드를 서빙하는지 확인 (캐시 우회)
```

- **공개 주소(고정):** https://rebridge-rho.vercel.app
- `rebridge-<해시>-...vercel.app` 같은 주소는 그 빌드에 박제되니 **북마크/공유 금지.** 위 고정 주소만 쓰세요.
- 처음 배포하는 사람은 `npx vercel login` 후 `npx vercel link` 로 `rebridge` 프로젝트에 연결해야 합니다.

### "배포했는데 화면이 안 바뀐다" 싶으면
1. 프로필 화면 맨 아래 `build MM-DD HH:mm` 시각을 보세요. 방금 배포한 시각이면 최신입니다.
2. 그래도 옛날로 보이면 **브라우저 캐시**입니다 → 시크릿창으로 열거나 주소 뒤에 `?v=1` 을 붙이세요.
3. `npm run verify` 로 라이브 상태를 1초 만에 확인할 수 있어요.

---

## 🔑 환경변수

| 키 | 용도 |
|---|---|
| `VITE_GEMINI_API_KEY` | Gemini API |
| `VITE_CAREERNET_API_KEY` | 커리어넷 API |

`.env` 는 `.gitignore` 에 있어 저장소에 올라가지 않습니다. 새 팀원은 `.env.example` 을 복사해 직접 채웁니다.
