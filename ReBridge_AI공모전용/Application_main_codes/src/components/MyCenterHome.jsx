import { useEffect, useState } from 'react';
import {
  Mail, Phone, Megaphone, ChevronRight, ExternalLink, GraduationCap, FileText, MessagesSquare,
  ShieldCheck, MapPin,
} from 'lucide-react';
import { loadProfile, gradeOption } from '../lib/persona.js';
import { getCenter, shortName, centerMark } from '../lib/centers.js';
import { gradeRoadmap } from '../lib/roadmap.js';
import { getBookmarks } from '../lib/bookmarks.js';
import { threadForCenter, subscribeMessages, unreadCount, timeLabel } from '../lib/messages.js';
import { listPosts, boardLabel } from '../lib/community.js';
import { getCachedUser, subscribe } from '../lib/auth.js';
import '../styles.v3.css';

// '우리 센터' 홈 — 이미 꿈드림을 다니는 아이용 (2026-09-26 동근님·요셉형 대화)
//   동근님: "너무 '꿈드림 가 보세요!'로 끝나면 꿈드림에 가면? 이후의 내용이 없다"
//   요셉형: "꿈드림이 핵심이지만 2:1:1 정도의 중요성" → 우리 센터(2) : 진학(1) : 커뮤니티(1)
//   새 기능을 만들지 않고, 있는 기능(쪽지·프로그램 링크·진학·커뮤니티)을 '다니는 아이' 눈높이로 묶는다.
//
//   '센터에 물어보면 좋은 것'은 data/dreamServices.js(여성가족부 안내서)에 있는 지원만 쓴다.
//   누르면 쪽지 입력칸에 문장이 채워진다 — 정보를 읽는 데서 끝나지 않고 선생님께 이어지게.

const ASK = [
  { id: 'record', label: '청소년생활기록부', draft: '대학 수시에 낼 청소년생활기록부를 발급받고 싶어요. 어떻게 신청하면 되나요?' },
  { id: 'ged', label: '검정고시 대비반·교재', draft: '검정고시 대비반이나 교재 지원을 받을 수 있을까요?' },
  { id: 'college', label: '대학 진학 상담', draft: '대학 진학 상담을 받고 싶어요. 제 점수로 어디를 볼 수 있을지 같이 봐 주실 수 있나요?' },
  { id: 'career', label: '진로·직업체험', draft: '요즘 하는 진로·직업체험 프로그램이 있을까요?' },
  { id: 'health', label: '무료 건강검진', draft: '학교 밖 청소년 무료 건강검진을 받고 싶어요. 어떻게 신청하나요?' },
];

