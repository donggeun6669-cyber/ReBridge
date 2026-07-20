// localStorage 목(mock) 백엔드 저장소 — Supabase 키가 없을 때 쓰는 공유 데이터 계층.
// auth.js / community.js / youthVerify.js 가 함께 사용한다. 키 없이도 즉시 데모 가능.
//
// 시드: 인증 플로우 데모용으로 테스트 인증코드(DREAM-TEST, DREAM-DEMO)를 미리 넣어둔다.

const SEED_VERSION = 'v3'; // 버전 올리면 시드 강제 재적용

const KEYS = {
  user: 'rb_comm_user',
  codes: 'rb_comm_codes',
  posts: 'rb_comm_posts',
  comments: 'rb_comm_comments',
  reactions: 'rb_comm_reactions',
  commentReactions: 'rb_comm_comment_reactions',  // P0: 댓글 공감(♥)
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

// 시드 확인은 세션(모듈 수명)당 1회면 충분 — get* 호출마다 localStorage를 읽지 않도록 가드.
let seeded = false;
function ensureSeed() {
  if (seeded) return;
  const ver = localStorage.getItem('rb_seed_ver');
  if (ver !== SEED_VERSION) {
    write(KEYS.codes, SEED_CODES);
    write(KEYS.posts, SEED_POSTS);
    write(KEYS.comments, SEED_COMMENTS);
    localStorage.setItem('rb_seed_ver', SEED_VERSION);
  }
  seeded = true;
}

const NOW = Date.now();
const H = 1000 * 60 * 60;

const SEED_POSTS = [
  // ── 꿈드림 후기 (review board) ──
  {
    id: 'seed-r1', board: 'review', tag: null, rating: 5,
    title: '종로구 꿈드림센터 진짜 좋았어요 ⭐⭐⭐⭐⭐',
    body: '처음엔 어색할 것 같아서 망설였는데 선생님들이 너무 편하게 대해줘서 금방 적응했어요. 검정고시 대비 수업도 있고 개인 상담도 꼼꼼하게 해줘서 혼자 공부할 때보다 훨씬 집중이 됐어요. 센터 다니기 시작하고 3개월 만에 합격했습니다!',
    author_nickname: '초록별', author_verified: true, author_center: '종로구 꿈드림',
    created_at: NOW - H * 12,
  },
  {
    id: 'seed-r2', board: 'review', tag: null, rating: 4,
    title: '종로구 꿈드림 - 진로 상담이 생각보다 깊었어요',
    body: '단순히 "무슨 직업 가져라" 가 아니라 내가 뭘 좋아하는지부터 같이 찾아줬어요. 2회기 상담 후에 제가 원하는 방향이 좀 더 명확해진 느낌. 급식도 맛있어요 ㅋㅋ 다만 예약이 좀 밀리는 편이라 일찍 신청하는 걸 추천.',
    author_nickname: '새벽달', author_verified: true, author_center: '종로구 꿈드림',
    created_at: NOW - H * 38,
  },
  {
    id: 'seed-r3', board: 'review', tag: null, rating: 5,
    title: '꿈드림 처음 가본 후기 (종로구)',
    body: '혼자 검정고시 준비하다가 지쳐서 방문했어요. 들어가자마자 담당 선생님 배정해줘서 뭐가 필요한지 꼼꼼히 물어봐 주셨어요. 심리 검사도 무료로 받고 학습 계획도 같이 짰어요. 이런 곳이 있는 줄 몰랐던 게 아쉬울 정도예요.',
    author_nickname: '하람', author_verified: false, author_center: null,
    created_at: NOW - H * 72,
  },
  {
    id: 'seed-r4', board: 'review', tag: null, rating: 3,
    title: '시설은 좀 낡았지만 선생님들은 좋아요',
    body: '건물이 오래돼서 처음엔 실망했는데, 막상 다녀보니 프로그램 자체는 알차요. 검정고시 모의고사 자료도 많고 자유롭게 공부할 수 있는 공간도 있어요. 시설 개선이 된다면 별 5개 드리고 싶어요.',
    author_nickname: '구름', author_verified: false, author_center: null,
    created_at: NOW - H * 96,
  },

  // ── 이야기 (talk board) ──
  {
    id: 'seed-t1', board: 'talk', tag: 'ged',
    title: '검정고시 수학 어떻게들 잡으셨어요?',
    body: '독학으로 준비 중인데 수학이 제일 막막해요. 중학교 때 이미 수포자라서... 유튜브 보면서 기초부터 다시 잡고 있는데 너무 오래 걸려요. 효율 좋은 방법 있으면 공유해주세요.',
    author_nickname: '한걸음', author_verified: false, author_center: null,
    created_at: NOW - H * 9,
  },
  {
    id: 'seed-t2', board: 'talk', tag: 'ged',
    title: '4월 검정고시 합격했습니다!!',
    body: '6개월 준비해서 드디어 붙었어요. 꿈드림센터 주 3회 나가면서 수학·영어 집중 공략했어요. 처음엔 자신 없었는데 선생님이 기출문제 루틴 잡아주셔서 많이 도움됐어요. 준비 중인 분들 화이팅!!',
    author_nickname: '빛나', author_verified: true, author_center: 'demo',
    created_at: NOW - H * 5,
  },
  {
    id: 'seed-t3', board: 'talk', tag: 'career',
    title: '바리스타 자격증 따고 카페 취업했어요',
    body: '꿈드림에서 직업훈련 연계 받아서 바리스타 2급 취득했어요. 3개월 국비지원 과정이었는데 수강료 0원에 훈련수당도 나왔어요. 지금은 동네 카페에서 주 5일 일하고 있어요. 진로 고민이면 직업훈련 먼저 알아보는 거 추천해요.',
    author_nickname: '커피향', author_verified: true, author_center: 'demo',
    created_at: NOW - H * 20,
  },
  {
    id: 'seed-t4', board: 'talk', tag: 'career',
    title: '검정고시 끝나고 진로 고민 중이에요',
    body: '합격은 했는데 그 다음이 더 막막해요. 대학? 취업? 아직 뭘 좋아하는지도 잘 모르겠어요. 비슷한 고민 하셨던 분들 어떻게 결정하셨는지 이야기 듣고 싶어요.',
    author_nickname: '나침반', author_verified: false, author_center: null,
    created_at: NOW - H * 30,
  },
  {
    id: 'seed-t5', board: 'talk', tag: 'worry',
    title: '낮에 다들 뭐 하고 지내요?',
    body: '학교 안 다니니까 낮 시간이 너무 길게 느껴져요. 루틴을 만들고 싶은데 혼자서는 잘 안 되고... 다들 일상 어떻게 채우는지 궁금해요.',
    author_nickname: '리듬', author_verified: false, author_center: null,
    created_at: NOW - H * 3,
  },
  {
    id: 'seed-t6', board: 'talk', tag: 'worry',
    title: '가끔 너무 불안할 때',
    body: '남들 다 학교 다닐 때 나만 멈춰 있는 것 같아서 밤에 잠이 안 와요. 근데 요즘은 그게 오히려 내 속도대로 가는 거라고 생각하려고 해요. 다들 이런 마음 어떻게 다스리세요?',
    author_nickname: '새벽', author_verified: false, author_center: null,
    created_at: NOW - H * 2,
  },
];

const SEED_COMMENTS = [
  { id: 'seed-c1', post_id: 'seed-r1', parent_id: null, body: '저도 종로구 다니는데 진짜 공감이에요. 담당 선생님이 너무 잘 챙겨주심 ㅠㅠ', author_nickname: '하늘', author_verified: false, created_at: NOW - H * 10 },
  { id: 'seed-c2', post_id: 'seed-r1', parent_id: null, body: '합격 축하드려요! 저도 지금 준비 중인데 용기가 생기네요 ㅎㅎ', author_nickname: '준비생A', author_verified: false, created_at: NOW - H * 8 },
  { id: 'seed-c3', post_id: 'seed-r2', parent_id: null, body: '예약 밀린다는 거 진짜 맞아요. 2주 전엔 신청해야 해요', author_nickname: '선배', author_verified: true, created_at: NOW - H * 35 },
  { id: 'seed-c4', post_id: 'seed-t1', parent_id: null, body: '에듀윌 검정고시 기본서 추천해요. 수학이 단원별로 잘 정리돼 있어요. 모르는 부분은 유튜브 "검정고시 수학" 검색하면 무료 강의 많아요!', author_nickname: '수학완전정복', author_verified: false, created_at: NOW - H * 7 },
  { id: 'seed-c5', post_id: 'seed-t1', parent_id: null, body: '꿈드림 가면 학습 선생님이랑 같이 봐줘요. 저도 수포자였는데 3개월 만에 수학 60점 이상 나왔어요', author_nickname: '빛나', author_verified: true, created_at: NOW - H * 6 },
  { id: 'seed-c6', post_id: 'seed-t2', parent_id: null, body: '축하해요!!! 저도 다음 회차 목표예요. 어떤 기출 푸셨어요?', author_nickname: '한걸음', author_verified: false, created_at: NOW - H * 4 },
  { id: 'seed-c7', post_id: 'seed-t3', parent_id: null, body: '국비지원 과정 어디서 신청했어요? 저도 알아보고 싶어요!', author_nickname: '나침반', author_verified: false, created_at: NOW - H * 18 },
  { id: 'seed-c8', post_id: 'seed-t3', parent_id: null, body: 'HRD-Net 사이트에서 "바리스타" 검색하면 돼요. 꿈드림에서 연계도 해줘요!', author_nickname: '커피향', author_verified: true, created_at: NOW - H * 17 },
  { id: 'seed-c9', post_id: 'seed-t5', parent_id: null, body: '저는 오전에 꿈드림 가서 공부하고 오후에 운동하는 루틴 만들었어요. 뭔가 나가는 게 생기니까 훨씬 나아요', author_nickname: '초록별', author_verified: true, created_at: NOW - H * 2 },
  { id: 'seed-c10', post_id: 'seed-t6', parent_id: null, body: '저도 그런 불안함 알아요. 근데 이 앱에 있는 사람들 다 비슷한 처지인데 다들 자기 길 찾아가더라고요. 천천히 가도 괜찮아요 :)', author_nickname: '봄바람', author_verified: false, created_at: NOW - H * 1 },
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
  getComments() { ensureSeed(); return read(KEYS.comments, []); },
  setComments(list) { return write(KEYS.comments, list); },
  getReactions() { return read(KEYS.reactions, []); },
  setReactions(list) { return write(KEYS.reactions, list); },
  getCommentReactions() { return read(KEYS.commentReactions, []); },
  setCommentReactions(list) { return write(KEYS.commentReactions, list); },

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
