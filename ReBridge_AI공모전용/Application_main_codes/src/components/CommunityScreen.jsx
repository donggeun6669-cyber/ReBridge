// CommunityScreen — 게시판(에브리타임급). P1:
//   · 검색(현재 보드/전체), 보드 탭 + 인증자 '우리 센터' 보드, 이야기 주제 태그 칩
//   · 최신/인기 정렬, 무한 스크롤, 스크랩(저장) + 내 스크랩 뷰, 신고/차단(액션 시트)
//   · 가벼운 알림 뱃지(내 글 새 댓글/공감)
//   모두 화면 내 상태/뷰로 처리(새 라우트 없음).
// props: goTo(screen, params), goBack()
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PenSquare, Heart, MessageCircle, Users, LogIn, Search, X,
  Bookmark, MoreHorizontal, Bell, ChevronLeft, SlidersHorizontal,
} from 'lucide-react';
import {
  boardsFor, TAGS, tagLabel, listPosts, listBookmarks, toggleReaction, toggleBookmark,
  getNotifications, markPostSeen, timeAgo, DEFAULT_PAGE_SIZE,
} from '../lib/community.js';
import { AuthorLine } from './CommunityBadge.jsx';
import CommunityActionSheet from './CommunityActionSheet.jsx';
import { useAuthUser } from './AuthScreen.jsx';
import '../styles.community.css';

