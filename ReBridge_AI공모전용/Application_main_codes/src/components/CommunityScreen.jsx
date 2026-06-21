// CommunityScreen — 게시판. 탭 2개: '꿈드림 후기'(review) / '공감·소통'(talk).
//   로그인 없이 읽기 가능. 글쓰기/공감은 로그인 필요 → 미로그인 시 로그인 화면으로.
// props: goTo(screen, params), goBack()
import { useState, useEffect, useCallback } from 'react';
import { PenSquare, Heart, MessageCircle, Users, LogIn } from 'lucide-react';
import { BOARDS, listPosts, toggleReaction, timeAgo } from '../lib/community.js';
import { AuthorLine } from './CommunityBadge.jsx';
import { useAuthUser } from './AuthScreen.jsx';
import '../styles.community.css';

export default function CommunityScreen({ goTo = () => {}, goBack = () => {} }) {
  const user = useAuthUser();
  const [board, setBoard] = useState('review');
  const [posts, setPosts] = useState(null);   // null = 로딩

  const load = useCallback(async (b) => {
    setPosts(null);
    setPosts(await listPosts(b));
  }, []);

  useEffect(() => { load(board); }, [board, load]);
  // 로그인 상태가 바뀌면 '내 공감' 표시가 달라지므로 다시 로드.
  useEffect(() => { load(board); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onWrite = useCallback(() => {
    if (!user) { goTo('community-auth'); return; }
    goTo('community-write', { board });
  }, [user, board, goTo]);

  const onLike = useCallback(async (e, id) => {
    e.stopPropagation();
    if (!user) { goTo('community-auth'); return; }
    const res = await toggleReaction(id);
    if (res.ok) {
      setPosts((list) => list.map((p) => p.id === id
        ? { ...p, likedByMe: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) }
        : p));
    }
  }, [user, goTo]);

  return (
    <div className="screen cm-screen">
      <header className="topbar between">
        <div className="cm-head-title">
          <Users size={20} />
          <span className="page-title">학교밖 커뮤니티</span>
        </div>
        {user ? (
          <button className="cm-head-auth" onClick={() => goTo('community-auth')}>
            {user.nickname}
          </button>
        ) : (
          <button className="cm-head-auth" onClick={() => goTo('community-auth')}>
            <LogIn size={15} /> 로그인
          </button>
        )}
      </header>

      <p className="cm-board-hint">
        같은 학교밖끼리 공감하고, 꿈드림 후기를 나눠요. 읽기는 로그인 없이 자유롭게.
      </p>

      <div className="cm-tabs">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            className={`cm-tab ${board === b.id ? 'sel' : ''}`}
            onClick={() => setBoard(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="cm-list">
        {posts === null ? (
          <p className="cm-empty">불러오는 중…</p>
        ) : posts.length === 0 ? (
          <p className="cm-empty">
            아직 글이 없어요. {user ? '첫 글을 남겨보세요.' : '로그인하고 첫 글을 남겨보세요.'}
          </p>
        ) : (
          posts.map((p) => (
            <button key={p.id} className="cm-card" onClick={() => goTo('community-post', { id: p.id })}>
              <div className="cm-card-top">
                <AuthorLine author={p.author} when={timeAgo(p.createdAt)} />
              </div>
              <h3 className="cm-card-title">{p.title}</h3>
              <p className="cm-card-body">{p.body}</p>
              <div className="cm-card-foot">
                <span
                  className={`cm-stat ${p.likedByMe ? 'liked' : ''}`}
                  onClick={(e) => onLike(e, p.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onLike(e, p.id); }}
                >
                  <Heart size={15} fill={p.likedByMe ? 'currentColor' : 'none'} /> {p.likeCount}
                </span>
                <span className="cm-stat">
                  <MessageCircle size={15} /> {p.commentCount}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      <button className="cm-fab" onClick={onWrite} aria-label="글쓰기">
        <PenSquare size={20} />
        <span>글쓰기</span>
      </button>
    </div>
  );
}
