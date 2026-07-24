// community — 게시판 데이터 계층(게시글/댓글/공감).
//   P0: 대댓글(1단 답글)·댓글 공감(♥)·인기/최신 정렬·인라인 닉네임 게이트.
//   P1: 검색·태그·센터보드·신고/차단·스크랩·무한스크롤·알림.
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

// ── 고정 공지 내용(상단 핀 카드) ───────────────────────────────────────────
// 백엔드 없이 공지 텍스트만 안내. 활동 등급은 아직 자동계산 안 되므로 정직하게 "곧 제공".
// 데모 코드 안내는 목(mock) 백엔드일 때만 노출한다 — 실백엔드(Supabase)에선 데모 코드가 없다.
export const PINNED_NOTICE = {
  badge: '📌 고정 공지',
  title: '학교밖 인증 배지 받는 법 · 활동 등급 안내',
  sections: [
    {
      icon: '🎖️',
      heading: '학교밖청소년 인증 배지 받는 법',
      lines: [
        '꿈드림 센터에서 받은 인증코드를 [로그인 / 내 정보]의 ‘인증코드 입력’ 칸에 넣으면, 닉네임 옆에 🎖️ 인증 배지가 붙어요.',
        ...(isSupabase ? [] : ['아직 코드가 없어도 괜찮아요. 지금은 데모 코드 DREAM-TEST 로 배지를 체험해 볼 수 있어요.']),
      ],
    },
    {
      icon: '🌱',
      heading: '활동 등급 안내',
      lines: [
        '등급은 자랑이 아니라, 서로 믿고 편하게 이야기 나누기 위한 작은 표식이에요.',
        '미인증(닉네임만) → 🎖️ 인증(센터 인증 완료) → 활동 등급(새싹 → 이웃 → 단골)으로 이어져요.',
        '활동 등급은 글·댓글·공감 같은 참여로 천천히 올라가요. 자동 계산은 곧 제공할 예정이라, 지금은 인증 여부까지만 배지로 보여 드려요.',
      ],
    },
  ],
};

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
//   sort 는 'recent' 도 'latest' 동의어로 받는다(P0 호환).
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
    const bm = bookmarkedIdSet(me?.id);
    let items = (data || []).map((p) => normalize(p, me, bm));
    items = applyClientFilters(items, me, sort);
    return { items, hasMore: (data || []).length === limit, total: items.length + offset };
  }

  // 목
  const idx = mockIndexes(mockStore.getReactions(), mockStore.getComments(), me);
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
    .map((p) => normalizeMock(p, idx, me, bookmarks));

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
    return normalize(data, me, bookmarkedIdSet(me?.id));
  }
  const p = mockStore.getPosts().find((x) => x.id === id);
  if (!p) return null;
  const idx = mockIndexes(mockStore.getReactions(), mockStore.getComments(), me);
  return normalizeMock(p, idx, me, bookmarkedIdSet(me?.id));
}

