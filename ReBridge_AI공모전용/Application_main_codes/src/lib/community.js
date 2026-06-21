// community — 게시판 데이터 계층(게시글/댓글/공감 + P1: 검색·태그·센터보드·신고/차단·스크랩·무한스크롤·알림).
//   읽기는 로그인 없이 가능(익명 열람). 쓰기/공감/스크랩/신고/차단은 로그인 필요.
//
//   board(게시판):
//     'review'(꿈드림 후기) | 'talk'(이야기) | 'center'(우리 센터 — 인증 사용자 전용)
//   tag(주제 태그, talk 보드 안에서 분류): 'ged'(검정고시)·'career'(진로)·'free'(자유)·'worry'(고민)
//
// 반환 글 형태(정규화):
//   { id, board, tag, title, body, createdAt,
//     author: { id, nickname, verified, center },
//     likeCount, commentCount, likedByMe, mine, bookmarkedByMe }
import { supabase, isSupabase } from './supabaseClient.js';
import { mockStore, rid } from './communityStore.js';
import { getCachedUser } from './auth.js';

// 기본 게시판(누구나 보임). 'center'는 인증 사용자에게만 동적으로 덧붙인다(boardsFor 참고).
export const BOARDS = [
  { id: 'review', label: '꿈드림 후기' },
  { id: 'talk', label: '이야기' },
];

// 'talk' 보드 안에서 쓰는 주제 태그. (review/center 보드 글은 tag 없이 board로 분류)
export const TAGS = [
  { id: 'ged', label: '검정고시' },
  { id: 'career', label: '진로' },
  { id: 'free', label: '자유' },
  { id: 'worry', label: '고민' },
];

export const DEFAULT_PAGE_SIZE = 10;

// 신고 사유(글/댓글 공통).
export const REPORT_REASONS = [
  { id: 'spam', label: '광고·스팸' },
  { id: 'abuse', label: '욕설·비방' },
  { id: 'privacy', label: '개인정보 노출' },
  { id: 'adult', label: '음란·부적절' },
  { id: 'etc', label: '기타' },
];

// 현재 사용자가 볼 수 있는 보드 목록. 인증 사용자에겐 '우리 센터' 보드를 덧붙인다.
export function boardsFor(user) {
  const list = [...BOARDS];
  if (user?.verified) {
    const center = user.verifiedCenter ? ` (${user.verifiedCenter})` : '';
    list.push({ id: 'center', label: `우리 센터${center}`, centerOnly: true });
  }
  return list;
}

export function tagLabel(id) {
  return TAGS.find((t) => t.id === id)?.label || null;
}

// ── 차단/스크랩 캐시(목 동기 헬퍼) ────────────────────────────────────────────
function blockedIdSet(meId) {
  if (!meId) return new Set();
  return new Set(mockStore.getBlocks().filter((b) => b.blocker_id === meId).map((b) => b.blocked_id));
}
function bookmarkedIdSet(meId) {
  if (!meId) return new Set();
  return new Set(mockStore.getBookmarks().filter((b) => b.user_id === meId).map((b) => b.post_id));
}

// ── 목록 ────────────────────────────────────────────────────────────────
// opts: { board, tag, q(검색어), sort('latest'|'popular'), offset, limit, scope('board'|'all') }
// 반환: { items, hasMore, total }
export async function listPosts(opts = {}) {
  const {
    board = 'review', tag = null, q = '', sort = 'latest',
    offset = 0, limit = DEFAULT_PAGE_SIZE, scope = 'board',
  } = typeof opts === 'string' ? { board: opts } : opts;
  const me = getCachedUser();

  if (isSupabase) {
    let query = supabase
      .from('posts')
      .select('id, board, tag, title, body, created_at, author, ' +
        'profiles:author (nickname, verified, verified_center), ' +
        'reactions (user_id), comments (id)');
    if (scope !== 'all') {
      query = query.eq('board', board);
      if (board === 'center' && me?.verifiedCenter) {
        query = query.eq('center_id', me.verifiedCenter);
      }
      if (board === 'talk' && tag) query = query.eq('tag', tag);
    }
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      query = query.or(`title.ilike.${term},body.ilike.${term}`);
    }
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) return { items: [], hasMore: false, total: 0 };
    let items = (data || []).map((p) => normalize(p, me));
    items = applyClientFilters(items, me, sort);
    return { items, hasMore: (data || []).length === limit, total: items.length + offset };
  }

  // 목
  const reactions = mockStore.getReactions();
  const comments = mockStore.getComments();
  const blocked = blockedIdSet(me?.id);
  const bookmarks = bookmarkedIdSet(me?.id);
  const term = (q || '').trim().toLowerCase();

  let all = mockStore.getPosts()
    .filter((p) => {
      if (scope !== 'all') {
        if (p.board !== board) return false;
        if (board === 'center' && me?.verifiedCenter && p.author_center !== me.verifiedCenter) return false;
        if (board === 'talk' && tag && (p.tag || 'free') !== tag) return false;
      }
      if (term && !(`${p.title} ${p.body}`.toLowerCase().includes(term))) return false;
      if (blocked.has(p.author_id) && p.author_id !== me?.id) return false;
      return true;
    })
    .map((p) => normalizeMock(p, reactions, comments, me, bookmarks));

  all = sortItems(all, sort);
  const total = all.length;
  const items = all.slice(offset, offset + limit);
  return { items, hasMore: offset + limit < total, total };
}

