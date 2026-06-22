// auth — 닉네임 가입/세션. 실명 금지, 익명성 최우선.
//   · Supabase 모드: 익명 로그인(signInAnonymously) + profiles 에 닉네임 저장.
//     이메일/비번 없이 기기 세션을 유지한다(브라우저 재방문 시 같은 사용자).
//   · 목 모드: localStorage 에 사용자 1명 저장.
//
// user 객체(앱 전체 공통 형태 — youthVerify 도 이 형태를 쓴다):
//   { id, nickname, verified, verifiedCenter, verifiedAt, isStaff }
//
// 화면은 getCachedUser()(동기, 즉시 렌더)로 먼저 그리고,
// 마운트 시 refreshUser()(비동기)로 백엔드와 동기화 + subscribe()로 변경 구독.
import { supabase, isSupabase } from './supabaseClient.js';
import { mockStore } from './communityStore.js';

const listeners = new Set();
function emit(user) { listeners.forEach((cb) => { try { cb(user); } catch { /* noop */ } }); }

// 변경 구독. 반환: 해제 함수.
export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// 동기 캐시 — 마지막으로 알던 사용자(즉시 렌더용). 목/supabase 공통.
export function getCachedUser() {
  return mockStore.getUser();
}
export function isLoggedIn() {
  return Boolean(getCachedUser());
}

function cacheAndEmit(user) {
  if (user) mockStore.setUser(user); else mockStore.clearUser();
  emit(user);
  return user;
}

// ── supabase: 세션 → user 정규화 ────────────────────────────────────────────
// 네트워크/인증 오류는 throw 하지 않고 null 반환(상위에서 캐시 유지로 폴백).
async function fetchSupabaseUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;          // 세션 없음/만료/네트워크 오류
  const authUser = data.user;
  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('nickname, verified, verified_center, verified_at, is_staff')
    .eq('id', authUser.id)
    .maybeSingle();
  // 프로필 조회 자체가 실패(RLS/네트워크)하면 최소 사용자 정보만 반환.
  if (profErr || !prof) {
    return { id: authUser.id, nickname: '익명', verified: false, isStaff: false };
  }
  return {
    id: authUser.id,
    nickname: prof.nickname,
    verified: prof.verified,
    verifiedCenter: prof.verified_center,
    verifiedAt: prof.verified_at,
    isStaff: prof.is_staff,
  };
}

// ── 백엔드 → 캐시 동기화(앱/화면 마운트 시) ────────────────────────────────
export async function refreshUser() {
  if (!isSupabase) return cacheAndEmit(mockStore.getUser());
  try {
    const user = await fetchSupabaseUser();
    return cacheAndEmit(user);
  } catch {
    // 네트워크 단절 등 예기치 못한 오류 — 마지막으로 알던 사용자를 유지(로그아웃 처리 안 함).
    return getCachedUser();
  }
}

// ── 가입(= 닉네임 설정). 이미 세션 있으면 닉네임만 갱신. ─────────────────────
export async function signUp(nickname) {
  const nick = String(nickname || '').trim();
  if (nick.length < 1 || nick.length > 20) {
    return { ok: false, error: '닉네임은 1~20자로 입력해 주세요.' };
  }
  if (/[0-9]{6,}/.test(nick)) {
    return { ok: false, error: '실명·전화번호 같은 개인정보는 닉네임에 쓰지 마세요.' };
  }

  if (isSupabase) {
    try {
      const { data: cur, error: getErr } = await supabase.auth.getUser();
      if (getErr && getErr.name !== 'AuthSessionMissingError') {
        // 세션 '없음'은 정상(첫 가입). 그 외 오류(네트워크 등)만 실패 처리.
        return { ok: false, error: '연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.' };
      }
      let authUser = cur?.user || null;
      if (!authUser) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data?.user) {
          return { ok: false, error: '가입에 실패했어요. 잠시 후 다시 시도해 주세요.' };
        }
        authUser = data.user;
      }
      const { error: upErr } = await supabase
        .from('profiles')
        .upsert({ id: authUser.id, nickname: nick }, { onConflict: 'id' });
      if (upErr) return { ok: false, error: '닉네임 저장에 실패했어요. 잠시 후 다시 시도해 주세요.' };
      const user = await fetchSupabaseUser();
      return { ok: true, user: cacheAndEmit(user) };
    } catch {
      return { ok: false, error: '연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.' };
    }
  }

  // 목: 기존 사용자 있으면 닉네임만 교체, 없으면 새로 생성.
  const prev = mockStore.getUser();
  const user = prev
    ? { ...prev, nickname: nick }
    : { id: `mock-${Math.random().toString(36).slice(2, 10)}`, nickname: nick,
        verified: false, verifiedCenter: null, verifiedAt: null, isStaff: false };
  return { ok: true, user: cacheAndEmit(user) };
}

// ── 로그아웃 ────────────────────────────────────────────────────────────────
export async function signOut() {
  if (isSupabase) { try { await supabase.auth.signOut(); } catch { /* noop */ } }
  return cacheAndEmit(null);
}

// ── youthVerify.redeemCode() 성공 후, 갱신된 user를 캐시에 반영 ──────────────
export function applyVerifiedUser(user) {
  return cacheAndEmit(user);
}
