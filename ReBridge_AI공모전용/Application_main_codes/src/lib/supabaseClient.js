// Supabase 클라이언트 — 키가 있으면 실제 백엔드, 없으면 null(목 폴백 신호).
// 키(VITE_SUPABASE_URL/ANON_KEY)가 비면 isSupabase=false 가 되어
// auth/community/youthVerify 가 자동으로 localStorage 목 백엔드로 동작한다.
import { createClient } from '@supabase/supabase-js';

// ⚙️ 커뮤니티 시연 모드 (2026-09-18 동근님: 커뮤니티를 v1에 넣음 — 킨텍스 산학연 EXPO 시연용).
//   true  → 키가 있어도 Supabase에 붙지 않고 이 기기(localStorage) 목 백엔드로만 동작한다.
//           시연용 예시 글·선생님/멘토 답변이 보이고, 쓴 글은 그 기기에만 남는다.
//   이유: 운영 Supabase는 익명 로그인이 꺼져 있어(2026-09-12 '하지 않는다') 가입·글쓰기가 안 되고,
//         새 게시판·배지(role)는 DB 스키마(supabase/schema.sql)도 아직 적용 전이다.
//   실제 운영으로 돌리려면: ① schema.sql의 2026-09-18 변경을 DB에 적용 ② 로그인 방식 결정 ③ 이 값을 false로.
//   Supabase를 쓰는 건 커뮤니티(auth·community·youthVerify)뿐이라 다른 기능에는 영향이 없다.
export const COMMUNITY_DEMO_MODE = true;

const env = import.meta.env || {};
const url = COMMUNITY_DEMO_MODE ? '' : env.VITE_SUPABASE_URL?.trim();
const anon = COMMUNITY_DEMO_MODE ? '' : env.VITE_SUPABASE_ANON_KEY?.trim();

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
