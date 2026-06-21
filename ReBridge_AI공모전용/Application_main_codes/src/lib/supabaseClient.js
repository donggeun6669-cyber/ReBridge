// Supabase 클라이언트 — 키가 있으면 실제 백엔드, 없으면 null(목 폴백 신호).
// 키(VITE_SUPABASE_URL/ANON_KEY)가 비면 isSupabase=false 가 되어
// auth/community/youthVerify 가 자동으로 localStorage 목 백엔드로 동작한다.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// URL 형식까지 가볍게 검증 — 오타(https:// 누락 등)로 createClient 가 던져
// 앱 전체가 죽는 일을 막고, 잘못된 값이면 조용히 목으로 폴백한다.
function looksLikeUrl(v) {
  if (!v) return false;
  try { new URL(v); return /^https?:\/\//.test(v); } catch { return false; }
}

const hasCreds = looksLikeUrl(url) && Boolean(anon);

// createClient 자체가 던지면(예기치 못한 환경) 목으로 폴백.
let client = null;
if (hasCreds) {
  try {
    // 익명 로그인 세션을 localStorage에 보관(브라우저 재방문 시 같은 닉네임 유지).
    client = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[supabase] 클라이언트 생성 실패 — 목 백엔드로 폴백합니다.', e);
    client = null;
  }
}

export const supabase = client;
export const isSupabase = Boolean(client);
export const BACKEND = isSupabase ? 'supabase' : 'mock';
