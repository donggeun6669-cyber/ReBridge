# 검고담임(ReBridge) 인수인계 — 맥북에서 이어 작업하기

> 학교 밖 청소년을 위한 통합 앱(검정고시·대입·직업·커뮤니티·지원).
> 이 문서 하나로 맥북에서 환경 세팅 → 실행 → 이어 작업까지 가능하게 정리했습니다.

---

## 0. 한눈에 현재 상태

- 앱은 **통합 IA(토스식)**로 재설계됨: 하단 고정 4탭 **홈 · 지원 · 커뮤니티 · MY**.
- **홈 = 내 상태**: 트랙 미정이면 예시로 유도, 정해지면(학습/대입/직업) 그 트랙의 로드맵 + 상단 서브탭.
- 신규 유저는 **온보딩(검고/취업 선택) 없이 바로 홈**으로 진입.
- **커뮤니티**(에브리타임 방향): 익명 닉네임, 🎖️꿈드림 인증 배지, 대댓글·공감·정렬·검색·게시판/태그/센터보드·신고/차단·스크랩·무한스크롤·알림 + 고정 공지.
- **지원 탭**: 꿈드림 센터 혜택 카테고리·지역별 탐색.
- 백엔드: **Supabase + localStorage mock 자동 폴백**(키 없으면 mock으로 동작).
- 배포: Vercel → `gumgomentor.vercel.app` (origin/main 푸시 시 자동 빌드).

---

## 1. 저장소 / 경로

- GitHub: `https://github.com/donggeun6669-cyber/ReBridge` (기본 브랜치 `main`)
- **앱 코드 루트**: `ReBridge_AI공모전용/Application_main_codes/`
- 발표/문서: `ReBridge_AI공모전용/` (발표대본_10분.md, 소개영상/ 등)
- 이 인수인계 폴더: `ReBridge_AI공모전용/인수인계/`

---

## 2. 맥북 환경 세팅 & 실행

```bash
# 1) 클론
git clone https://github.com/donggeun6669-cyber/ReBridge.git
cd ReBridge/ReBridge_AI공모전용/Application_main_codes

# 2) 의존성 (Node 18+ 권장)
npm install

# 3) 개발 서버 (HMR)
npm run dev            # http://localhost:5173

# 4) 프로덕션 빌드 / 미리보기
npm run build
npm run preview

# 5) 배포 (Vercel 연결돼 있음)
npm run deploy         # = vercel --prod
```

- 스택: **Vite 6 + React 18**, 아이콘 `lucide-react`, 지도 `leaflet`. 라우터 라이브러리 없음(App.jsx 커스텀 스택).
- 환경변수: `.env`(예시는 `.env.example`). Supabase 키 없으면 자동으로 mock 백엔드 사용.

---

## 3. 아키텍처 (핵심 파일)

| 파일 | 역할 |
|---|---|
| `src/App.jsx` | 화면 라우팅(커스텀 스택), 스플래시→홈, 하단 탭 표시 |
| `src/lib/persona.js` | 프로필(localStorage), `getNav()`(고정 4탭), `getActiveTrack/setActiveTrack`, `activeTabId` |
| `src/lib/tracks.js` | 트랙 정의(학습/대입/직업)와 각 트랙의 **상단 서브탭** |
| `src/components/TrackShell.jsx` | 트랙 확정 시: 트랙 헤더 + 서브탭 + 기존 화면을 본문으로 렌더(SCREEN_COMP 매핑) |
| `src/components/HomeScreen.jsx` | 홈 = 상태기반(미정: 예시 / 확정: TrackShell) |
| `src/components/BottomNav.jsx` | 하단 고정 4탭(홈·지원·커뮤니티·MY) |

**IA 모델**: 하단 4탭은 항상 고정(횡단: 지원·커뮤니티·MY). 학습/대입/직업은 **홈 안의 트랙**으로, 각 트랙은 상단 서브탭(예: 대입 = 로드맵/대학찾기/내 점수)을 가짐. 트랙 전환은 홈 상단 "바꾸기".

**트랙별 서브탭 → 재사용 화면**(TrackShell.jsx의 `SCREEN_COMP`):
- 학습: 로드맵(study-roadmap)·플래너(study-planner)·대학(univ-explore) *(과목가이드 제거 진행 중)*
- 대입: 로드맵(roadmap)·대학찾기(univ-explore)·내 점수(results)
- 직업: 로드맵(job-roadmap)·직업탐색(job-explore)·심리검사(job-psych)

---

## 4. 영역별 메모

