// community — 게시판 데이터 계층(게시글/댓글/공감).
//   읽기는 로그인 없이 가능(익명 열람). 쓰기/공감은 로그인 필요.
//   board: 'review'(꿈드림 후기) | 'talk'(공감·소통)
//
// 반환 글 형태(정규화):
//   { id, board, title, body, createdAt,
//     author: { nickname, verified, center },   // 작성자 익명 닉네임 + 인증여부
//     likeCount, commentCount, likedByMe, mine }
import { supabase, isSupabase } from './supabaseClient.js';
import { mockStore, rid } from './communityStore.js';
import { getCachedUser } from './auth.js';

export const BOARDS = [
  { id: 'review', label: '꿈드림 후기' },
  { id: 'talk', label: '공감·소통' },
];

// ── 목록 ────────────────────────────────────────────────────────────────
// sort: 'recent'(최신, 기본) | 'popular'(인기 = 공감수 내림차순, 동률이면 최신)
export async function listPosts(board = 'review', sort = 'recent') {
  const me = getCachedUser();
  if (isSupabase) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, board, title, body, created_at, author, ' +
        'profiles:author (nickname, verified, verified_center), ' +
        'reactions (user_id), comments (id)')
      .eq('board', board)
      .order('created_at', { ascending: false });
    if (error) return [];
    return sortPosts((data || []).map((p) => normalize(p, me)), sort);
  }
  // 목
  const posts = mockStore.getPosts().filter((p) => p.board === board);
  const reactions = mockStore.getReactions();
  const comments = mockStore.getComments();
  const list = posts.map((p) => normalizeMock(p, reactions, comments, me));
  return sortPosts(list, sort);
}

// 정규화된 글 목록을 정렬(최신/인기). 공통 사용.
function sortPosts(list, sort) {
  if (sort === 'popular') {
    return [...list].sort((a, b) => (b.likeCount - a.likeCount) || (b.createdAt - a.createdAt));
  }
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

// ── 단일 글 + 댓글 ──────────────────────────────────────────────────────────
export async function getPost(id) {
  const me = getCachedUser();
  if (isSupabase) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, board, title, body, created_at, author, ' +
        'profiles:author (nickname, verified, verified_center), ' +
        'reactions (user_id), comments (id)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return normalize(data, me);
  }
  const p = mockStore.getPosts().find((x) => x.id === id);
  if (!p) return null;
  return normalizeMock(p, mockStore.getReactions(), mockStore.getComments(), me);
}

// 댓글 목록 — 1단 답글(parent_id) 트리로 반환.
//   반환: [{ ...comment, replies: [ ...comment ] }]  (원댓글만 최상위, replies 는 시간순)
//   각 comment: { id, body, createdAt, author, mine, parentId, likeCount, likedByMe }
export async function listComments(postId) {
  const me = getCachedUser();
  let flat;
  if (isSupabase) {
    const { data, error } = await supabase
      .from('comments')
      .select('id, body, created_at, author, parent_id, ' +
        'profiles:author (nickname, verified, verified_center), comment_reactions (user_id)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) return [];
    flat = (data || []).map((c) => {
      const rs = c.comment_reactions || [];
      return {
        id: c.id, body: c.body, createdAt: new Date(c.created_at).getTime(),
        author: authorOf(c.profiles), mine: me?.id === c.author,
        parentId: c.parent_id || null,
        likeCount: rs.length,
        likedByMe: me ? rs.some((r) => r.user_id === me.id) : false,
      };
    });
  } else {
    const cr = mockStore.getCommentReactions();
    flat = mockStore.getComments()
      .filter((c) => c.post_id === postId)
      .sort((a, b) => a.created_at - b.created_at)
      .map((c) => {
        const rs = cr.filter((r) => r.comment_id === c.id);
        return {
          id: c.id, body: c.body, createdAt: c.created_at,
          author: { nickname: c.author_nickname, verified: c.author_verified, center: c.author_center },
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
export async function createPost({ board, title, body }) {
  const me = getCachedUser();
  if (!me) return { ok: false, error: '로그인이 필요해요.' };
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t) return { ok: false, error: '제목을 입력해 주세요.' };
  if (!b) return { ok: false, error: '내용을 입력해 주세요.' };

  if (isSupabase) {
    const { data, error } = await supabase
      .from('posts')
      .insert({ board, title: t, body: b, author: me.id })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  }
  const posts = mockStore.getPosts();
  const id = rid('post');
  posts.push({
    id, board, title: t, body: b, created_at: Date.now(),
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
    if (error) return { ok: false, error: error.message };
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
  const removedIds = mockStore.getComments().filter((c) => c.post_id === id).map((c) => c.id);
  mockStore.setComments(mockStore.getComments().filter((c) => c.post_id !== id));
  mockStore.setReactions(mockStore.getReactions().filter((r) => r.post_id !== id));
  mockStore.setCommentReactions(
    mockStore.getCommentReactions().filter((r) => !removedIds.includes(r.comment_id)));
  return { ok: true };
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
  return {
    id: p.id, board: p.board, title: p.title, body: p.body,
    createdAt: new Date(p.created_at).getTime(),
    author: authorOf(p.profiles),
    likeCount: reactions.length,
    commentCount: (p.comments || []).length,
    likedByMe: me ? reactions.some((r) => r.user_id === me.id) : false,
    mine: me?.id === p.author,
  };
}
function normalizeMock(p, reactions, comments, me) {
  const rs = reactions.filter((r) => r.post_id === p.id);
  return {
    id: p.id, board: p.board, title: p.title, body: p.body, createdAt: p.created_at,
    author: { nickname: p.author_nickname, verified: !!p.author_verified, center: p.author_center },
    likeCount: rs.length,
    commentCount: comments.filter((c) => c.post_id === p.id).length,
    likedByMe: me ? rs.some((r) => r.user_id === me.id) : false,
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
