// Supabase 클라이언트 — 키가 있으면 실제 백엔드, 없으면 null(목 폴백 신호).
// 키(VITE_SUPABASE_URL/ANON_KEY)가 비면 isSupabase=false 가 되어
// auth/community/youthVerify 가 자동으로 localStorage 목 백엔드로 동작한다.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabase = Boolean(url && anon);

// 익명 로그인 세션을 localStorage에 보관(브라우저 재방문 시 같은 닉네임 유지).
export const supabase = isSupabase
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export const BACKEND = isSupabase ? 'supabase' : 'mock';
