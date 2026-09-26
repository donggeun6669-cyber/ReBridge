import { useEffect, useState } from 'react';
import {
  Mail, Phone, Megaphone, MapPin, ChevronRight, BookOpen, Calculator, Search, FileText,
  Bookmark, HelpCircle, School, Heart, MessageCircle, LayoutGrid,
} from 'lucide-react';
import { loadProfile, getHomeRegion, setHomeRegion, getMyCenterId } from '../lib/persona.js';
import { getCenter, suggestedCenter, shortName, centerMark, REGIONS } from '../lib/centers.js';
import { gradeRoadmap } from '../lib/roadmap.js';
import { getBookmarks } from '../lib/bookmarks.js';
import { threadForCenter, subscribeMessages, unreadCount, timeLabel } from '../lib/messages.js';
import { listPosts, timeAgo, BOARDS } from '../lib/community.js';
import { getCachedUser, subscribe } from '../lib/auth.js';
import '../styles.v3.css';

// 홈 (2026-09-26 3차 — 동근님: "에브리타임 화면 참고, 더 직관적으로")
//   ① 꿈드림 카드 — 다니는 센터가 있으면 '우리 센터', 없으면 '가까운 꿈드림' (비중 2)
//   ② 진학 준비 — 에타 위쪽 바로가기처럼 큰 아이콘 (비중 1)
//   ③ 게시판 — 에타 '즐겨찾는 게시판'처럼 게시판마다 최신 글 한 줄 (비중 1)
//   ④ HOT 게시물 — 제목·미리보기·공감·댓글
//   위쪽 인사·학년·설명 문구는 뺐다(동근님: "쓸데없는 문구 다 빼, 간략하게").
//   '센터에 물어보면 좋은 것'은 센터 상세(꿈드림 칸)로 옮겼다.

const UNIV_ICONS = [
  { id: 'ged',    label: '검정고시',   Icon: BookOpen,   screen: 'ged-guide' },
  { id: 'score',  label: '내 점수',    Icon: Calculator, screen: 'results' },
  { id: 'univ',   label: '대학 찾기',  Icon: Search,     screen: 'univ-explore' },
  { id: 'apply',  label: '원서·서류',  Icon: FileText,   screen: 'roadmap' },
  { id: 'saved',  label: '관심 대학',  Icon: Bookmark,   screen: 'saved' },
  { id: 'help',   label: '물어보기',   Icon: HelpCircle, screen: 'help' },
  { id: 'record', label: '생활기록부', Icon: School,     screen: 'about-dream', params: { open: 'college' } },
  { id: 'all',    label: '진학 전체',  Icon: LayoutGrid, screen: 'univ-home' },
];

