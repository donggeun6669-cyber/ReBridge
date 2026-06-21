// CommunityPostScreen — 글 상세 + 댓글. 읽기는 누구나, 댓글·공감은 로그인 필요.
// props: goTo(screen, params), goBack(), id(글 id)
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Heart, Send, Trash2 } from 'lucide-react';
import {
  getPost, listComments, addComment, toggleReaction, deletePost, timeAgo,
} from '../lib/community.js';
import { AuthorLine } from './CommunityBadge.jsx';
import { useAuthUser } from './AuthScreen.jsx';
import '../styles.community.css';

export default function CommunityPostScreen({ goTo = () => {}, goBack = () => {}, id }) {
  const user = useAuthUser();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notfound, setNotfound] = useState(false);

  const load = useCallback(async () => {
    const p = await getPost(id);
    if (!p) { setNotfound(true); return; }
    setPost(p);
    setComments(await listComments(id));
  }, [id]);

  useEffect(() => { load(); }, [load, user?.id]);

  const onLike = useCallback(async () => {
    if (!user) { goTo('community-auth'); return; }
    const res = await toggleReaction(id);
    if (res.ok) {
      setPost((p) => ({ ...p, likedByMe: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) }));
    }
  }, [user, id, goTo]);

  const onComment = useCallback(async (e) => {
    e.preventDefault();
    if (!user) { goTo('community-auth'); return; }
    if (!text.trim()) return;
    setBusy(true);
    const res = await addComment(id, text);
    setBusy(false);
    if (res.ok) { setText(''); setComments(await listComments(id)); setPost(await getPost(id)); }
  }, [user, id, text, goTo]);

  const onDelete = useCallback(async () => {
    if (!window.confirm('이 글을 삭제할까요?')) return;
    const res = await deletePost(id);
    if (res.ok) goBack();
  }, [id, goBack]);

  if (notfound) {
    return (
      <div className="screen cm-screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
          <span className="page-title">글</span>
        </header>
        <p className="cm-empty">삭제됐거나 없는 글이에요.</p>
      </div>
    );
  }
  if (!post) {
    return (
      <div className="screen cm-screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
          <span className="page-title">글</span>
        </header>
        <p className="cm-empty">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="screen cm-screen">
      <header className="topbar between">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="page-title">{post.board === 'review' ? '꿈드림 후기' : '공감·소통'}</span>
        {post.mine
          ? <button className="icon-btn" aria-label="삭제" onClick={onDelete}><Trash2 size={19} /></button>
          : <span style={{ width: 38 }} />}
      </header>

      <article className="cm-post">
        <div className="cm-card-top">
          <AuthorLine author={post.author} when={timeAgo(post.createdAt)} />
        </div>
        <h2 className="cm-post-title">{post.title}</h2>
        <p className="cm-post-body">{post.body}</p>

        <div className="cm-post-actions">
          <button className={`cm-like-btn ${post.likedByMe ? 'liked' : ''}`} onClick={onLike}>
            <Heart size={17} fill={post.likedByMe ? 'currentColor' : 'none'} />
            공감 {post.likeCount}
          </button>
        </div>
      </article>

      <section className="cm-comments">
        <h3 className="cm-comments-title">댓글 {comments.length}</h3>
        {comments.length === 0 ? (
          <p className="cm-empty sm">첫 댓글을 남겨보세요.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="cm-comment">
              <AuthorLine author={c.author} when={timeAgo(c.createdAt)} />
              <p className="cm-comment-body">{c.body}</p>
            </div>
          ))
        )}
      </section>

      <form className="cm-comment-bar" onSubmit={onComment}>
        <input
          className="cm-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? '댓글 달기…' : '로그인하고 댓글 달기'}
          onFocus={() => { if (!user) goTo('community-auth'); }}
          maxLength={1000}
        />
        <button className="cm-send" disabled={busy || !text.trim()} aria-label="댓글 등록">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