function sortItems(items, sort) {
  if (sort === 'popular') {
    return [...items].sort((a, b) =>
      (b.likeCount + b.commentCount) - (a.likeCount + a.commentCount) || b.createdAt - a.createdAt);
  }
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}
// supabase 경로: 차단 숨김 + 정렬은 클라이언트에서(작은 데이터셋 기준).
function applyClientFilters(items, me, sort) {
  let out = items;
  if (me?.id) {
    const blocked = blockedIdSet(me.id);
    out = out.filter((p) => !blocked.has(p.author?.id) || p.author?.id === me.id);
  }
  return sortItems(out, sort);
}

// ── 단일 글 + 댓글 ──────────────────────────────────────────────────────────
export async function getPost(id) {
  const me = getCachedUser();
  if (isSupabase) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, board, tag, title, body, created_at, author, ' +
        'profiles:author (nickname, verified, verified_center), ' +
        'reactions (user_id), comments (id)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return normalize(data, me);
  }
  const p = mockStore.getPosts().find((x) => x.id === id);
  if (!p) return null;
  return normalizeMock(p, mockStore.getReactions(), mockStore.getComments(), me, bookmarkedIdSet(me?.id));
}

export async function listComments(postId) {
  const me = getCachedUser();
  if (isSupabase) {
    const { data, error } = await supabase
      .from('comments')
      .select('id, body, created_at, author, profiles:author (nickname, verified, verified_center)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) return [];
    const blocked = blockedIdSet(me?.id);
    return (data || [])
      .filter((c) => !blocked.has(c.author) || c.author === me?.id)
      .map((c) => ({
        id: c.id, body: c.body, createdAt: new Date(c.created_at).getTime(),
        author: { ...authorOf(c.profiles), id: c.author }, mine: me?.id === c.author,
      }));
  }
  const blocked = blockedIdSet(me?.id);
  return mockStore.getComments()
    .filter((c) => c.post_id === postId)
    .filter((c) => !blocked.has(c.author_id) || c.author_id === me?.id)
    .sort((a, b) => a.created_at - b.created_at)
    .map((c) => ({
      id: c.id, body: c.body, createdAt: c.created_at,
      author: { id: c.author_id, nickname: c.author_nickname, verified: c.author_verified, center: c.author_center },
      mine: me?.id === c.author_id,
    }));
}

// ── 작성(로그인 필요) ───────────────────────────────────────────────────────
export async function createPost({ board, tag, title, body }) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t) return { ok: false, error: '제목을 입력해 주세요.' };
  if (!b) return { ok: false, error: '내용을 입력해 주세요.' };
  if (board === 'center' && !me.verified) {
    return { ok: false, error: '우리 센터 보드는 인증된 사용자만 쓸 수 있어요.' };
  }
  const theTag = board === 'talk' ? (tag || 'free') : null;

  if (isSupabase) {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        board, tag: theTag, title: t, body: b, author: me.id,
        center_id: board === 'center' ? (me.verifiedCenter || null) : null,
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  }
  const posts = mockStore.getPosts();
  const id = rid('post');
  posts.push({
    id, board, tag: theTag, title: t, body: b, created_at: Date.now(),
    author_id: me.id, author_nickname: me.nickname,
    author_verified: !!me.verified, author_center: me.verifiedCenter || null,
  });
  mockStore.setPosts(posts);
  return { ok: true, id };
}

export async function addComment(postId, body) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };
  const b = String(body || '').trim();
  if (!b) return { ok: false, error: '댓글을 입력해 주세요.' };

  if (isSupabase) {
    const { error } = await supabase
      .from('comments')
      .insert({ post_id: postId, body: b, author: me.id });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const comments = mockStore.getComments();
  comments.push({
    id: rid('cmt'), post_id: postId, body: b, created_at: Date.now(),
    author_id: me.id, author_nickname: me.nickname,
    author_verified: !!me.verified, author_center: me.verifiedCenter || null,
  });
  mockStore.setComments(comments);
  return { ok: true };
}