// 댓글 목록 — 1단 답글(parent_id) 트리로 반환.
//   반환: [{ ...comment, replies: [ ...comment ] }]  (원댓글만 최상위, replies 는 시간순)
//   각 comment: { id, body, createdAt, author, mine, parentId, likeCount, likedByMe }
//   차단한 사용자의 댓글은 숨김(P1).
export async function listComments(postId) {
  const me = getCachedUser();
  const blocked = blockedIdSet(me?.id);
  let flat;
  if (isSupabase) {
    const { data, error } = await supabase
      .from('comments')
      .select('id, body, created_at, author, parent_id, ' +
        'profiles:author (nickname, verified, verified_center), comment_reactions (user_id)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) return [];
    flat = (data || [])
      .filter((c) => !blocked.has(c.author) || c.author === me?.id)
      .map((c) => {
        const rs = c.comment_reactions || [];
        return {
          id: c.id, body: c.body, createdAt: new Date(c.created_at).getTime(),
          author: { ...authorOf(c.profiles), id: c.author }, mine: me?.id === c.author,
          parentId: c.parent_id || null,
          likeCount: rs.length,
          likedByMe: me ? rs.some((r) => r.user_id === me.id) : false,
        };
      });
  } else {
    const cr = mockStore.getCommentReactions();
    flat = mockStore.getComments()
      .filter((c) => c.post_id === postId)
      .filter((c) => !blocked.has(c.author_id) || c.author_id === me?.id)
      .sort((a, b) => a.created_at - b.created_at)
      .map((c) => {
        const rs = cr.filter((r) => r.comment_id === c.id);
        return {
          id: c.id, body: c.body, createdAt: c.created_at,
          author: { id: c.author_id, nickname: c.author_nickname, verified: c.author_verified, center: c.author_center },
          mine: me?.id === c.author_id,
          parentId: c.parent_id || null,
          likeCount: rs.length,
          likedByMe: me ? rs.some((r) => r.user_id === me.id) : false,
        };
      });
  }
  return nestComments(flat);
}

// 평면 목록 → 1단 트리. 부모가 없는(또는 부모를 못 찾는) 댓글은 최상위로.
function nestComments(flat) {
  const byId = new Map(flat.map((c) => [c.id, { ...c, replies: [] }]));
  const roots = [];
  for (const c of byId.values()) {
    const parent = c.parentId ? byId.get(c.parentId) : null;
    if (parent && parent.id !== c.id) parent.replies.push(c);
    else roots.push(c);
  }
  // 원댓글은 시간순(이미 정렬됨), 답글도 시간순 유지.
  return roots;
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
    if (error || !data) return { ok: false, error: '글을 올리지 못했어요. 잠시 후 다시 시도해 주세요.' };
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

// parentId 가 있으면 1단 답글로 작성(중첩 답글의 답글은 같은 부모로 묶음).
export async function addComment(postId, body, parentId = null) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };
  const b = String(body || '').trim();
  if (!b) return { ok: false, error: '댓글을 입력해 주세요.' };

  if (isSupabase) {
    const { error } = await supabase
      .from('comments')
      .insert({ post_id: postId, body: b, author: me.id, parent_id: parentId || null });
    if (error) return { ok: false, error: '댓글을 올리지 못했어요. 잠시 후 다시 시도해 주세요.' };
    return { ok: true };
  }
  const comments = mockStore.getComments();
  comments.push({
    id: rid('cmt'), post_id: postId, body: b, created_at: Date.now(),
    parent_id: parentId || null,
    author_id: me.id, author_nickname: me.nickname,
    author_verified: !!me.verified, author_center: me.verifiedCenter || null,
  });
  mockStore.setComments(comments);
  return { ok: true };
}

// ── 댓글 공감(♥) 토글(로그인 필요). 반환: 토글 후 liked 여부 ─────────────────
export async function toggleCommentReaction(commentId) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };

  if (isSupabase) {
    const { data: existing } = await supabase
      .from('comment_reactions').select('comment_id')
      .eq('comment_id', commentId).eq('user_id', me.id).maybeSingle();
    if (existing) {
      await supabase.from('comment_reactions').delete()
        .eq('comment_id', commentId).eq('user_id', me.id);
      return { ok: true, liked: false };
    }
    const { error } = await supabase.from('comment_reactions')
      .insert({ comment_id: commentId, user_id: me.id });
    if (error) return { ok: false, error: error.message };
    return { ok: true, liked: true };
  }
  let cr = mockStore.getCommentReactions();
  const i = cr.findIndex((r) => r.comment_id === commentId && r.user_id === me.id);
  let liked;
  if (i >= 0) { cr.splice(i, 1); liked = false; }
  else { cr.push({ comment_id: commentId, user_id: me.id }); liked = true; }
  mockStore.setCommentReactions(cr);
  return { ok: true, liked };
}

