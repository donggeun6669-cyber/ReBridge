// demoRole — 시연용 '선생님 모드' 전환 한 곳 (2026-09-26 PRD v2 시연판)
//   0619 영등포 꿈드림 인터뷰: "실무자용이랑 학생용이 완전히 다를 필요는 없다. 권한 차이만 있으면 된다."
//   → 같은 앱에서 스위치 하나로 선생님 화면을 보여준다. 켜면 두 가지가 바뀐다.
//     ① 쪽지: 학생이 보낸 쪽지를 받는 쪽지함 + 답장 (lib/messages.js)
//     ② 커뮤니티: 🧑‍🏫 꿈드림 선생님 배지로 댓글 → 질문 게시판에선 답변으로 맨 위에 모인다 (lib/community.js)
//   끄면 원래 학생 계정(닉네임·배지)으로 되돌린다.
//   ⚠️ 시연 전용. 실제 운영에서 선생님 권한은 센터 인증코드(verification_codes, 서버 RLS)로만 준다.
import { getDemoRole, setDemoRole } from './messages.js';
import { getCachedUser, applyVerifiedUser } from './auth.js';

const PREV_KEY = 'rb_demo_prev_user';
export const DEMO_STAFF_CENTER = '시연 센터';

export function isStaffDemo() {
  return getDemoRole() === 'staff';
}

export function setStaffDemo(on) {
  const me = getCachedUser();
  if (on) {
    try { localStorage.setItem(PREV_KEY, JSON.stringify(me || null)); } catch { /* noop */ }
    // 학생 계정과 섞이지 않게 선생님은 늘 같은 별도 id를 쓴다(내 글/남의 글 구분이 꼬이지 않게).
    applyVerifiedUser({
      id: 'mock-demo-staff',
      nickname: '꿈드림 선생님',
      verified: true,
      role: 'staff',
      verifiedCenter: DEMO_STAFF_CENTER,
      verifiedAt: new Date().toISOString(),
    });
    setDemoRole('staff');
    return;
  }
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(PREV_KEY)); } catch { prev = null; }
  // 선생님 모드 전에 로그인 안 했던 사람은 로그아웃 상태로 되돌린다.
  applyVerifiedUser(prev || null);
  try { localStorage.removeItem(PREV_KEY); } catch { /* noop */ }
  setDemoRole('student');
}
