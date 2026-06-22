# 커뮤니티 통합 가이드 (feat/community)

이 브랜치는 **App.jsx / persona.js / BottomNav.jsx 를 건드리지 않았습니다.**
아래 변경만 적용하면 커뮤니티가 한 번에 붙습니다. 모든 화면은 `goTo / goBack` props로만
동작하므로 라우팅 한 줄씩이면 됩니다.

---

## 1. App.jsx — import / 라우팅 추가

### (a) import 추가 (상단 import 블록)
```jsx
import CommunityScreen from './components/CommunityScreen.jsx';
import CommunityPostScreen from './components/CommunityPostScreen.jsx';
import CommunityWriteScreen from './components/CommunityWriteScreen.jsx';
import AuthScreen from './components/AuthScreen.jsx';
```

### (b) 화면 키 등록
- `TAB_ROOTS` 배열에 `'community'` 추가 (탭 누르면 스택 리셋).
- `KNOWN_SCREENS` 배열에 `'community', 'community-post', 'community-write', 'community-auth'` 추가
  (안 하면 "준비 중" placeholder가 뜸).

### (c) 렌더 블록 추가 (다른 `{!splash && screen === ...}` 줄들 사이)
```jsx
{!splash && screen === 'community'       && <CommunityScreen goTo={goTo} goBack={goBack} />}
{!splash && screen === 'community-post'  && <CommunityPostScreen goTo={goTo} goBack={goBack} id={params.id} />}
{!splash && screen === 'community-write' && <CommunityWriteScreen goTo={goTo} goBack={goBack} board={params.board} />}
{!splash && screen === 'community-auth'  && <AuthScreen goBack={goBack} />}
```
> `community-auth`는 로그인/인증코드 화면입니다. 글쓰기·공감 시 미로그인이면
> 컴포넌트가 알아서 `goTo('community-auth')`로 보냈다가 돌아옵니다.

---

## 2. BottomNav.jsx — 아이콘 1개 추가

`ICONS` 맵에 커뮤니티 탭 아이콘을 등록(현재 맵에 없음):
```jsx
import { /* ...기존... */, Users } from 'lucide-react';
const ICONS = { /* ...기존... */, Users };
```

---

## 3. persona.js — "커뮤니티" 탭 + 활성탭 매핑

커뮤니티는 **모든 persona 공통**으로 노출하는 게 자연스럽습니다(학교밖 누구나 이용).

### (a) 탭 추가 — `studentNav()`의 각 `tabs` 배열에서 `mypage` 앞에 끼워넣기
공통 객체로 정의해두고 재사용하면 깔끔합니다:
```js
const communityTab = { id: 'community', label: '커뮤니티', icon: 'Users', screen: 'community' };
```
예) tested+university 반환부:
```js
return { tabs: [TAB.exploreHome, TAB.univExplore, TAB.roadmap, communityTab, TAB.mypage], landing: 'home' };
```
(다른 분기들도 동일하게 `communityTab`을 `TAB.mypage` 앞에 추가)

> 4탭 유지가 더 좋으면, 특정 persona에서는 `roadmap` 대신 넣는 식으로 조절하세요.
> 탭을 안 늘리고 싶다면, 홈 화면 카드에서 `goTo('community')` 한 줄로 진입시켜도 됩니다.

### (b) 활성 탭 매핑 — `activeTabId()`에 한 줄
```js
if (['community', 'community-post', 'community-write', 'community-auth'].includes(screen)) return 'community';
```

---

## 4. 실무자(B 브랜치) 화면 ↔ youthVerify.issueCode 연결

인증 모듈 `src/lib/youthVerify.js`는 **인증코드의 단일 소스**입니다.
B의 실무자 화면(예: `StaffCaseScreen.jsx`)에서 아래처럼 호출하면 됩니다:

```jsx
import { issueCode, listIssuedCodes } from '../lib/youthVerify.js';

// 코드 발급(버튼 onClick 등)
const res = await issueCode({ centerId: 'kkumdrim-gangnam', issuedBy: staffUser.nickname });
if (res.ok) showToStaff(res.code);   // 예: "DREAM-AB12" → 학생에게 전달

// 발급 내역 표시
const issued = await listIssuedCodes('kkumdrim-gangnam'); // [{ code, used, usedAt, ... }]
```

학생은 커뮤니티 로그인 화면(`community-auth`)의 **'인증코드 입력'** 칸에 이 코드를 넣어
`redeemCode()`로 인증되고, 글·댓글에 🎖️ 배지가 붙습니다.

### Supabase 사용 시 권한 (목 모드는 제약 없음)
`verification_codes` insert는 RLS상 **`profiles.is_staff = true`** 인 사용자만 가능합니다.
B의 role 시스템(`lib/roles.js`)에서 실무자 가입 시 해당 사용자의 `profiles.is_staff`를
`true`로 세팅해 주세요. (목 모드에서는 누구나 발급 가능 — 데모용.)

---

## 5. 백엔드 키 (선택)

- **키 없이 즉시 동작**: `.env`에 `VITE_SUPABASE_*`가 없으면 localStorage 목 백엔드로
  자동 폴백. 데모 인증코드 **`DREAM-TEST` / `DREAM-DEMO`**가 미리 들어 있어 인증 플로우까지 시연 가능.
- **실 백엔드**: `supabase/schema.sql`을 Supabase SQL Editor에 실행 → Authentication에서
  'Anonymous sign-ins' 켜기 → `.env`에 URL/anon 키 입력. (자세한 절차는 schema.sql 상단 주석)

---

## 6. 데모 확인(App.jsx 안 건드리고)

임시로 보고 싶으면 `src/index.jsx`에서 `App` 대신 커뮤니티 컴포넌트를 직접 렌더해
`npm run dev`로 확인 후 되돌리면 됩니다(커밋엔 포함하지 마세요). 예:
```jsx
// import App from './App.jsx';
import App from './components/CommunityScreen.jsx'; // 임시 미리보기
```

## 파일 목록 (이 브랜치에서 추가/소유)
- `src/lib/supabaseClient.js` — Supabase 클라이언트 / 목 폴백 스위치
- `src/lib/communityStore.js` — 목 백엔드 localStorage 저장소(+시드 코드/예시글)
- `src/lib/auth.js` — 닉네임 가입/세션(익명)
- `src/lib/youthVerify.js` — 꿈드림 인증코드 발급/검증/배지 (**단일 소스**)
- `src/lib/community.js` — 게시글/댓글/공감 데이터 계층
- `src/components/CommunityScreen.jsx` — 게시판(후기/공감·소통 탭)
- `src/components/CommunityPostScreen.jsx` — 글+댓글
- `src/components/CommunityWriteScreen.jsx` — 작성
- `src/components/AuthScreen.jsx` — 닉네임 로그인 + 인증코드 입력 (`useAuthUser` 훅 export)
- `src/components/CommunityBadge.jsx` — 🎖️ 인증 배지 / 작성자 줄
- `src/styles.community.css`
- `supabase/schema.sql` — 테이블 + RLS + redeem_code RPC
- `.env.example` — Supabase 키 항목 추가
