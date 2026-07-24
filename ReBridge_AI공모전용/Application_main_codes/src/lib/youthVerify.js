// ============================================================================
// youthVerify — 학교밖청소년 '꿈드림 인증 배지'의 단일 소스(single source).
//   이 파일이 인증코드 발급/검증/배지 표시의 유일한 공개 모듈이다.
//   다른 모듈(auth/community)이나 화면은 반드시 아래 공개 API만 사용한다.
// ----------------------------------------------------------------------------
// 공개 API (★ 에이전트 B의 실무자 화면은 issueCode() 를 호출한다)
//
//   issueCode({ centerId, issuedBy }) : Promise<{ ok, code?, error? }>
//       └ 실무자가 학생에게 줄 인증코드를 1개 발급해 백엔드(또는 목)에 저장한다.
//         코드는 사람이 부르기 쉬운 형태: "<센터접두>-XXXX" (혼동문자 0/O/1/I 제외).
//         반환된 code 를 학생에게 전달 → 학생이 redeemCode 로 인증.
//
//   redeemCode(code, user) : Promise<{ ok, user?, error? }>
//       └ 코드 검증 후 현재 로그인 사용자에게 인증을 부여한다.
//         성공 시 갱신된 user(verified/center/at 포함)를 돌려준다.
//         user 인자는 목 모드에서 갱신 대상; supabase 모드는 세션(auth.uid) 기준.
//
//   isVerified(user) : boolean              인증 배지 보유 여부
//   getBadge(user)   : { emoji, label } | null   배지 표시용(미인증은 null)
//
// 백엔드 2중화: VITE_SUPABASE_URL 있으면 Supabase, 없으면 localStorage 목.
//   - 목 모드엔 데모용 코드 DREAM-TEST / DREAM-DEMO 가 미리 들어있다.
// ============================================================================
import { supabase, isSupabase } from './supabaseClient.js';
import { mockStore } from './communityStore.js';

const BADGE = { emoji: '🎖️', label: '학교밖 인증' };

// 사람이 부르기 쉬운 코드 생성: 센터접두 + 혼동없는 6자리.
// (4자리는 조합이 32⁴≈100만뿐이라 대입 공격에 약함 — 6자리 32⁶≈10억 + RPC 레이트리밋으로 방어)
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0,O,1,I 제외
function randSuffix(n = 6) {
  let s = '';
  for (let i = 0; i < n; i++) {
    let idx;
    try {
      idx = crypto.getRandomValues(new Uint32Array(1))[0] % SAFE_CHARS.length;
    } catch {
      idx = Math.floor(Math.random() * SAFE_CHARS.length);
    }
    s += SAFE_CHARS[idx];
  }
  return s;
}
function makeCode(centerId) {
  const prefix = String(centerId || 'DREAM')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'DREAM';
  return `${prefix}-${randSuffix()}`;
}

// ── 발급 ────────────────────────────────────────────────────────────────
export async function issueCode({ centerId, issuedBy } = {}) {
  const code = makeCode(centerId);
  if (isSupabase) {
    const { error } = await supabase
      .from('verification_codes')
      .insert({ code, center_id: centerId || 'unknown', issued_by: issuedBy || null });
    // 실무자(is_staff)가 아니면 RLS가 막는다 — 친절한 안내로 변환.
    if (error) return { ok: false, error: '코드 발급 권한이 없거나 연결에 문제가 있어요.' };
    return { ok: true, code };
  }
  // 목: 발급 목록에 추가
  const list = mockStore.getCodes();
  list.push({ code, centerId: centerId || 'unknown', issuedBy: issuedBy || null,
    used_by: null, used_at: null, created_at: Date.now() });
  mockStore.setCodes(list);
  return { ok: true, code };
}

// ── 사용(redeem) ──────────────────────────────────────────────────────────
export async function redeemCode(code, user) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return { ok: false, error: '코드를 입력해 주세요.' };

  if (isSupabase) {
    const { data, error } = await supabase.rpc('redeem_code', { p_code: clean });
    if (error) return { ok: false, error: '코드가 올바르지 않거나 이미 사용됐어요.' };
    // RPC는 실패를 예외 대신 { ok:false, reason }으로 돌려준다(레이트리밋 기록 보존용).
    if (!data?.ok) {
      return {
        ok: false,
        error: data?.reason === 'rate_limited'
          ? '시도가 너무 많아요. 1시간 뒤에 다시 해 주세요.'
          : '코드가 올바르지 않거나 이미 사용됐어요.',
      };
    }
    const next = { ...(user || {}), verified: true,
      verifiedCenter: data?.center || null, verifiedAt: new Date().toISOString() };
    return { ok: true, user: next };
  }

  // 목: 발급 목록에서 미사용 코드 검증 → 사용 처리 + user 갱신
  const list = mockStore.getCodes();
  const row = list.find((c) => c.code === clean);
  if (!row) return { ok: false, error: '존재하지 않는 코드예요.' };
  if (row.used_by) return { ok: false, error: '이미 사용된 코드예요.' };
  row.used_by = user?.id || 'mock-user';
  row.used_at = Date.now();
  mockStore.setCodes(list);
  const next = { ...(user || {}), verified: true,
    verifiedCenter: row.centerId, verifiedAt: new Date().toISOString() };
  return { ok: true, user: next };
}

// ── 조회 헬퍼 ──────────────────────────────────────────────────────────────
export function isVerified(user) {
  return Boolean(user && user.verified);
}

export function getBadge(user) {
  return isVerified(user) ? { ...BADGE } : null;
}
