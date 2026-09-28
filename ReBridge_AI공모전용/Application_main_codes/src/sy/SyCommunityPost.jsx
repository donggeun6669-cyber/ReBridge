// SyCommunityPost — 서연 UI '커뮤니티 글 상세' 시안.
//   글+댓글은 src/lib/community.js 를 그대로 쓴다. 질문 게시판도 시안대로
//   댓글을 한 줄로 합쳐 보여준다(원래 화면의 '선생님·멘토 답변' 별도 구획은 없음).
// props: goTo(screen, params), goBack(), params:{ id }
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Heart, Bookmark, MoreHorizontal, Trash2, Send, CornerDownRight } from 'lucide-react';
import {
  getPost, listComments, addComment, toggleReaction, toggleCommentReaction,
  toggleBookmark, deletePost, markPostSeen, timeAgo, boardLabel as boardLabelOf,
} from '../lib/community.js';
import { getBadge } from '../lib/youthVerify.js';
import { useAuthUser, NicknameGate } from '../components/AuthScreen.jsx';
import CommunityActionSheet from '../components/CommunityActionSheet.jsx';
import { avatarInitial } from './eUtil.js';
import './sy-e.css';

function PostAuthor({ author, when }) {
  const badge = getBadge(author);
  return (
    <div className="sy-e-post-author">
      <span className="sy-e-post-author-name">
        {author?.nickname || '익명'}{badge && <> · {badge.short || badge.label}</>}
      </span>
      {when && <span className="sy-e-post-author-when">{when}</span>}
    </div>
  );
}

export default function SyCommunityPost({ goTo = () => {}, goBack = () => {}, params = {} }) {
  const id = params.id;
  const user = useAuthUser();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notfound, setNotfound] = useState(false);
  const [gate, setGate] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');

  const flashToast = (m) => { setToast(m); setTimeout(() => setToast(''), 1800); };

  const load = useCallback(async () => {
    const p = await getPost(id);
    if (!p) { setNotfound(true); return; }
    setPost(p);
    setComments(await listComments(id));
    markPostSeen(id);
  }, [id]);

  useEffect(() => { load(); }, [load, user?.id]);

  const onLike = useCallback(async () => {
    if (!user) { setGate({ type: 'postLike' }); return; }
    const res = await toggleReaction(id);
    if (res.ok) setPost((p) => ({ ...p, likedByMe: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) }));
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
  // 댓글별 신고·차단은 시안에 자리가 없어 뺐다(글 상세의 '⋯'·'신고'로만 접근).
  const onReplyClick = (c) => setReplyTo({ id: c.id, nickname: c.author?.nickname || '익명' });

  const header = (title, right) => (
    <header className="sy-top sy-e-post-top">
      <button type="button" className="sy-top-back" aria-label="뒤로" onClick={goBack}>
        <ChevronLeft size={24} strokeWidth={2} />
      </button>
      <h1 className="sy-top-title">{title}</h1>
      {right}
    </header>
  );

  if (notfound) {
    return (
      <div className="sy-screen sy-e-post">
        {header('글', null)}
        <p className="sy-e-empty">삭제됐거나 없는 글이에요.</p>
      </div>
    );
  }
  if (!post) {
    return (
      <div className="sy-screen sy-e-post">
        {header('글', null)}
        <p className="sy-e-empty">불러오는 중…</p>
      </div>
    );
  }

  const boardTitle = boardLabelOf(post.board);
  const totalComments = comments.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

  const renderComment = (c, isReply) => (
    <div key={c.id} className={`sy-e-comment-group${isReply ? ' reply' : ''}`}>
      <div className="sy-e-comment-head">
        {isReply && <CornerDownRight size={13} className="sy-e-reply-arrow" aria-hidden="true" style={{ color: 'var(--sy-ink-3)' }} />}
        <span className="sy-e-avatar" aria-hidden="true">{avatarInitial(c.author?.nickname)}</span>
        <span className="sy-e-comment-name">{c.author?.nickname || '익명'}</span>
        <span className="sy-e-comment-when">{timeAgo(c.createdAt)}</span>
      </div>
      <p className="sy-e-comment-body">{c.body}</p>
      <div className="sy-e-comment-acts">
        <button type="button" className={`sy-e-comment-act${c.likedByMe ? ' liked' : ''}`} onClick={() => onCommentLike(c.id)}>
          공감 {c.likeCount || 0}
        </button>
        {!isReply && (
          <button type="button" className="sy-e-comment-act" onClick={() => onReplyClick(c)}>답글</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="sy-screen sy-e-post">
      {header(boardTitle, post.mine
        ? <button type="button" className="sy-top-action" aria-label="삭제" onClick={onDelete}><Trash2 size={19} /></button>
        : <button type="button" className="sy-top-action" aria-label="더보기" onClick={openPostSheet}><MoreHorizontal size={20} /></button>)}

      <article>
        {post.board === 'qna' && post.answered && (
          <div className="sy-e-post-answer">
            <span className="sy-e-pill-answer">✓ 답변 완료</span>
          </div>
        )}
        <h2 className="sy-e-post-title">{post.title}</h2>
        <PostAuthor author={post.author} when={timeAgo(post.createdAt)} />
        <p className="sy-e-post-body">{post.body}</p>

        <div className="sy-e-post-actions">
          <button type="button" className="sy-e-action-btn like" onClick={onLike}>
            <Heart size={15} fill={post.likedByMe ? 'currentColor' : 'none'} /> 공감 {post.likeCount}
          </button>
          <button type="button" className={`sy-e-action-btn${post.bookmarkedByMe ? ' on' : ''}`} onClick={onBookmark}>
            <Bookmark size={15} fill={post.bookmarkedByMe ? 'currentColor' : 'none'} /> {post.bookmarkedByMe ? '스크랩됨' : '스크랩'}
          </button>
          <button type="button" className="sy-e-action-btn" onClick={openPostSheet}>신고</button>
        </div>
      </article>

      <div className="sy-e-divider" />

      <section>
        <h3 className="sy-e-comments-title">댓글 {totalComments}</h3>
        {comments.length === 0 ? (
          <p className="sy-e-empty">첫 댓글을 남겨보세요.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id}>
              {renderComment(c, false)}
              {(c.replies || []).map((r) => renderComment(r, true))}
            </div>
          ))
        )}
      </section>

      <form className="sy-e-comment-bar" onSubmit={onComment}>
        {replyTo && (
          <div className="sy-e-reply-chip">
            <span className="sy-chip"><CornerDownRight size={12} /> {replyTo.nickname}님에게 답글</span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="답글 취소">×</button>
          </div>
        )}
        <div className="sy-e-comment-bar-row">
          <input
            className="sy-e-comment-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `${replyTo.nickname}님에게 답글…` : '댓글을 남겨요'}
            maxLength={1000}
          />
          <button type="submit" className="sy-e-comment-send" disabled={busy || !text.trim()} aria-label={replyTo ? '답글 등록' : '댓글 등록'}>
            <Send size={16} />
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
      {toast && <div className="sy-e-toast">{toast}</div>}
      <NicknameGate open={!!gate} onClose={() => setGate(null)} onDone={onGateDone} />
    </div>
  );
}