export default function HomeV3Screen({ goTo = () => {} }) {
  const [profile, setProfile] = useState(() => loadProfile());
  const myCenterId = getMyCenterId(profile);
  const rm = gradeRoadmap(profile, getBookmarks().length);
  const [unread, setUnread] = useState(() => unreadCount());
  const [user, setUser] = useState(() => getCachedUser());
  const [boards, setBoards] = useState([]);
  const [hot, setHot] = useState([]);

  useEffect(() => subscribeMessages(() => setUnread(unreadCount())), []);
  useEffect(() => subscribe((u) => setUser(u)), []);

  // 게시판별 최신 글 1개 + HOT 4개. 인증한 사람은 '우리 센터' 게시판을 맨 위에.
  useEffect(() => {
    let alive = true;
    const list = [
      ...(user?.verified ? [{ id: 'center', label: '우리 센터' }] : []),
      ...BOARDS.filter((b) => !b.virtual).map((b) => ({ id: b.id, label: b.label })),
    ];
    Promise.all(list.map((b) => listPosts({ board: b.id, limit: 1 }).then((r) => ({ ...b, post: r.items?.[0] || null }))))
      .then((rows) => { if (alive) setBoards(rows); }).catch(() => {});
    listPosts({ board: 'hot', limit: 4 }).then((r) => { if (alive) setHot(r.items || []); }).catch(() => {});
    return () => { alive = false; };
  }, [user?.verified]);

  const stepOf = (id) => rm.steps.find((s) => s.id === id);
  const hasScore = profile?.gedAvg != null;
  const center = myCenterId ? getCenter(myCenterId) : null;

  return (
    <div className="screen v3-screen">
      <header className="v3-top root">
        <span className="v3-top-title" style={{ fontSize: 19, letterSpacing: '-0.03em' }}>TalkDream</span>
        <button className="v3-icon-btn" aria-label="꿈드림 쪽지함" onClick={() => goTo('inbox')}>
          <Mail size={22} />
          {unread > 0 && <span className="v3-dot">{unread}</span>}
        </button>
      </header>

      {/* ① 꿈드림 */}
      {center
        ? <MyCenterCard center={center} goTo={goTo} />
        : <NearCenterCard profile={profile} onRegion={(r) => setProfile(setHomeRegion(r))} goTo={goTo} />}

      {/* ② 진학 준비 — 큰 아이콘 */}
      <section className="v3-et-card">
        <div className="v3-et-head">
          <b>진학 준비</b>
          <span className="v3-et-sub">{rm.headline}</span>
        </div>
        <div className="v3-et-icons">
          {UNIV_ICONS.map((it) => {
            const st = stepOf(it.id);
            const target = it.id === 'score' && !hasScore ? 'profile' : it.screen;
            return (
              <button key={it.id} type="button" className="v3-et-icon" onClick={() => goTo(target, it.params || {})}>
                <span className={`v3-et-icon-box${st?.status === 'current' ? ' now' : ''}`}>
                  <it.Icon size={24} strokeWidth={1.9} />
                  {st?.status === 'current' && <i>지금</i>}
                </span>
                <span className="v3-et-icon-label">{it.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ③ 게시판 — 에타 '즐겨찾는 게시판' */}
      <section className="v3-et-card">
        <div className="v3-et-head">
          <b>게시판</b>
          <button type="button" className="v3-et-more" onClick={() => goTo('community')}>더 보기</button>
        </div>
        {boards.map((b) => (
          <button key={b.id} type="button" className="v3-et-board" onClick={() => goTo('community', { board: b.id })}>
            <span className="v3-et-board-name">{b.label}</span>
            <span className="v3-et-board-title">{b.post ? b.post.title : '아직 글이 없어요'}</span>
            {b.post && Date.now() - b.post.createdAt < 1000 * 60 * 60 * 3 && <span className="v3-et-new">N</span>}
          </button>
        ))}
        {!user?.verified && boards.length > 0 && (
          <button type="button" className="v3-et-board lock" onClick={() => goTo('community-auth')}>
            <span className="v3-et-board-name">우리 센터</span>
            <span className="v3-et-board-title">센터 인증코드를 넣으면 열려요</span>
          </button>
        )}
      </section>

      {/* ④ HOT 게시물 */}
      <section className="v3-et-card">
        <div className="v3-et-head">
          <b>HOT 게시물</b>
          <button type="button" className="v3-et-more" onClick={() => goTo('community', { board: 'hot' })}>더 보기</button>
        </div>
        {hot.length === 0 && <div className="v3-empty">아직 인기 글이 없어요.</div>}
        {hot.map((p) => (
          <button key={p.id} type="button" className="v3-et-post" onClick={() => goTo('community-post', { id: p.id })}>
            <span className="v3-et-post-title">{p.title}</span>
            <span className="v3-et-post-body">{p.body}</span>
            <span className="v3-et-post-meta">
              <span>{timeAgo(p.createdAt)} · {p.author?.nickname || '익명'}</span>
              <span className="v3-et-counts">
                <span className="like"><Heart size={12} /> {p.likeCount}</span>
                <span className="cmt"><MessageCircle size={12} /> {p.commentCount}</span>
              </span>
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}

// 다니는 센터가 있을 때 — '우리 센터'
function MyCenterCard({ center: c, goTo }) {
  const [thread, setThread] = useState(() => threadForCenter(c.id));
  useEffect(() => subscribeMessages(() => setThread(threadForCenter(c.id))), [c.id]);
  const last = thread?.messages.at(-1);

  return (
    <section className="v3-dream-hero" style={{ marginTop: 2, paddingBottom: 16 }}>
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
      <button type="button" className="v3-mycenter-msg" onClick={() => goTo('thread', { centerId: c.id })}>
        <Mail size={16} />
        <span style={{ flex: 1, minWidth: 0 }}>
          {last ? (
            <><b>{last.from === 'staff' ? '선생님 답장' : '내가 보낸 쪽지'}</b><span className="clamp">{last.body}</span></>
          ) : (
            <><b>선생님께 쪽지 보내기</b><span className="clamp">센터에서 못 물어본 것, 여기서 편하게</span></>
          )}
        </span>
        {last && !thread.readByStudent
          ? <span className="v3-tag" style={{ background: '#fff', color: 'var(--v3-green)' }}>새 답장</span>
          : last ? <span style={{ fontSize: 12, opacity: 0.8 }}>{timeLabel(last.at)}</span> : <ChevronRight size={16} />}
      </button>
      <div className="v3-btn-row" style={{ marginTop: 10 }}>
        <a className="v3-btn sm v3-btn-onhero" href={`tel:${c.phone}`}><Phone size={15} /> 전화</a>
        <button type="button" className="v3-btn sm v3-btn-onhero" onClick={() => goTo('center', { centerId: c.id })}>
          <Megaphone size={15} /> 프로그램·소식
        </button>
      </div>
    </section>
  );
}

// 아직 다니는 센터가 없을 때 — '가까운 꿈드림'
function NearCenterCard({ profile, onRegion, goTo }) {
  const region = getHomeRegion(profile);
  const c = suggestedCenter(region);

  if (!c) {
    return (
      <section className="v3-dream-hero" style={{ marginTop: 2 }}>
        <span className="v3-dream-logo">꿈드림</span>
        <p style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 4px' }}>어디에 살아요?</p>
        <p style={{ fontSize: 13.5, margin: '0 0 12px', color: 'rgba(255,255,255,0.8)' }}>가까운 꿈드림센터를 바로 보여 줄게요.</p>
        <div className="v3-chips" style={{ padding: 0, flexWrap: 'wrap', rowGap: 6 }}>
          {REGIONS.map((r) => (
            <button key={r} type="button" className="v3-chip v3-chip-onhero" onClick={() => onRegion(r)}>{r}</button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="v3-dream-hero" style={{ marginTop: 2, paddingBottom: 16 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="v3-cav" style={{ background: '#fff', color: 'var(--v3-green)' }} aria-hidden="true">{centerMark(c)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{region}에서 가까운 꿈드림</span>
          <span style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{shortName(c)}</span>
        </span>
        <button type="button" className="v3-icon-btn" style={{ color: '#fff' }} aria-label="센터 정보" onClick={() => goTo('center', { centerId: c.id })}>
          <MapPin size={19} />
        </button>
      </span>
      <div className="v3-btn-row" style={{ marginTop: 14 }}>
        <a className="v3-btn sm v3-btn-onhero" href={`tel:${c.phone}`}><Phone size={15} /> 전화</a>
        <button type="button" className="v3-btn sm" style={{ background: '#fff', color: 'var(--v3-green)' }} onClick={() => goTo('thread', { centerId: c.id })}>
          <Mail size={15} /> 선생님께 쪽지
        </button>
      </div>
      <span style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button type="button" className="v3-link-onhero" onClick={() => goTo('about-dream')}>꿈드림이 뭐예요? ›</button>
        <button type="button" className="v3-link-onhero" onClick={() => goTo('my-center')}>이미 다니고 있어요 ›</button>
      </span>
    </section>
  );
}