// ── 공감 토글(로그인 필요). 반환: 토글 후 liked 여부 ──────────────────────────
export async function toggleReaction(postId) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };

  if (isSupabase) {
    const { data: existing } = await supabase
      .from('reactions').select('post_id')
      .eq('post_id', postId).eq('user_id', me.id).maybeSingle();
    if (existing) {
      await supabase.from('reactions').delete().eq('post_id', postId).eq('user_id', me.id);
      return { ok: true, liked: false };
    }
    const { error } = await supabase.from('reactions').insert({ post_id: postId, user_id: me.id });
    if (error) return { ok: false, error: error.message };
    return { ok: true, liked: true };
  }
  let reactions = mockStore.getReactions();
  const i = reactions.findIndex((r) => r.post_id === postId && r.user_id === me.id);
  let liked;
  if (i >= 0) { reactions.splice(i, 1); liked = false; }
  else { reactions.push({ post_id: postId, user_id: me.id }); liked = true; }
  mockStore.setReactions(reactions);
  return { ok: true, liked };
}

// ── 본인 글 삭제 ────────────────────────────────────────────────────────────
export async function deletePost(id) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };
  if (isSupabase) {
    const { error } = await supabase.from('posts').delete().eq('id', id).eq('author', me.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  mockStore.setPosts(mockStore.getPosts().filter((p) => !(p.id === id && p.author_id === me.id)));
  mockStore.setComments(mockStore.getComments().filter((c) => c.post_id !== id));
  mockStore.setReactions(mockStore.getReactions().filter((r) => r.post_id !== id));
  mockStore.setBookmarks(mockStore.getBookmarks().filter((b) => b.post_id !== id));
  return { ok: true };
}

// ── P1: 스크랩/저장(로그인 필요) ─────────────────────────────────────────────
export async function toggleBookmark(postId) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };
  if (isSupabase) {
    const { data: existing } = await supabase
      .from('bookmarks').select('post_id')
      .eq('post_id', postId).eq('user_id', me.id).maybeSingle();
    if (existing) {
      await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', me.id);
      return { ok: true, bookmarked: false };
    }
    const { error } = await supabase.from('bookmarks').insert({ post_id: postId, user_id: me.id });
    if (error) return { ok: false, error: error.message };
    return { ok: true, bookmarked: true };
  }
  let list = mockStore.getBookmarks();
  const i = list.findIndex((b) => b.post_id === postId && b.user_id === me.id);
  let bookmarked;
  if (i >= 0) { list.splice(i, 1); bookmarked = false; }
  else { list.push({ user_id: me.id, post_id: postId, created_at: Date.now() }); bookmarked = true; }
  mockStore.setBookmarks(list);
  return { ok: true, bookmarked };
}

// 내 스크랩 목록(최신 저장순). 반환: 정규화된 글 배열.
export async function listBookmarks() {
  const me = getCachedUser();
  if (!me) return [];
  if (isSupabase) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('post_id, created_at, posts:post_id (id, board, tag, title, body, created_at, author, ' +
        'profiles:author (nickname, verified, verified_center), reactions (user_id), comments (id))')
      .eq('user_id', me.id)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).filter((r) => r.posts).map((r) => normalize(r.posts, me));
  }
  const ids = mockStore.getBookmarks()
    .filter((b) => b.user_id === me.id)
    .sort((a, b) => b.created_at - a.created_at)
    .map((b) => b.post_id);
  const posts = mockStore.getPosts();
  const reactions = mockStore.getReactions();
  const comments = mockStore.getComments();
  const bm = bookmarkedIdSet(me.id);
  return ids
    .map((id) => posts.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => normalizeMock(p, reactions, comments, me, bm));
}

// ── P1: 신고(로그인 필요). target: 'post'|'comment' ──────────────────────────
export async function reportContent({ target, targetId, reason, detail = '' }) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };
  if (!reason) return { ok: false, error: '신고 사유를 선택해 주세요.' };
  if (isSupabase) {
    const { error } = await supabase.from('reports').insert({
      reporter: me.id, target_type: target, target_id: targetId, reason, detail: detail || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const list = mockStore.getReports();
  // 같은 대상 중복 신고 방지(같은 사용자).
  if (list.some((r) => r.reporter === me.id && r.target_type === target && r.target_id === targetId)) {
    return { ok: true, already: true };
  }
  list.push({
    id: rid('rpt'), reporter: me.id, target_type: target, target_id: targetId,
    reason, detail: detail || null, created_at: Date.now(),
  });
  mockStore.setReports(list);
  return { ok: true };
}

// ── P1: 사용자 차단(로그인 필요). 차단하면 그 사람 글/댓글이 목록에서 숨겨짐 ──────
export async function blockUser(targetUserId) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };
  if (!targetUserId || targetUserId === me.id) return { ok: false, error: '자기 자신은 차단할 수 없어요.' };
  if (isSupabase) {
    const { error } = await supabase.from('blocks')
      .insert({ blocker: me.id, blocked: targetUserId });
    if (error && !String(error.message).includes('duplicate')) return { ok: false, error: error.message };
    return { ok: true };
  }
  const list = mockStore.getBlocks();
  if (!list.some((b) => b.blocker_id === me.id && b.blocked_id === targetUserId)) {
    list.push({ blocker_id: me.id, blocked_id: targetUserId, created_at: Date.now() });
    mockStore.setBlocks(list);
  }
  return { ok: true };
}

