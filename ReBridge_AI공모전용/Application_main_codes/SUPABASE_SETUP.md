# Supabase 커뮤니티 백엔드 연결 가이드

검고담임(ReBridge) 앱의 커뮤니티(게시판·공감·댓글·꿈드림 인증 배지)는
**Supabase** 백엔드와 **localStorage 목(mock)** 백엔드 두 가지로 동작합니다.

- `.env` 에 Supabase 키가 **없으면** → 자동으로 목 백엔드(브라우저 localStorage)로 동작.
  키 없이도 데모/심사가 그대로 됩니다(데모 인증코드 `DREAM-TEST`, `DREAM-DEMO` 포함).
- `.env` 에 키가 **있으면** → 진짜 Supabase에 저장(여러 사람이 같은 글을 공유).

이 문서는 **키를 넣어 실제 Supabase로 전환**하는 절차입니다. 약 10분.

---

## 0. 준비물

- 인터넷 브라우저, 이메일 1개(Supabase 가입용 / 또는 GitHub 로그인)
- 이 저장소(앱 코드). 작업 폴더: `ReBridge_AI공모전용/Application_main_codes`

---

## 1. Supabase 프로젝트 만들기 (무료)

1. https://supabase.com 접속 → **Start your project** → 가입/로그인.
2. **New project** 클릭.
   - **Name**: 아무거나 (예: `rebridge-community`)
   - **Database Password**: 강한 비밀번호 입력 후 **어딘가 안전하게 메모**
     (앱에선 안 쓰지만 DB 직접 접속 시 필요).
   - **Region**: `Northeast Asia (Seoul)` 권장.
   - **Plan**: Free.
3. **Create new project** → 1~2분 기다리면 준비 완료.

---

## 2. 스키마(테이블 + 보안규칙) 설치

1. 좌측 메뉴에서 **SQL Editor** 클릭 → **New query**.
2. 이 저장소의 **`supabase/schema.sql`** 파일 **전체 내용을 복사**해서 편집창에 붙여넣기.
3. 오른쪽 아래 **Run**(또는 Ctrl/Cmd + Enter) 클릭.
4. `Success. No rows returned` 비슷한 메시지가 나오면 성공.

> 무엇이 만들어지나: `profiles`(닉네임·인증배지), `verification_codes`(인증코드),
> `posts`/`comments`/`reactions`(게시판) 5개 테이블 + 모든 쓰기를 "본인 것만"으로
> 막는 RLS 규칙 + 인증코드를 안전하게 사용하는 `redeem_code` 함수.
> **여러 번 실행해도 안전**합니다(`if not exists` / `or replace` 로 작성됨).

### 확인 (선택)
- 좌측 **Table Editor** 에서 `profiles`, `posts`, `comments`, `reactions`,
  `verification_codes` 5개 테이블이 보이면 OK.

---

## 3. 익명 로그인(Anonymous sign-in) 켜기  ★ 필수

이 앱은 **이메일 없이 "익명 로그인 + 닉네임"** 으로 가입합니다(익명성 최우선).
이 스위치를 안 켜면 글쓰기/공감/인증이 동작하지 않습니다.

1. 좌측 **Authentication** → **Sign In / Providers** (버전에 따라 **Providers**).
2. 목록에서 **Anonymous Sign-ins**(익명 로그인) 항목을 찾아 **ON(활성화)**.
3. **Save**.

> 최신 UI에서는 **Authentication → Settings → "Allow anonymous sign-ins"** 토글일 수
> 있습니다. 위치는 버전마다 조금 다르지만 이름은 항상 *Anonymous*.

---

## 4. URL / anon 키 복사해서 `.env` 에 넣기

1. 좌측 **Project Settings**(톱니) → **API**.
2. 두 값을 복사:
   - **Project URL** — 예: `https://abcdefgh.supabase.co`
   - **Project API keys** 의 **`anon` `public`** 키 — 길고 `eyJ...` 로 시작.
     > `service_role` 키는 **절대 쓰지 마세요**(서버 전용·전권). 앱엔 `anon` 만.