export default function CommunityScreen({ goTo = () => {}, goBack = () => {} }) {
  const user = useAuthUser();
  const boards = boardsFor(user);

  const [view, setView] = useState('list');      // 'list' | 'saved' | 'noti'
  const [board, setBoard] = useState('review');
  const [tag, setTag] = useState(null);          // 이야기 보드 주제 필터
  const [sort, setSort] = useState('latest');    // 'latest' | 'popular'
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [scopeAll, setScopeAll] = useState(false);

  const [posts, setPosts] = useState(null);      // null = 로딩
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  const [saved, setSaved] = useState(null);
  const [noti, setNoti] = useState({ total: 0, items: [] });
  const [sheet, setSheet] = useState(null);      // { target, isMe }
  const [toast, setToast] = useState('');

  // 알림 뱃지(로컬 계산) — 로그인/글 변경 시 갱신.
  const refreshNoti = useCallback(async () => {
    setNoti(await getNotifications());
  }, []);
  useEffect(() => { refreshNoti(); }, [refreshNoti, user?.id, posts]);

  // 목록 로드(첫 페이지). 검색어/보드/태그/정렬/스코프 의존.
  const reload = useCallback(async () => {
    setPosts(null);
    offsetRef.current = 0;
    const res = await listPosts({
      board, tag: board === 'talk' ? tag : null, q, sort,
      offset: 0, limit: DEFAULT_PAGE_SIZE, scope: scopeAll ? 'all' : 'board',
    });
    setPosts(res.items);
    setHasMore(res.hasMore);
    offsetRef.current = res.items.length;
  }, [board, tag, q, sort, scopeAll]);

  useEffect(() => { if (view === 'list') reload(); }, [view, reload, user?.id]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const res = await listPosts({
      board, tag: board === 'talk' ? tag : null, q, sort,
      offset: offsetRef.current, limit: DEFAULT_PAGE_SIZE, scope: scopeAll ? 'all' : 'board',
    });
    setPosts((prev) => [...(prev || []), ...res.items]);
    setHasMore(res.hasMore);
    offsetRef.current += res.items.length;
    setLoadingMore(false);
  }, [loadingMore, hasMore, board, tag, q, sort, scopeAll]);

  // 무한 스크롤 센티넬.
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (view !== 'list') return undefined;
    const el = sentinelRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [view, loadMore]);

  const loadSaved = useCallback(async () => {
    setSaved(null);
    setSaved(await listBookmarks());
  }, []);
  useEffect(() => { if (view === 'saved') loadSaved(); }, [view, loadSaved]);

  const onWrite = useCallback(() => {
    if (!user) { goTo('community-auth'); return; }
    goTo('community-write', { board: board === 'center' ? 'center' : board, tag });
  }, [user, board, tag, goTo]);

  const onOpenPost = useCallback((id) => {
    markPostSeen(id);
    goTo('community-post', { id });
  }, [goTo]);

  const onLike = useCallback(async (e, id) => {
    e.stopPropagation();
    if (!user) { goTo('community-auth'); return; }
    const res = await toggleReaction(id);
    if (res.ok) {
      const upd = (list) => list && list.map((p) => p.id === id
        ? { ...p, likedByMe: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) }
        : p);
      setPosts(upd); setSaved(upd);
    }
  }, [user, goTo]);

  const onBookmark = useCallback(async (id) => {
    if (!user) { goTo('community-auth'); return; }
    const res = await toggleBookmark(id);
    if (res.ok) {
      setPosts((list) => list && list.map((p) => p.id === id ? { ...p, bookmarkedByMe: res.bookmarked } : p));
      if (view === 'saved') loadSaved();
      flashToast(res.bookmarked ? '스크랩했어요.' : '스크랩을 취소했어요.');
    }
  }, [user, goTo, view, loadSaved]);

  const flashToast = (m) => { setToast(m); setTimeout(() => setToast(''), 1800); };

  const openSheet = (e, p) => {
    e.stopPropagation();
    if (!user) { goTo('community-auth'); return; }
    setSheet({ target: { type: 'post', id: p.id, authorId: p.author?.id, authorNickname: p.author?.nickname, bookmarked: p.bookmarkedByMe }, isMe: p.mine });
  };

  const renderCard = (p) => (
    <div key={p.id} className="cm-card" role="button" tabIndex={0}
      onClick={() => onOpenPost(p.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpenPost(p.id); }}>
      <div className="cm-card-top">
        <span>
          <AuthorLine author={p.author} when={timeAgo(p.createdAt)} />
          {p.tag && <span className="cm-tag-pill">{tagLabel(p.tag)}</span>}
        </span>
        <button className="cm-more-btn" aria-label="더보기" onClick={(e) => openSheet(e, p)}>
          <MoreHorizontal size={18} />
        </button>
      </div>
      <h3 className="cm-card-title">{p.title}</h3>
      <p className="cm-card-body">{p.body}</p>
      <div className="cm-card-foot">
        <span className={`cm-stat ${p.likedByMe ? 'liked' : ''}`} role="button" tabIndex={0}
          onClick={(e) => onLike(e, p.id)}
          onKeyDown={(e) => { if (e.key === 'Enter') onLike(e, p.id); }}>
          <Heart size={15} fill={p.likedByMe ? 'currentColor' : 'none'} /> {p.likeCount}
        </span>
        <span className="cm-stat"><MessageCircle size={15} /> {p.commentCount}</span>
        <span className={`cm-stat bm ${p.bookmarkedByMe ? 'on' : ''}`} role="button" tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onBookmark(p.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onBookmark(p.id); } }}>
          <Bookmark size={15} fill={p.bookmarkedByMe ? 'currentColor' : 'none'} />
        </span>
      </div>
    </div>
  );

  // ── 헤더(공통) ──
  const header = (
    <header className="topbar between">
      <div className="cm-head-title">
        <Users size={20} />
        <span className="page-title">학교밖 커뮤니티</span>
      </div>
      <div className="cm-head-actions">
        {user && (
          <button className="cm-icon-action" aria-label="알림"
            onClick={() => setView(view === 'noti' ? 'list' : 'noti')}>
            <Bell size={17} />
            {noti.total > 0 && <span className="cm-noti-dot">{noti.total > 99 ? '99+' : noti.total}</span>}
          </button>
        )}
        <button className="cm-head-auth" onClick={() => goTo('community-auth')}>
          {user ? user.nickname : (<><LogIn size={15} /> 로그인</>)}
        </button>
      </div>
    </header>
  );

  // ── 알림 뷰 ──
  if (view === 'noti') {
    return (
      <div className="screen cm-screen">
        {header}
        <button className="cm-section-back" onClick={() => setView('list')}><ChevronLeft size={16} /> 목록으로</button>
        <h2 className="cm-comments-title" style={{ fontSize: 16 }}>알림</h2>
        {noti.items.length === 0 ? (
          <p className="cm-empty">새 소식이 없어요. 내 글에 댓글·공감이 달리면 여기 표시돼요.</p>
        ) : (
          <div className="cm-noti-panel">
            {noti.items.map((n) => (
              <button key={n.postId} className="cm-noti-card" onClick={() => onOpenPost(n.postId)}>
                <p className="cm-noti-card-title">{n.title}</p>
                <span className="cm-noti-card-sub">
                  {n.newComments > 0 && `새 댓글 ${n.newComments}`}
                  {n.newComments > 0 && n.newLikes > 0 && ' · '}
                  {n.newLikes > 0 && `새 공감 ${n.newLikes}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── 스크랩 뷰 ──
  if (view === 'saved') {
    return (
      <div className="screen cm-screen">
        {header}
        <button className="cm-section-back" onClick={() => setView('list')}><ChevronLeft size={16} /> 목록으로</button>
        <h2 className="cm-comments-title" style={{ fontSize: 16 }}>내 스크랩</h2>
        <div className="cm-list">
          {saved === null ? <p className="cm-empty">불러오는 중…</p>
            : saved.length === 0 ? <p className="cm-empty">스크랩한 글이 없어요. 글의 ⋯ 또는 북마크를 눌러 저장해요.</p>
            : saved.map(renderCard)}
        </div>
        {sheet && (
          <CommunityActionSheet
            {...sheet}
            onClose={() => setSheet(null)}
            onBookmarkToggle={() => onBookmark(sheet.target.id)}
            onBlocked={() => { flashToast('차단했어요.'); loadSaved(); }}
            onReported={flashToast}
          />
        )}
        {toast && <div className="cm-toast">{toast}</div>}
      </div>
    );
  }

  // ── 목록 뷰(기본) ──
  const showTags = board === 'talk' && !scopeAll;
  return (
    <div className="screen cm-screen">
      {header}

      <p className="cm-board-hint">
        같은 학교밖끼리 공감하고, 후기를 나눠요. 읽기는 로그인 없이 자유롭게.
      </p>

      {/* 검색 */}
      {searchOpen ? (
        <div className="cm-search">
          <Search size={16} className="cm-search-icon" />
          <input
            className="cm-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={scopeAll ? '전체 게시판에서 검색' : '이 게시판에서 검색'}
            autoFocus
          />
          <button className="cm-search-clear" aria-label="검색 닫기"
            onClick={() => { setQ(''); setSearchOpen(false); setScopeAll(false); }}>
            <X size={16} />
          </button>
        </div>
      ) : null}

      {/* 보드 탭 + 검색/스크랩 토글 */}
      <div className="cm-tabs scroll">
        {boards.map((b) => (
          <button key={b.id}
            className={`cm-tab ${board === b.id && !scopeAll ? 'sel' : ''}`}
            onClick={() => { setBoard(b.id); setTag(null); setScopeAll(false); }}>
            {b.label}
          </button>
        ))}
        <button className={`cm-tab ${searchOpen ? 'sel' : ''}`} aria-label="검색"
          onClick={() => setSearchOpen((v) => !v)}>
          <Search size={15} style={{ verticalAlign: '-2px' }} /> 검색
        </button>
        {user && (
          <button className="cm-tab" onClick={() => setView('saved')}>
            <Bookmark size={15} style={{ verticalAlign: '-2px' }} /> 스크랩
          </button>
        )}
      </div>

      {/* 검색 범위(현재/전체) + 정렬 + 태그 칩 */}
      <div className="cm-toolbar">
        {searchOpen && (
          <button className={`cm-chip ${scopeAll ? 'sel' : ''}`} onClick={() => setScopeAll((v) => !v)}>
            <SlidersHorizontal size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            {scopeAll ? '전체 검색' : '이 게시판'}
          </button>
        )}
        {showTags && (
          <>
            <button className={`cm-chip ${tag === null ? 'sel' : ''}`} onClick={() => setTag(null)}>전체</button>
            {TAGS.map((t) => (
              <button key={t.id} className={`cm-chip ${tag === t.id ? 'sel' : ''}`}
                onClick={() => setTag(t.id)}>{t.label}</button>
            ))}
          </>
        )}
        <div className="cm-sort">
          <button className={`cm-sort-btn ${sort === 'latest' ? 'sel' : ''}`} onClick={() => setSort('latest')}>최신</button>
          <button className={`cm-sort-btn ${sort === 'popular' ? 'sel' : ''}`} onClick={() => setSort('popular')}>인기</button>
        </div>
      </div>

      <div className="cm-list">
        {posts === null ? (
          <p className="cm-empty">불러오는 중…</p>
        ) : posts.length === 0 ? (
          board === 'center' && !user?.verified ? (
            <p className="cm-locked">우리 센터 보드는 꿈드림 인증 후 이용할 수 있어요.</p>
          ) : (
            <p className="cm-empty">
              {q ? '검색 결과가 없어요.' : `아직 글이 없어요. ${user ? '첫 글을 남겨보세요.' : '로그인하고 첫 글을 남겨보세요.'}`}
            </p>
          )
        ) : (
          <>
            {posts.map(renderCard)}
            {hasMore && (
              <button className="cm-load-more" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? '불러오는 중…' : '더 보기'}
              </button>
            )}
            <div ref={sentinelRef} style={{ height: 1 }} />
          </>
        )}
      </div>

      <button className="cm-fab" onClick={onWrite} aria-label="글쓰기">
        <PenSquare size={20} />
        <span>글쓰기</span>
      </button>

      {sheet && (
        <CommunityActionSheet
          {...sheet}
          onClose={() => setSheet(null)}
          onBookmarkToggle={() => onBookmark(sheet.target.id)}
          onBlocked={() => { flashToast('차단했어요. 이 사람 글이 숨겨져요.'); reload(); }}
          onReported={flashToast}
        />
      )}
      {toast && <div className="cm-toast">{toast}</div>}
    </div>
  );
}
