// SyCommunity — 서연 UI '커뮤니티 목록' 시안.
//   기능은 src/lib/community.js(글 목록·공감)·auth.js(닉네임 로그인)를 그대로 쓴다.
// props: goTo(screen, params), canGoBack, params
import { useState, useEffect, useCallback, useRef } from 'react';
import { Heart } from 'lucide-react';
import {
  boardsFor, TAGS, TAG_BOARDS, tagLabel, boardLabel, listPosts, toggleReaction,
  timeAgo, DEFAULT_PAGE_SIZE, DEFAULT_BOARD,
} from '../lib/community.js';
import { getBadge } from '../lib/youthVerify.js';
import { useAuthUser, NicknameGate } from '../components/AuthScreen.jsx';
import SyTop from './SyTop.jsx';
import { sortUiToApi } from './eUtil.js';
import './sy-e.css';

function CardAuthor({ author }) {
  const badge = getBadge(author);
  return (
    <span className="sy-e-author">
      <span className="sy-e-author-name">{author?.nickname || '익명'}</span>
      {badge && <span className="sy-e-badge">{badge.short || badge.label}</span>}
    </span>
  );
}

export default function SyCommunity({ goTo = () => {}, params = {} }) {
  const user = useAuthUser();
  const boards = boardsFor(user);

  const [board, setBoard] = useState(params.board || DEFAULT_BOARD);
  const [tag, setTag] = useState(null);
  const [sortUi, setSortUi] = useState('all'); // '전체'(all) | '최신'(latest) | '인기'(popular) — 시안의 3탭

  const [posts, setPosts] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const [gate, setGate] = useState(null); // 미로그인 첫 행동 대기 { type, id }
  const [toast, setToast] = useState('');

  const flashToast = (m) => { setToast(m); setTimeout(() => setToast(''), 1800); };

  const reload = useCallback(async () => {
    setPosts(null);
    offsetRef.current = 0;
    const res = await listPosts({
      board, tag: TAG_BOARDS.has(board) ? tag : null, sort: sortUiToApi(sortUi),
      offset: 0, limit: DEFAULT_PAGE_SIZE, scope: 'board',
    });
    setPosts(res.items);
    setHasMore(res.hasMore);
    offsetRef.current = res.items.length;
  }, [board, tag, sortUi]);

  useEffect(() => { reload(); }, [reload, user?.id]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    const res = await listPosts({
      board, tag: TAG_BOARDS.has(board) ? tag : null, sort: sortUiToApi(sortUi),
      offset: offsetRef.current, limit: DEFAULT_PAGE_SIZE, scope: 'board',
    });
    setPosts((prev) => [...(prev || []), ...res.items]);
    setHasMore(res.hasMore);
    offsetRef.current += res.items.length;
  }, [hasMore, board, tag, sortUi]);

  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // HOT은 모음 게시판이라 글을 직접 쓸 수 없다 → 자유 게시판으로 쓴다(기존 로직 그대로).
  const goWrite = useCallback(() => {
    goTo('community-write', { board: board === 'hot' ? 'free' : board, tag });
  }, [board, tag, goTo]);

  const onWrite = useCallback(() => {
    if (!user) { setGate({ type: 'write' }); return; }
    goWrite();
  }, [user, goWrite]);

  const onOpenPost = useCallback((id) => {
    goTo('community-post', { id });
  }, [goTo]);

  const onLike = useCallback(async (e, id) => {
    e.stopPropagation();
    if (!user) { setGate({ type: 'like', id }); return; }
    const res = await toggleReaction(id);
    if (res.ok) {
      setPosts((list) => list && list.map((p) => p.id === id
        ? { ...p, likedByMe: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) }
        : p));
    }
  }, [user]);

  const onGateDone = useCallback(async () => {
    const pending = gate;
    setGate(null);
    if (pending?.type === 'write') { goWrite(); return; }
    if (pending?.type === 'like') {
      const res = await toggleReaction(pending.id);
      if (res.ok) {
        setPosts((list) => list && list.map((p) => p.id === pending.id
          ? { ...p, likedByMe: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) }
          : p));
      }
    }
  }, [gate, goWrite]);

  const showTags = TAG_BOARDS.has(board);

  return (
    <div className="sy-screen sy-e-community">
      <SyTop title="커뮤니티" action="글쓰기" onAction={onWrite} />

      <div className="sy-e-boards">
        {boards.map((b) => (
          <button key={b.id} type="button"
            className={`sy-e-board-chip${board === b.id ? ' sel' : ''}`}
            onClick={() => { setBoard(b.id); setTag(null); }}>
            {b.label.replace('🔥 ', '')}
          </button>
        ))}
      </div>

      <div className="sy-e-sort">
        <button type="button" className={`sy-e-sort-btn${sortUi === 'all' ? ' sel' : ''}`}
          onClick={() => setSortUi('all')}>전체</button>
        <button type="button" className={`sy-e-sort-btn${sortUi === 'latest' ? ' sel' : ''}`}
          onClick={() => setSortUi('latest')}>최신</button>
        <button type="button" className={`sy-e-sort-btn${sortUi === 'popular' ? ' sel' : ''}`}
          onClick={() => setSortUi('popular')}>인기</button>
        <span className="sy-e-sort-dash" aria-hidden="true" />
      </div>

      {showTags && (
        <div className="sy-e-tags">
          <button type="button" className={`sy-e-tag-chip${tag === null ? ' sel' : ''}`}
            onClick={() => setTag(null)}>전체</button>
          {TAGS.map((t) => (
            <button key={t.id} type="button" className={`sy-e-tag-chip${tag === t.id ? ' sel' : ''}`}
              onClick={() => setTag(t.id)}>{t.label}</button>
          ))}
        </div>
      )}

      <div className="sy-e-list">
        {posts === null ? (
          <p className="sy-e-empty">불러오는 중…</p>
        ) : posts.length === 0 ? (
          board === 'center' && !user?.verified ? (
            <p className="sy-e-locked">우리 센터 보드는 꿈드림 인증 후 이용할 수 있어요.</p>
          ) : (
            <p className="sy-e-empty">{user ? '아직 글이 없어요. 첫 글을 남겨보세요.' : '아직 글이 없어요. 로그인하고 첫 글을 남겨보세요.'}</p>
          )
        ) : (
          <>
            {posts.map((p) => (
              <div key={p.id} className="sy-e-card" role="button" tabIndex={0}
                onClick={() => onOpenPost(p.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpenPost(p.id); }}>
                <div className="sy-e-card-top">
                  <span>
                    {board === 'hot' && <span className="sy-e-pill">{boardLabel(p.board)}</span>}
                    {p.tag && tagLabel(p.tag) && <span className="sy-e-pill">{tagLabel(p.tag)}</span>}
                  </span>
                  {p.board === 'qna' && p.answered && <span className="sy-e-pill-answer">✓ 답변 완료</span>}
                </div>
                <h3 className="sy-e-card-title">{p.title}</h3>
                <p className="sy-e-card-body">{p.body}</p>
                <div className="sy-e-card-foot">
                  <CardAuthor author={p.author} />
                  <span className="sy-e-stats">
                    <button type="button" className={`sy-e-stat-like${p.likedByMe ? ' liked' : ''}`}
                      onClick={(e) => onLike(e, p.id)}>
                      <Heart size={14} fill={p.likedByMe ? 'currentColor' : 'none'} /> {p.likeCount}
                    </button>
                    <span>댓글 {p.commentCount}</span>
                  </span>
                </div>
              </div>
            ))}
            <div ref={sentinelRef} style={{ height: 1 }} />
          </>
        )}
      </div>

      {toast && <div className="sy-e-toast">{toast}</div>}
      <NicknameGate open={!!gate} onClose={() => setGate(null)} onDone={onGateDone} />
    </div>
  );
}