3. 앱 폴더(`Application_main_codes`)에 **`.env`** 파일을 만들고 아래처럼 입력:

   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...(복사한 anon 키 전체)
   ```

   - `.env.example` 을 복사해서 `.env` 로 두고 값만 채워도 됩니다.
   - `=` 뒤에 따옴표/공백 없이 값만. 줄바꿈 금지(키는 한 줄).
   - `.env` 는 `.gitignore` 에 있어 깃에 안 올라갑니다(정상).

> **anon 키는 공개돼도 안전**합니다. `schema.sql` 의 RLS가 모든 쓰기를
> "로그인한 본인 것만" 으로 막기 때문입니다. (단, `service_role` 키는 절대 노출 금지.)

### Vercel(배포본)에 넣을 때
로컬 `.env` 가 아니라 **Vercel → 프로젝트 → Settings → Environment Variables** 에
같은 이름(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)으로 등록한 뒤 **재배포**.
`VITE_` 접두어 변수는 빌드 시 번들에 포함되므로 빌드를 다시 돌려야 반영됩니다.

---

## 5. 연결됐는지 확인

1. 앱 폴더에서:
   ```
   npm install      (처음 1회)
   npm run dev
   ```
2. 브라우저 콘솔(F12)에서 백엔드 모드 확인 방법(둘 중 편한 것):
   - 커뮤니티 화면에서 **닉네임으로 가입 → 글쓰기** 해보고,
     **새 시크릿창에서 같은 앱을 열었을 때 그 글이 보이면** Supabase 연결 성공
     (목 모드라면 localStorage라 시크릿창엔 안 보임).
   - 또는 Supabase **Table Editor → posts** 에 방금 쓴 글의 행이 생기면 성공.
3. 글쓰기 후 **Supabase Authentication → Users** 에 익명 사용자 1명이 생기고,
   **Table Editor → profiles** 에 닉네임 행이 생기면 정상.

### 인증 배지(꿈드림) 테스트
- 실무자 화면에서 코드 발급(`issueCode`) → `verification_codes` 에 행 추가.
  (발급은 `is_staff = true` 인 프로필만 가능. 아래 참고.)
- 학생이 그 코드를 입력(redeem) → 본인 `profiles.verified` 가 `true` 로 바뀌고 배지 표시.

#### 실무자(staff) 권한 부여 방법
인증코드를 **발급**하려면 해당 사용자의 프로필에 `is_staff = true` 가 필요합니다(보안상
앱에서 스스로 못 켭니다). 운영자가 Supabase에서 직접 켜 줍니다:
1. 실무자가 앱에서 한 번 가입(닉네임 등록) → `profiles` 에 행 생성.
2. **Table Editor → profiles** 에서 그 행의 `is_staff` 를 `true` 로 수정 → Save.
   (또는 SQL Editor에서 `update profiles set is_staff = true where nickname = '실무자닉네임';`)

---

## 6. 다시 목(mock) 모드로 되돌리려면

`.env` 의 두 값을 **비우거나** `.env` 파일을 지우고 앱을 재시작하면 자동으로
localStorage 목 백엔드로 돌아갑니다. (코드 수정 불필요.)

---

## 자주 막히는 곳

| 증상 | 원인 / 해결 |
|---|---|
| 글쓰기 눌러도 "가입에 실패" | 3단계 **익명 로그인**이 꺼져 있음 → 켜고 저장. |
| 여전히 목 모드(시크릿창에 글 안 보임) | `.env` 값 오타/공백, 또는 dev 서버 **재시작** 안 함. `URL`은 `https://` 로 시작해야 함(아니면 앱이 조용히 목으로 폴백). |
| Vercel 배포본만 목 모드 | Vercel 환경변수 등록 후 **재배포** 안 함(`VITE_`는 빌드 시 주입). |
| "코드 발급 권한이 없거나..." | 발급하려는 사용자가 `is_staff = true` 가 아님(5단계 참고). |
| 인증코드 redeem 시 실패 | 코드가 이미 사용됐거나, 학생이 **닉네임 가입(프로필 생성)** 을 아직 안 함. |

---

## 참고: 자동 폴백 동작(코드 레벨)

- `src/lib/supabaseClient.js` — `VITE_SUPABASE_URL`/`ANON_KEY` 가 둘 다 있고 URL이
  `https?://` 형식이면 실제 클라이언트 생성, 아니면 `supabase=null`(목 신호).
  클라이언트 생성이 실패해도 앱이 죽지 않고 목으로 폴백합니다.
- `src/lib/auth.js`, `src/lib/community.js`, `src/lib/youthVerify.js` — 모두
  `isSupabase` 플래그로 갈라지며, 실 연결 시 네트워크/RLS 오류는 사용자에게
  친절한 한국어 메시지로 변환됩니다(영문 DB 오류 그대로 노출하지 않음).