export async function unblockUser(targetUserId) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };
  if (isSupabase) {
    await supabase.from('blocks').delete().eq('blocker', me.id).eq('blocked', targetUserId);
    return { ok: true };
  }
  mockStore.setBlocks(mockStore.getBlocks()
    .filter((b) => !(b.blocker_id === me.id && b.blocked_id === targetUserId)));
  return { ok: true };
}

export function isBlocked(targetUserId) {
  const me = getCachedUser();
  if (!me || !targetUserId) return false;
  return blockedIdSet(me.id).has(targetUserId);
}

// ── P1: 가벼운 알림 — 내 글에 새로 달린 댓글/공감 수(로컬 계산) ──────────────────
// 반환: { total, items: [{ postId, title, newComments, newLikes }] }
export async function getNotifications() {
  const me = getCachedUser();
  if (!me) return { total: 0, items: [] };
  const myPosts = mockStore.getPosts().filter((p) => p.author_id === me.id || p.author === me.id);
  if (myPosts.length === 0) return { total: 0, items: [] };
  const comments = mockStore.getComments();
  const reactions = mockStore.getReactions();
  const seen = mockStore.getSeen();
  let total = 0;
  const items = [];
  for (const p of myPosts) {
    const c = comments.filter((x) => x.post_id === p.id && x.author_id !== me.id).length;
    const r = reactions.filter((x) => x.post_id === p.id && x.user_id !== me.id).length;
    const prev = seen[p.id] || { c: 0, r: 0 };
    const newC = Math.max(0, c - prev.c);
    const newR = Math.max(0, r - prev.r);
    if (newC + newR > 0) {
      items.push({ postId: p.id, title: p.title, newComments: newC, newLikes: newR });
      total += newC + newR;
    }
  }
  return { total, items };
}

// 특정 글의 알림을 본 것으로 표시(상세 진입 시 호출 → 뱃지 사라짐).
export function markPostSeen(postId) {
  const me = getCachedUser();
  if (!me) return;
  const comments = mockStore.getComments();
  const reactions = mockStore.getReactions();
  const c = comments.filter((x) => x.post_id === postId && x.author_id !== me.id).length;
  const r = reactions.filter((x) => x.post_id === postId && x.user_id !== me.id).length;
  const seen = mockStore.getSeen();
  seen[postId] = { c, r };
  mockStore.setSeen(seen);
}

// ── 정규화 헬퍼 ─────────────────────────────────────────────────────────────
function authorOf(prof) {
  return {
    nickname: prof?.nickname || '익명',
    verified: !!prof?.verified,
    center: prof?.verified_center || null,
  };
}
function normalize(p, me) {
  const reactions = p.reactions || [];
  const bm = me ? bookmarkedIdSet(me.id) : new Set();
  return {
    id: p.id, board: p.board, tag: p.tag || null, title: p.title, body: p.body,
    createdAt: new Date(p.created_at).getTime(),
    author: { ...authorOf(p.profiles), id: p.author },
    likeCount: reactions.length,
    commentCount: (p.comments || []).length,
    likedByMe: me ? reactions.some((r) => r.user_id === me.id) : false,
    bookmarkedByMe: me ? bm.has(p.id) : false,
    mine: me?.id === p.author,
  };
}
function normalizeMock(p, reactions, comments, me, bookmarks) {
  const rs = reactions.filter((r) => r.post_id === p.id);
  return {
    id: p.id, board: p.board, tag: p.tag || null, title: p.title, body: p.body, createdAt: p.created_at,
    author: { id: p.author_id, nickname: p.author_nickname, verified: !!p.author_verified, center: p.author_center },
    likeCount: rs.length,
    commentCount: comments.filter((c) => c.post_id === p.id).length,
    likedByMe: me ? rs.some((r) => r.user_id === me.id) : false,
    bookmarkedByMe: me && bookmarks ? bookmarks.has(p.id) : false,
    mine: me?.id === p.author_id,
  };
}

// 상대 시간 표시(목/공통 유틸).
export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}
