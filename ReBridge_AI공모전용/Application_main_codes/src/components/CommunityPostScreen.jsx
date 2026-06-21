// CommunityPostScreen — 글 상세 + 댓글. 읽기는 누구나, 쓰기/공감/스크랩/신고는 로그인 필요.
//   P0: 1단 답글(parent_id)·댓글 공감(♥)·인라인 닉네임 게이트(첫 행동 시 제자리 복귀).
//   P1: 스크랩 토글, 글/댓글 신고·차단(액션 시트), 태그 칩, 진입 시 알림 본 것으로 표시.
// props: goTo(screen, params), goBack(), id(글 id)
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Heart, Send, Trash2, Bookmark, MoreHorizontal, CornerDownRight } from 'lucide-react';
import {
  getPost, listComments, addComment, toggleReaction, toggleCommentReaction,
  toggleBookmark, deletePost, markPostSeen, tagLabel, timeAgo,
} from '../lib/community.js';
import { AuthorLine } from './CommunityBadge.jsx';
import CommunityActionSheet from './CommunityActionSheet.jsx';
import { useAuthUser, NicknameGate } from './AuthScreen.jsx';
import '../styles.community.css';

export default function CommunityPostScreen({ goTo = () => {}, goBack = () => {}, id }) {
  const user = useAuthUser();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);   // 답글 대상 댓글 { id, nickname } | null
  const [busy, setBusy] = useState(false);
  const [notfound, setNotfound] = useState(false);
  const [gate, setGate] = useState(null);          // 미로그인 첫 행동 대기 { type, ... }
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
    if (!user) { setGate({ type: 'postLike' }); return; }
    const res = await toggleReaction(id);
    if (res.ok) {
      setPost((p) => ({ ...p, likedByMe: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) }));
    }
  }, [user, id]);

  const onCommentLike = useCallback(async (commentId) => {
    if (!user) { setGate({ type: 'commentLike', commentId }); return; }
    const res = await toggleCommentReaction(commentId);
    if (res.ok) setComments(await listComments(id));
  }, [user, id]);

  const onBookmark = useCallback(async () => {
    if (!user) { setGate({ type: 'bookmark' }); return; }
    const res = await toggleBookmark(id);
    if (res.ok) {
      setPost((p) => ({ ...p, bookmarkedByMe: res.bookmarked }));
      flashToast(res.bookmarked ? '스크랩했어요.' : '스크랩을 취소했어요.');
    }
  }, [user, id]);

  // 댓글/답글 등록. parentId 있으면 1단 답글.
  const submitComment = useCallback(async (parentId) => {
    if (!text.trim()) return;
    setBusy(true);
    const res = await addComment(id, text, parentId || null);
    setBusy(false);
    if (res.ok) {
      setText(''); setReplyTo(null);
      setComments(await listComments(id));
      setPost(await getPost(id));
      markPostSeen(id);
    }
  }, [id, text]);

  const onComment = useCallback((e) => {
    e.preventDefault();
    if (!user) { setGate({ type: 'comment' }); return; }
    submitComment(replyTo?.id || null);
  }, [user, replyTo, submitComment]);

  // 닉네임 가입 완료 후, 대기 중이던 행동을 이어서 수행.
  const onGateDone = useCallback(async () => {
    const pending = gate;
    setGate(null);
    if (pending?.type === 'postLike') {
      const res = await toggleReaction(id);
      if (res.ok) setPost((p) => ({ ...p, likedByMe: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) }));
    } else if (pending?.type === 'commentLike') {
      const res = await toggleCommentReaction(pending.commentId);
      if (res.ok) setComments(await listComments(id));
    } else if (pending?.type === 'bookmark') {
      const res = await toggleBookmark(id);
      if (res.ok) { setPost((p) => ({ ...p, bookmarkedByMe: res.bookmarked })); flashToast(res.bookmarked ? '스크랩했어요.' : '스크랩을 취소했어요.'); }
    } else if (pending?.type === 'comment') {
      submitComment(replyTo?.id || null);
    }
  }, [gate, id, replyTo, submitComment]);

  const onDelete = useCallback(async () => {
    if (!window.confirm('이 글을 삭제할까요?')) return;
    const res = await deletePost(id);
    if (res.ok) goBack();
  }, [id, goBack]);

  const openPostSheet = () => {
    if (!user) { setGate({ type: 'none' }); return; }
    setSheet({
      target: { type: 'post', id: post.id, authorId: post.author?.id, authorNickname: post.author?.nickname, bookmarked: post.bookmarkedByMe },
      isMe: post.mine, kind: 'post',
    });
  };
  const openCommentSheet = (c) => {
    if (!user) { setGate({ type: 'none' }); return; }
    setSheet({
      target: { type: 'comment', id: c.id, authorId: c.author?.id, authorNickname: c.author?.nickname },
      isMe: c.mine, kind: 'comment',
    });
  };

  function onReplyClick(c) {
    setReplyTo({ id: c.id, nickname: c.author?.nickname || '익명' });
  }

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

  // 댓글 수(원댓글 + 답글) 합산 표시.
  const totalComments = comments.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

  const renderComment = (c, isReply) => (
    <div key={c.id} className={`cm-comment ${isReply ? 'cm-comment-reply' : ''}`}>
      {isReply && <CornerDownRight size={14} className="cm-reply-arrow" aria-hidden="true" />}
      <div className="cm-comment-main">
        <div className="cm-comment-head">
          <AuthorLine author={c.author} when={timeAgo(c.createdAt)} />
          {!c.mine && (
            <button className="cm-more-btn" aria-label="댓글 더보기" onClick={() => openCommentSheet(c)}>
              <MoreHorizontal size={16} />
            </button>
          )}
        </div>
        <p className="cm-comment-body">{c.body}</p>
        <div className="cm-comment-acts">
          <button
            className={`cm-cmt-like ${c.likedByMe ? 'liked' : ''}`}
            onClick={() => onCommentLike(c.id)}
          >
            <Heart size={13} fill={c.likedByMe ? 'currentColor' : 'none'} /> {c.likeCount || 0}
          </button>
          {!isReply && (
            <button className="cm-cmt-reply-btn" onClick={() => onReplyClick(c)}>
              답글
            </button>
          )}
        </div>
      </div>
    </div>
  );

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
        <h3 className="cm-comments-title">댓글 {totalComments}</h3>
        {comments.length === 0 ? (
          <p className="cm-empty sm">첫 댓글을 남겨보세요.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="cm-comment-group">
              {renderComment(c, false)}
              {(c.replies || []).map((r) => renderComment(r, true))}
            </div>
          ))
        )}
      </section>

      <form className="cm-comment-bar" onSubmit={onComment}>
        {replyTo && (
          <div className="cm-reply-chip">
            <CornerDownRight size={13} />
            <span className="cm-reply-chip-text">{replyTo.nickname}님에게 답글</span>
            <button type="button" className="cm-reply-chip-x" onClick={() => setReplyTo(null)} aria-label="답글 취소">×</button>
          </div>
        )}
        <div className="cm-comment-bar-row">
          <input
            className="cm-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `${replyTo.nickname}님에게 답글…` : '댓글 달기…'}
            maxLength={1000}
          />
          <button className="cm-send" disabled={busy || !text.trim()} aria-label={replyTo ? '답글 등록' : '댓글 등록'}>
            <Send size={18} />
          </button>
        </div>
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

      <NicknameGate open={!!gate} onClose={() => setGate(null)} onDone={onGateDone} />
    </div>
  );
}
