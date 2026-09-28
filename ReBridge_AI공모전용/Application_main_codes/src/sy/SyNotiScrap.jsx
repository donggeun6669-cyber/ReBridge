// 알림 · 내 스크랩 — 시안: 알림 · 내 스크랩.png
// 기능은 기존 lib/community.js(listBookmarks·getNotifications)·lib/auth.js 를 그대로 쓴다.
import { useEffect, useState } from 'react';
import { Heart, CheckCircle2 } from 'lucide-react';
import { listBookmarks, getNotifications, boardLabel } from '../lib/community.js';
import { getCachedUser } from '../lib/auth.js';
import SyTop from './SyTop.jsx';
import './sy-f.css';

export default function SyNotiScrap({ goTo = () => {}, goBack = () => {} }) {
  const [tab, setTab] = useState('scrap'); // 시안 기본값 = '내 스크랩' 켜진 상태
  const [scraps, setScraps] = useState([]);
  const [notis, setNotis] = useState({ total: 0, items: [] });
  const [loaded, setLoaded] = useState(false);
  const loggedIn = !!getCachedUser();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [sc, no] = await Promise.all([listBookmarks(), getNotifications()]);
      if (!alive) return;
      setScraps(sc);
      setNotis(no);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="sy-screen sy-f-screen">
      <SyTop title="알림 · 내 스크랩" onBack={goBack} />

      <div className="sy-f-ns-tabs">
        <button type="button" className={`sy-f-ns-tab${tab === 'noti' ? ' on' : ''}`} onClick={() => setTab('noti')}>
          알림
        </button>
        <button type="button" className={`sy-f-ns-tab${tab === 'scrap' ? ' on' : ''}`} onClick={() => setTab('scrap')}>
          내 스크랩{scraps.length > 0 ? ` ${scraps.length}` : ''}
        </button>
      </div>

      {!loggedIn && (
        <p className="sy-f-ns-empty">
          로그인하면 스크랩·알림을 볼 수 있어요.
          <button type="button" className="sy-f-ns-empty-link" onClick={() => goTo('community-auth')}>닉네임 정하기</button>
        </p>
      )}

      {loggedIn && loaded && tab === 'scrap' && (
        scraps.length === 0 ? (
          <p className="sy-f-ns-empty">아직 스크랩한 글이 없어요. 커뮤니티 글에서 스크랩해 보세요.</p>
        ) : (
          <div className="sy-f-ns-list">
            {scraps.map((p) => (
              <button key={p.id} type="button" className="sy-f-ns-card" onClick={() => goTo('community-post', { id: p.id })}>
                <span className="sy-f-ns-tag">{boardLabel(p.board)}</span>
                <p className="sy-f-ns-title">{p.title}</p>
                <p className="sy-f-ns-desc">{p.body}</p>
                <div className="sy-f-ns-meta">
                  <span className="sy-f-ns-author">
                    {p.author.nickname}
                    {p.author.verified && <span className="sy-chip sy-f-ns-verified"><CheckCircle2 size={11} /> 인증</span>}
                  </span>
                  <span className="sy-f-ns-stats"><Heart size={14} /> {p.likeCount}<span className="sy-f-ns-cmt">댓글 {p.commentCount}</span></span>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {loggedIn && loaded && tab === 'noti' && (
        notis.items.length === 0 ? (
          <p className="sy-f-ns-empty">새 알림이 없어요.</p>
        ) : (
          <div className="sy-f-ns-list">
            {notis.items.map((n) => (
              <button key={n.postId} type="button" className="sy-f-ns-card" onClick={() => goTo('community-post', { id: n.postId })}>
                <p className="sy-f-ns-title">{n.title}</p>
                <p className="sy-f-ns-desc">
                  {n.newComments > 0 && `댓글 ${n.newComments}개`}
                  {n.newComments > 0 && n.newLikes > 0 && ' · '}
                  {n.newLikes > 0 && `공감 ${n.newLikes}개`} 새로 달렸어요
                </p>
              </button>
            ))}
          </div>
        )
      )}

      {loggedIn && tab === 'scrap' && (
        <p className="sy-f-note">스크랩한 글은 이 기기에서 볼 수 있어요.</p>
      )}
    </div>
  );
}
