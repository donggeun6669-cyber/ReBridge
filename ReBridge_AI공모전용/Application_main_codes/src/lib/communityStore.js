// localStorage 목(mock) 백엔드 저장소 — Supabase 키가 없을 때 쓰는 공유 데이터 계층.
// auth.js / community.js / youthVerify.js 가 함께 사용한다. 키 없이도 즉시 데모 가능.
//
// 시드: 인증 플로우 데모용으로 테스트 인증코드(DREAM-TEST, DREAM-DEMO)를 미리 넣어둔다.

const KEYS = {
  user: 'rb_comm_user',         // 현재 로그인 사용자(세션)
  codes: 'rb_comm_codes',       // 발급된 인증코드 목록
  posts: 'rb_comm_posts',
  comments: 'rb_comm_comments',
  reactions: 'rb_comm_reactions',
  reports: 'rb_comm_reports',     // P1: 신고(글/댓글)
  blocks: 'rb_comm_blocks',       // P1: 사용자 차단
  bookmarks: 'rb_comm_bookmarks', // P1: 스크랩(저장)
  seen: 'rb_comm_seen',           // P1: 내 글에 대해 마지막으로 본 댓글/공감 수(알림 뱃지 계산)
};

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 시크릿창 등 무시 */ }
  return value;
}

// 미리 박아둔 데모 인증코드 — '꿈드림 인증 배지' 플로우를 키 없이 시연.
const SEED_CODES = [
  { code: 'DREAM-TEST', centerId: 'demo', issuedBy: '데모센터', used_by: null, used_at: null, created_at: 0 },
  { code: 'DREAM-DEMO', centerId: 'demo', issuedBy: '데모센터', used_by: null, used_at: null, created_at: 0 },
];

function ensureSeed() {
  if (localStorage.getItem(KEYS.codes) == null) write(KEYS.codes, SEED_CODES);
  if (localStorage.getItem(KEYS.posts) == null) write(KEYS.posts, SEED_POSTS);
}

// 가벼운 예시 글. 빈 게시판으로 시작하면 휑하므로 분위기만. (P1: board/tag 다양화)
const SEED_POSTS = [
  {
    id: 'seed-1', board: 'review', tag: 'review', title: '꿈드림 센터 처음 갔던 날',
    body: '검정고시 준비하면서 혼자 막막했는데, 센터에서 같은 처지 친구들 만나니까 마음이 좀 놓였어요. 망설이는 분 있으면 그냥 한번 가보길.',
    author_nickname: '봄바람', author_verified: true, author_center: 'demo',
    created_at: Date.now() - 1000 * 60 * 60 * 26,
  },
  {
    id: 'seed-2', board: 'talk', tag: 'free', title: '낮에 다들 뭐 하고 지내요?',
    body: '학교 안 다니니까 낮 시간이 너무 길게 느껴져요. 다들 루틴 어떻게 잡는지 궁금해요.',
    author_nickname: '리듬', author_verified: false, author_center: null,
    created_at: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: 'seed-3', board: 'talk', tag: 'ged', title: '검정고시 수학 어떻게들 잡으셨어요?',
    body: '독학으로 검정고시 준비 중인데 수학이 제일 막막해요. 인강이나 문제집 추천 받고 싶어요.',
    author_nickname: '한걸음', author_verified: false, author_center: null,
    created_at: Date.now() - 1000 * 60 * 60 * 9,
  },
  {
    id: 'seed-4', board: 'talk', tag: 'career', title: '검정고시 끝나고 진로 고민',
    body: '합격은 했는데 그 다음이 더 막막하네요. 대학? 취업? 비슷한 고민 하신 분들 이야기 듣고 싶어요.',
    author_nickname: '나침반', author_verified: true, author_center: 'demo',
    created_at: Date.now() - 1000 * 60 * 60 * 30,
  },
  {
    id: 'seed-5', board: 'talk', tag: 'worry', title: '가끔 너무 불안할 때',
    body: '남들 다 학교 다닐 때 나만 멈춰 있는 것 같아서 밤에 잠이 안 와요. 다들 이런 마음 어떻게 다스리세요?',
    author_nickname: '새벽', author_verified: false, author_center: null,
    created_at: Date.now() - 1000 * 60 * 60 * 2,
  },
];

export const mockStore = {
  // ── 세션 ──
  getUser() { return read(KEYS.user, null); },
  setUser(u) { return write(KEYS.user, u); },
  clearUser() { try { localStorage.removeItem(KEYS.user); } catch { /* noop */ } },

  // ── 인증코드 ──
  getCodes() { ensureSeed(); return read(KEYS.codes, []); },
  setCodes(list) { return write(KEYS.codes, list); },

  // ── 게시글/댓글/공감 ──
  getPosts() { ensureSeed(); return read(KEYS.posts, []); },
  setPosts(list) { return write(KEYS.posts, list); },
  getComments() { return read(KEYS.comments, []); },
  setComments(list) { return write(KEYS.comments, list); },
  getReactions() { return read(KEYS.reactions, []); },
  setReactions(list) { return write(KEYS.reactions, list); },

  // ── P1: 신고/차단/스크랩/알림 ──
  getReports() { return read(KEYS.reports, []); },
  setReports(list) { return write(KEYS.reports, list); },
  getBlocks() { return read(KEYS.blocks, []); },         // [{ blocker_id, blocked_id, created_at }]
  setBlocks(list) { return write(KEYS.blocks, list); },
  getBookmarks() { return read(KEYS.bookmarks, []); },   // [{ user_id, post_id, created_at }]
  setBookmarks(list) { return write(KEYS.bookmarks, list); },
  getSeen() { return read(KEYS.seen, {}); },             // { [postId]: { c: 본댓글수, r: 본공감수 } }
  setSeen(map) { return write(KEYS.seen, map); },
};

// 간단한 랜덤 id(목 전용). crypto 있으면 사용.
export function rid(prefix = 'm') {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