// ── 공감 토글(로그인 필요). 반환: 토글 후 liked 여부 ──────────────────────────
export async function toggleReaction(postId) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };

  if (isSupabase) {
    const { data: existing, error: selErr } = await supabase
      .from('reactions').select('post_id')
      .eq('post_id', postId).eq('user_id', me.id).maybeSingle();
    if (selErr) return { ok: false, error: '잠시 후 다시 시도해 주세요.' };
    if (existing) {
      const { error: delErr } = await supabase
        .from('reactions').delete().eq('post_id', postId).eq('user_id', me.id);
      if (delErr) return { ok: false, error: '잠시 후 다시 시도해 주세요.' };
      return { ok: true, liked: false };
    }
    const { error } = await supabase.from('reactions').insert({ post_id: postId, user_id: me.id });
    if (error) return { ok: false, error: '잠시 후 다시 시도해 주세요.' };
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
    if (error) return { ok: false, error: '글을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' };
    return { ok: true };
  }
  mockStore.setPosts(mockStore.getPosts().filter((p) => !(p.id === id && p.author_id === me.id)));
  const removedIds = mockStore.getComments().filter((c) => c.post_id === id).map((c) => c.id);
  mockStore.setComments(mockStore.getComments().filter((c) => c.post_id !== id));
  mockStore.setReactions(mockStore.getReactions().filter((r) => r.post_id !== id));
  mockStore.setCommentReactions(
    mockStore.getCommentReactions().filter((r) => !removedIds.includes(r.comment_id)));
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
    const bm = bookmarkedIdSet(me.id);
    return (data || []).filter((r) => r.posts).map((r) => normalize(r.posts, me, bm));
  }
  const ids = mockStore.getBookmarks()
    .filter((b) => b.user_id === me.id)
    .sort((a, b) => b.created_at - a.created_at)
    .map((b) => b.post_id);
  const posts = mockStore.getPosts();
  const idx = mockIndexes(mockStore.getReactions(), mockStore.getComments(), me);
  const bm = bookmarkedIdSet(me.id);
  return ids
    .map((id) => posts.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => normalizeMock(p, idx, me, bm));
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

// ── P1: 가벼운 알림 — 내 글에 새로 달린 댓글/공감 수(로컬 계산) ──────────────────
// 반환: { total, items: [{ postId, title, newComments, newLikes }] }
export async function getNotifications() {
  const me = getCachedUser();
  if (!me) return { total: 0, items: [] };
  const myPosts = mockStore.getPosts().filter((p) => p.author_id === me.id);
  if (myPosts.length === 0) return { total: 0, items: [] };
  // 글마다 전체 배열을 다시 훑지 않도록 post_id별 카운트를 한 번만 만든다.
  const cCount = new Map();
  for (const x of mockStore.getComments()) {
    if (x.author_id !== me.id) cCount.set(x.post_id, (cCount.get(x.post_id) || 0) + 1);
  }
  const rCount = new Map();
  for (const x of mockStore.getReactions()) {
    if (x.user_id !== me.id) rCount.set(x.post_id, (rCount.get(x.post_id) || 0) + 1);
  }
  const seen = mockStore.getSeen();
  let total = 0;
  const items = [];
  for (const p of myPosts) {
    const c = cCount.get(p.id) || 0;
    const r = rCount.get(p.id) || 0;
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
function normalize(p, me, bm = new Set()) {
  const reactions = p.reactions || [];
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
// 목 데이터 정규화 — 글마다 전체 배열을 스캔하지 않도록 post_id별 인덱스를 먼저 만든다.
function mockIndexes(reactions, comments, me) {
  const likeCount = new Map();
  const likedByMe = new Set();
  for (const r of reactions) {
    likeCount.set(r.post_id, (likeCount.get(r.post_id) || 0) + 1);
    if (me && r.user_id === me.id) likedByMe.add(r.post_id);
  }
  const commentCount = new Map();
  for (const c of comments) {
    commentCount.set(c.post_id, (commentCount.get(c.post_id) || 0) + 1);
  }
  return { likeCount, commentCount, likedByMe };
}
function normalizeMock(p, idx, me, bookmarks) {
  return {
    id: p.id, board: p.board, tag: p.tag || null, title: p.title, body: p.body, createdAt: p.created_at,
    rating: p.rating ?? null,
    author: { id: p.author_id, nickname: p.author_nickname, verified: !!p.author_verified, center: p.author_center },
    likeCount: idx.likeCount.get(p.id) || 0,
    commentCount: idx.commentCount.get(p.id) || 0,
    likedByMe: idx.likedByMe.has(p.id),
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