- **홈**: `HomeScreen` — `getActiveTrack()`가 null이면 예시(검정고시/대학/일·진로) 카드로 부드럽게 트랙 선택, 정해지면 `TrackShell`.
- **학습 트랙**: 플래너(오늘 할 일·타이머), 로드맵(합격까지 % — 점수 연동), 대학 탭(간단 대학탐색·목표점수). *플래너 단순화(회고/추천/달력 제거, 줄글 할일)·대학 탭 신설 작업 반영됨.*
- **대입 트랙**: 검정고시 점수→대학 매칭·칸수 게이지(`lib/scoreEngine.js`, `data/admissions.json`·`cutlines_2025.json` 등).
- **직업 트랙**: 토스식 + 유치원생 수준 평어. 내일배움카드 등 제도는 "쉽게 말하면" 병기 + 학교밖 자격은 `needsCheck` 자물쇠로 정직 표기(`data/jobData.js`).
- **지원 탭**: `SupportScreen` + `data/kkumdrim.json`(222 센터)·`data/benefitCategories.js`·`lib/benefits.js`. 혜택 데이터는 대부분 비어 있음 → 팀원이 채우면 자동 노출, 없으면 자물쇠+문의 폴백.
- **커뮤니티**: `components/Community*.jsx`, `lib/community.js`(데이터 계층), `lib/auth.js`(익명 닉네임), `lib/youthVerify.js`(인증코드 redeem/issue), `lib/communityStore.js`(mock), `supabase/schema.sql`(테이블·RLS). 고정 공지(인증·등급 안내) 포함.

---

## 5. 백엔드(Supabase) — 진짜 커뮤니티로 만들려면

현재 **mock(기기 로컬)** 으로 동작 → 기기 간 글 공유 안 됨. 실제 다중 사용자 커뮤니티는 키 필요.

1. `Application_main_codes/SUPABASE_SETUP.md` 참고.
2. Supabase 프로젝트 생성 → SQL Editor에 `supabase/schema.sql` 실행.
3. Authentication에서 **Anonymous sign-in 켜기**(필수).
4. `.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 입력(Vercel은 env 등록 후 재배포).
5. 데모 인증코드: `DREAM-TEST`, `DREAM-DEMO` (mock 모드 기준).

---

## 6. 남은 일 / TODO

- [ ] **Supabase 실연결**(키 입력) — 커뮤니티 다기기 공유.
- [ ] 커뮤니티 **이미지 첨부**(Supabase Storage 필요 — 보류 중).
- [ ] **활동 등급 자동 계산**(현재 공지는 안내 위주, 인증여부 기반 표시까지).
- [ ] 지원 탭 **혜택 데이터 채우기**(꿈드림 센터별 — 팀원 영역, 개별 문의 기반).
- [ ] 꿈드림 **실제 역할/인증코드 발급 운영**(센터 측) 연동.
- [ ] 트랙 임베드 화면의 자체 헤더와 트랙 헤더 **중복 정리**(미세 UI).

---

## 7. 함정 / 주의 (멀티에이전트로 만들며 배운 것)

- **에이전트 worktree는 `origin/main`(마지막 푸시본) 기준으로 갈라진다.** 로컬에만 있고 안 푼 커밋은 새 worktree에 없다 → 병렬 작업 전 **로컬 main을 푸시**해 베이스를 맞출 것.
- 프리뷰 dev 서버가 가끔 **stale 번들**을 물어 옛 화면을 보일 수 있음 → 의심되면 서버 재시작 / 프로덕션 빌드(`npm run preview`)로 확인. **배포는 소스에서 빌드되므로 영향 없음.**
- 빌드 시 "chunk 2MB 초과" 경고는 leaflet 등 때문이며 **기존 사항/무해**.
- `position: fixed`는 부모 `.screen`의 애니메이션(transform) 때문에 뷰포트가 아닌 `.screen` 기준이 됨 → 떠다니는 버튼은 **`position: sticky`** 권장.

---

## 8. Git 워크플로우

- 기본 브랜치 `main`. 작업 후 `git push origin main` → Vercel 자동 배포.
- 큰 작업은 브랜치/별도 worktree 권장(병렬 시 파일 소유권 분리해 충돌 방지).
- 커밋 메시지 컨벤션: `feat(area): ...`, `fix(ui): ...`, `merge(area): ...`.

---

_이 문서 기준 시점: 통합 IA + 커뮤니티 P0/P1 + 지원/학습/직업 트랙 개편까지 반영. 최신 커밋 로그(`git log --oneline`)로 세부 확인._
