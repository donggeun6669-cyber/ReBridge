// CommunityWriteScreen — 글 작성(로그인 필요). P1: 보드 선택(인증자 '우리 센터' 포함) + 이야기 주제 태그.
// props: goTo(screen, params), goBack(), board(기본 게시판), tag(기본 태그)
import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { boardsFor, TAGS, createPost } from '../lib/community.js';
import { useAuthUser } from './AuthScreen.jsx';
import { VerifiedBadge } from './CommunityBadge.jsx';
import '../styles.community.css';

export default function CommunityWriteScreen({ goTo = () => {}, goBack = () => {}, board = 'review', tag = null }) {
  const user = useAuthUser();
  const boards = boardsFor(user);
  const initial = boards.some((x) => x.id === board) ? board : 'review';
  const [b, setB] = useState(initial);
  const [t, setT] = useState(tag || 'free');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = useCallback(async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const res = await createPost({ board: b, tag: b === 'talk' ? t : null, title, body });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    goTo('community-post', { id: res.id });
  }, [b, t, title, body, goTo]);

  // 로그인 안 됐으면 작성 불가 안내(보통은 CommunityScreen에서 막지만 안전망).
  if (!user) {
    return (
      <div className="screen cm-screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
          <span className="page-title">글쓰기</span>
        </header>
        <p className="cm-empty">로그인이 필요해요.</p>
        <button className="cm-btn primary" onClick={() => goTo('community-auth')}>로그인하러 가기</button>
      </div>
    );
  }

  return (
    <div className="screen cm-screen">
      <header className="topbar between">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="page-title">글쓰기</span>
        <button className="cm-post-btn" disabled={busy || !title.trim() || !body.trim()} onClick={submit}>
          {busy ? '올리는 중…' : '올리기'}
        </button>
      </header>

      <div className="cm-write-as">
        <span className="cm-write-as-label">작성자</span>
        <span className="cm-author">
          <span className="cm-author-nick">{user.nickname}</span>
          <VerifiedBadge user={user} />
        </span>
      </div>

      <form className="cm-form" onSubmit={submit}>
        <div className="cm-tabs cm-tabs-sm scroll">
          {boards.map((x) => (
            <button type="button" key={x.id}
              className={`cm-tab ${b === x.id ? 'sel' : ''}`}
              onClick={() => setB(x.id)}>
              {x.label}
            </button>
          ))}
        </div>

        {b === 'talk' && (
          <div className="cm-toolbar" style={{ marginTop: -2 }}>
            {TAGS.map((x) => (
              <button type="button" key={x.id}
                className={`cm-chip ${t === x.id ? 'sel' : ''}`}
                onClick={() => setT(x.id)}>{x.label}</button>
            ))}
          </div>
        )}

        <input
          className="cm-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          maxLength={80}
        />
        <textarea
          className="cm-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="같은 학교밖 친구들에게 하고 싶은 이야기를 편하게 적어요. 실명·연락처는 쓰지 마세요."
          rows={9}
          maxLength={4000}
        />
        {err && <p className="cm-err">{err}</p>}
      </form>
    </div>
  );
}