export default function MyCenterHome({ centerId, goTo = () => {} }) {
  const c = getCenter(centerId);
  const profile = loadProfile();
  const grade = gradeOption(profile?.grade);
  const rm = gradeRoadmap(profile, getBookmarks().length);
  const [thread, setThread] = useState(() => threadForCenter(centerId));
  const [unread, setUnread] = useState(() => unreadCount());
  const [user, setUser] = useState(() => getCachedUser());
  const [posts, setPosts] = useState([]);

  useEffect(() => subscribeMessages(() => { setThread(threadForCenter(centerId)); setUnread(unreadCount()); }), [centerId]);
  useEffect(() => subscribe((u) => setUser(u)), []);
  useEffect(() => {
    let alive = true;
    // 인증한 사람은 '우리 센터' 게시판, 아니면 '꿈드림 후기' 게시판
    const board = user?.verified ? 'center' : 'review';
    listPosts({ board, limit: 3 }).then((r) => { if (alive) setPosts(r.items || []); }).catch(() => {});
    return () => { alive = false; };
  }, [user?.verified]);

  if (!c) return null;
  const last = thread?.messages.at(-1);
  const links = c.programs?.links || [];

  return (
    <div className="screen v3-screen">
      <header className="v3-top root">
        <span className="v3-top-title" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>TalkDream</span>
        <button className="v3-icon-btn" aria-label="꿈드림 쪽지함" onClick={() => goTo('inbox')}>
          <Mail size={22} />
          {unread > 0 && <span className="v3-dot">{unread}</span>}
        </button>
      </header>

      <div className="v3-pad" style={{ paddingTop: 4 }}>
        <p className="v3-eyebrow">{[grade?.label, `${shortName(c)} 다니는 중`].filter(Boolean).join(' · ')}</p>
        <h1 className="v3-h1">센터 다니면서<br /><span className="v3-mark">진학까지</span> 같이 챙겨요</h1>
      </div>

      {/* ① 우리 센터 (비중 2) */}
      <section className="v3-dream-hero" style={{ marginTop: 12, paddingBottom: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="v3-cav" style={{ background: '#fff', color: 'var(--v3-green)' }} aria-hidden="true">{centerMark(c)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>우리 센터</span>
            <span style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{shortName(c)}</span>
          </span>
          <button type="button" className="v3-icon-btn" style={{ color: '#fff' }} aria-label="센터 정보" onClick={() => goTo('center', { centerId: c.id })}>
            <MapPin size={19} />
          </button>
        </span>

        {/* 선생님과의 쪽지 — 있으면 마지막 한 줄, 없으면 첫 쪽지 권유 */}
        <button
          type="button"
          className="v3-mycenter-msg"
          onClick={() => goTo('thread', { centerId: c.id })}
        >
          <Mail size={16} />
          <span style={{ flex: 1, minWidth: 0 }}>
            {last ? (
              <>
                <b>{last.from === 'staff' ? '선생님 답장' : '내가 보낸 쪽지'}</b>
                <span className="clamp">{last.body}</span>
              </>
            ) : (
              <>
                <b>선생님께 쪽지 보내기</b>
                <span className="clamp">센터에서 못 물어본 것, 여기서 편하게 물어봐요</span>
              </>
            )}
          </span>
          {last && !thread.readByStudent ? <span className="v3-tag" style={{ background: '#fff', color: 'var(--v3-green)' }}>새 답장</span>
            : last ? <span style={{ fontSize: 12, opacity: 0.8 }}>{timeLabel(last.at)}</span> : <ChevronRight size={16} />}
        </button>

        <div className="v3-btn-row" style={{ marginTop: 10 }}>
          <a className="v3-btn sm v3-btn-onhero" href={`tel:${c.phone}`}><Phone size={15} /> 전화</a>
          <button type="button" className="v3-btn sm v3-btn-onhero" onClick={() => goTo('center', { centerId: c.id })}>
            <Megaphone size={15} /> 프로그램·소식
          </button>
        </div>
      </section>

      {links.length > 0 && (
        <>
          <h2 className="v3-sec-title">
            우리 센터 소식
            <small>센터 누리집으로 이동</small>
          </h2>
          <div className="v3-list">
            {links.slice(0, 2).map((l) => (
              <a key={l.url} className="v3-row" href={l.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <span className="v3-row-ico green"><Megaphone size={17} /></span>
                <span className="v3-row-main"><span className="v3-row-title">{l.label}</span></span>
                <ExternalLink size={16} className="v3-row-end" />
              </a>
            ))}
          </div>
        </>
      )}

      <h2 className="v3-sec-title">
        센터에 물어보면 좋은 것
        <small>누르면 쪽지로 이어져요</small>
      </h2>
      <div className="v3-chips" style={{ flexWrap: 'wrap', rowGap: 8 }}>
        {ASK.map((a) => (
          <button key={a.id} type="button" className="v3-chip" onClick={() => goTo('thread', { centerId: c.id, draft: a.draft })}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ② 진학 (비중 1) */}
      <h2 className="v3-sec-title">진학 준비</h2>
      <div className="v3-list">
        <button type="button" className="v3-row" onClick={() => goTo('univ-home')}>
          <span className="v3-row-ico green"><GraduationCap size={18} /></span>
          <span className="v3-row-main">
            <span className="v3-row-title">{rm.headline}</span>
            <span className="v3-row-sub">진학 상담 때 이 화면을 선생님께 보여 주세요</span>
          </span>
          <ChevronRight size={18} className="v3-row-end" />
        </button>
        <button type="button" className="v3-row" onClick={() => goTo('about-dream', { open: 'college' })}>
          <span className="v3-row-ico"><FileText size={18} /></span>
          <span className="v3-row-main">
            <span className="v3-row-title">꿈드림에서 대학 가기</span>
            <span className="v3-row-sub">청소년생활기록부 · 대학입시설명회</span>
          </span>
          <ChevronRight size={18} className="v3-row-end" />
        </button>
      </div>

      {/* ③ 커뮤니티 (비중 1) */}
      <h2 className="v3-sec-title">
        {user?.verified ? '우리 센터 친구들' : '꿈드림 다니는 친구들'}
        <button type="button" className="v3-sec-more" onClick={() => goTo('community')}>더 보기 ›</button>
      </h2>
      {!user?.verified && (
        <button type="button" className="v3-banner green" style={{ width: 'calc(100% - 32px)', textAlign: 'left', marginBottom: 10 }} onClick={() => goTo('community-auth')}>
          <ShieldCheck size={16} />
          <span style={{ flex: 1 }}>센터 선생님께 <b>인증코드</b>를 받아 넣으면 🎖️ 배지와 <b>우리 센터 게시판</b>이 열려요.</span>
          <ChevronRight size={16} />
        </button>
      )}
      <div className="v3-list">
        {posts.length === 0 && <div className="v3-empty">아직 글이 없어요. 첫 글을 남겨 보세요.</div>}
        {posts.map((p) => (
          <button key={p.id} type="button" className="v3-row" onClick={() => goTo('community-post', { id: p.id })}>
            <span className="v3-row-ico"><MessagesSquare size={17} /></span>
            <span className="v3-row-main">
              <span className="v3-row-title" style={{ fontWeight: 500 }}>{p.title}</span>
              <span className="v3-row-sub">{boardLabel(p.board)} · 댓글 {p.commentCount}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="v3-note">
        다니는 센터가 바뀌었다면 MY → 다니는 꿈드림센터에서 바꿀 수 있어요.
      </p>
    </div>
  );
}
