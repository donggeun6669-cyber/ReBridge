// SyCommunityWrite — 서연 UI '커뮤니티 글쓰기' 시안.
//   저장은 src/lib/community.js 의 createPost 를 그대로 쓴다.
// props: goTo(screen, params), goBack(), params:{ board, tag, initialTitle }
import { useState, useCallback } from 'react';
import { ChevronDown, ChevronLeft, Shield } from 'lucide-react';
import { boardsFor, TAGS, TAG_BOARDS, createPost } from '../lib/community.js';
import { useAuthUser } from '../components/AuthScreen.jsx';
import { titlePlaceholder, bodyPlaceholder } from './eUtil.js';
import './sy-e.css';

export default function SyCommunityWrite({ goTo = () => {}, goBack = () => {}, params = {} }) {
  const user = useAuthUser();
  const boards = boardsFor(user).filter((x) => !x.virtual); // HOT은 모음이라 쓸 수 없다
  const initial = boards.some((x) => x.id === params.board) ? params.board : 'free';
  const [b, setB] = useState(initial);
  const [t, setT] = useState(TAGS.some((x) => x.id === params.tag) ? params.tag : TAGS[0].id);
  const [title, setTitle] = useState(params.initialTitle || '');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = useCallback(async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const res = await createPost({ board: b, tag: TAG_BOARDS.has(b) ? t : null, title, body });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    goTo('community-post', { id: res.id });
  }, [b, t, title, body, goTo]);

  if (!user) {
    return (
      <div className="sy-screen sy-e-write">
        <header className="sy-top">
          <button type="button" className="sy-top-back" aria-label="뒤로" onClick={goBack}>
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
          <h1 className="sy-top-title">글쓰기</h1>
        </header>
        <p className="sy-e-empty">로그인이 필요해요.</p>
        <button type="button" className="sy-btn" onClick={() => goTo('community-auth')}>로그인하러 가기</button>
      </div>
    );
  }

  const canSubmit = !busy && title.trim() && body.trim();

  return (
    <div className="sy-screen sy-e-write">
      <header className="sy-top">
        <button type="button" className="sy-top-back" aria-label="뒤로" onClick={goBack}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <h1 className="sy-top-title">글쓰기</h1>
        <button type="button" className="sy-top-action" disabled={!canSubmit} onClick={submit}>
          {busy ? '올리는 중…' : '등록'}
        </button>
      </header>

      <form onSubmit={submit}>
        <div className="sy-e-field">
          <label className="sy-e-label" htmlFor="sy-e-board">게시판</label>
          <div className="sy-e-select-wrap">
            <select id="sy-e-board" className="sy-e-select" value={b}
              onChange={(e) => setB(e.target.value)}>
              {boards.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
            <ChevronDown size={18} className="sy-e-select-arrow" aria-hidden="true" />
          </div>
        </div>

        {TAG_BOARDS.has(b) && (
          <div className="sy-e-tags" style={{ marginTop: 12 }}>
            {TAGS.map((x) => (
              <button type="button" key={x.id}
                className={`sy-e-tag-chip${t === x.id ? ' sel' : ''}`}
                onClick={() => setT(x.id)}>{x.label}</button>
            ))}
          </div>
        )}

        <div className="sy-e-field">
          <label className="sy-e-label" htmlFor="sy-e-title">제목</label>
          <input
            id="sy-e-title"
            className="sy-e-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={titlePlaceholder(b)}
            maxLength={80}
          />
        </div>

        <div className="sy-e-field">
          <label className="sy-e-label" htmlFor="sy-e-body">본문</label>
          <textarea
            id="sy-e-body"
            className="sy-e-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={bodyPlaceholder(b)}
            rows={8}
            maxLength={4000}
          />
        </div>

        <div className="sy-e-notice">
          <Shield size={18} aria-hidden="true" />
          <span>이름, 연락처, 학교처럼 나를 알 수 있는 정보는 적지 않아요.</span>
        </div>

        {err && <p className="sy-e-write-err">{err}</p>}

        <button type="submit" className="sy-btn sy-e-submit" disabled={!canSubmit}>
          {busy ? '올리는 중…' : '등록하기'}
        </button>
      </form>
    </div>
  );
}
