// CommunityPostScreen — 글 상세 + 댓글. 읽기는 누구나, 댓글·공감·스크랩·신고는 로그인 필요.
//   P1: 스크랩 토글, 글/댓글 신고·차단(액션 시트). 진입 시 알림 본 것으로 표시.
// props: goTo(screen, params), goBack(), id(글 id)
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Heart, Send, Trash2, Bookmark, MoreHorizontal } from 'lucide-react';
import {
  getPost, listComments, addComment, toggleReaction, toggleBookmark, deletePost,
  markPostSeen, tagLabel, timeAgo,
} from '../lib/community.js';
import { AuthorLine } from './CommunityBadge.jsx';
import CommunityActionSheet from './CommunityActionSheet.jsx';
import { useAuthUser } from './AuthScreen.jsx';
import '../styles.community.css';

export default function CommunityPostScreen({ goTo = () => {}, goBack = () => {}, id }) {
  const user = useAuthUser();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notfound, setNotfound] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');

  const flashToast = (m) => { setToast(m); setTimeout(() => setToast(''), 1800); };

  const load = useCallback(async () => {
    const p = await getPost(id);
    if (!p) { setNotfound(true); return; }
    setPost(p);
    setComments(await listComments(id));
    markPostSeen(id);     // 상세 진입 → 알림 본 것으로
  }, [id]);

  useEffect(() => { load(); }, [load, user?.id]);

  const onLike = useCallback(async () => {
    if (!user) { goTo('community-auth'); return; }
    const res = await toggleReaction(id);
    if (res.ok) {
      setPost((p) => ({ ...p, likedByMe: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) }));
    }
  }, [user, id, goTo]);

  const onBookmark = useCallback(async () => {
    if (!user) { goTo('community-auth'); return; }
    const res = await toggleBookmark(id);
    if (res.ok) {
      setPost((p) => ({ ...p, bookmarkedByMe: res.bookmarked }));
      flashToast(res.bookmarked ? '스크랩했어요.' : '스크랩을 취소했어요.');
    }
  }, [user, id, goTo]);

  const onComment = useCallback(async (e) => {
    e.preventDefault();
    if (!user) { goTo('community-auth'); return; }
    if (!text.trim()) return;
    setBusy(true);
    const res = await addComment(id, text);
    setBusy(false);
    if (res.ok) { setText(''); setComments(await listComments(id)); setPost(await getPost(id)); markPostSeen(id); }
  }, [user, id, text, goTo]);

  const onDelete = useCallback(async () => {
    if (!window.confirm('이 글을 삭제할까요?')) return;
    const res = await deletePost(id);
    if (res.ok) goBack();
  }, [id, goBack]);

  const openPostSheet = () => {
    if (!user) { goTo('community-auth'); return; }
    setSheet({
      target: { type: 'post', id: post.id, authorId: post.author?.id, authorNickname: post.author?.nickname, bookmarked: post.bookmarkedByMe },
      isMe: post.mine, kind: 'post',
    });
  };
  const openCommentSheet = (c) => {
    if (!user) { goTo('community-auth'); return; }
    setSheet({
      target: { type: 'comment', id: c.id, authorId: c.author?.id, authorNickname: c.author?.nickname },
      isMe: c.mine, kind: 'comment',
    });
  };

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

  const boardLabel = post.board === 'review' ? '꿈드림 후기'
    : post.board === 'center' ? '우리 센터' : '이야기';

  return (
    <div className="screen cm-screen">
      <header className="topbar between">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="page-title">{boardLabel}</span>
        {post.mine
          ? <button className="icon-btn" aria-label="삭제" onClick={onDelete}><Trash2 size={19} /></button>
          : <button className="icon-btn" aria-label="더보기" onClick={openPostSheet}><MoreHorizontal size={20} /></button>}
      </header>

      <article className="cm-post">
        <div className="cm-card-top">
          <span>
            <AuthorLine author={post.author} when={timeAgo(post.createdAt)} />
            {post.tag && <span className="cm-tag-pill">{tagLabel(post.tag)}</span>}
          </span>
        </div>
        <h2 className="cm-post-title">{post.title}</h2>
        <p className="cm-post-body">{post.body}</p>

        <div className="cm-post-actions">
          <button className={`cm-like-btn ${post.likedByMe ? 'liked' : ''}`} onClick={onLike}>
            <Heart size={17} fill={post.likedByMe ? 'currentColor' : 'none'} />
            공감 {post.likeCount}
          </button>
          <button className={`cm-like-btn bm ${post.bookmarkedByMe ? 'on' : ''}`} onClick={onBookmark}>
            <Bookmark size={17} fill={post.bookmarkedByMe ? 'currentColor' : 'none'} />
            {post.bookmarkedByMe ? '스크랩됨' : '스크랩'}
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
              <div className="cm-comment-head">
                <AuthorLine author={c.author} when={timeAgo(c.createdAt)} />
                {!c.mine && (
                  <button className="cm-more-btn" aria-label="댓글 더보기" onClick={() => openCommentSheet(c)}>
                    <MoreHorizontal size={16} />
                  </button>
                )}
              </div>
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

      {sheet && (
        <CommunityActionSheet
          target={sheet.target}
          isMe={sheet.isMe}
          onClose={() => setSheet(null)}
          onBookmarkToggle={sheet.kind === 'post' ? onBookmark : null}
          onBlocked={() => { flashToast('차단했어요. 이 사람 글·댓글이 숨겨져요.'); load(); }}
          onReported={flashToast}
        />
      )}
      {toast && <div className="cm-toast">{toast}</div>}
    </div>
  );
}
