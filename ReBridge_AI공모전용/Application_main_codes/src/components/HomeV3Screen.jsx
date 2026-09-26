import { useEffect, useState } from 'react';
import {
  Mail, Phone, ChevronRight, HeartHandshake, GraduationCap, Compass, Users, Activity, School,
} from 'lucide-react';
import { loadProfile, gradeOption, getHomeRegion, setHomeRegion } from '../lib/persona.js';
import { suggestedCenter, shortName, centerMark, getCenter, REGIONS } from '../lib/centers.js';
import { DREAM_SERVICES } from '../data/dreamServices.js';
import { gradeRoadmap } from '../lib/roadmap.js';
import { getBookmarks } from '../lib/bookmarks.js';
import { listThreads, subscribeMessages, unreadCount, timeLabel } from '../lib/messages.js';
import { listPosts, boardLabel } from '../lib/community.js';
import '../styles.v3.css';

// 홈 (PRD v2 — 2026-09-26 동근님: 센터 중심으로)
//   맨 위는 '내 가까운 꿈드림' 한 곳과 전화·쪽지. 진학·커뮤니티는 그 아래 한 줄씩(부가 기능).
//   대학 이야기로 시작하지 않는다 — 학교 밖 청소년 전체(9~24세)가 대상이고, 대입은 그중 일부다.

const ICONS = { HeartHandshake, GraduationCap, School, Compass, Users, Activity };

export default function HomeV3Screen({ goTo = () => {} }) {
  const [profile, setProfile] = useState(() => loadProfile());
  const region = getHomeRegion(profile);
  const grade = gradeOption(profile?.grade);
  const center = suggestedCenter(region);
  const rm = gradeRoadmap(profile, getBookmarks().length);
  const [threads, setThreads] = useState(() => listThreads());
  const [unread, setUnread] = useState(() => unreadCount());
  const [posts, setPosts] = useState([]);

  useEffect(() => subscribeMessages(() => { setThreads(listThreads()); setUnread(unreadCount()); }), []);
  useEffect(() => {
    let alive = true;
    listPosts({ board: 'hot', limit: 3 }).then((r) => { if (alive) setPosts(r.items || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const latest = threads[0];

  return (
    <div className="screen v3-screen">
      <header className="v3-top root">
        <span className="v3-top-title" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>TalkDream</span>
        <button className="v3-icon-btn" aria-label="쪽지함" onClick={() => goTo('inbox')}>
          <Mail size={22} />
          {unread > 0 && <span className="v3-dot">{unread}</span>}
        </button>
      </header>

      <div className="v3-pad" style={{ paddingTop: 4 }}>
        <p className="v3-eyebrow">{[grade?.label, region].filter(Boolean).join(' · ') || '반가워요'}</p>
        <h1 className="v3-h1">혼자 알아보기 막막할 땐<br /><span className="v3-mark">가까운 꿈드림</span>에 물어봐요</h1>
      </div>

      {/* 내 가까운 센터 */}
      <div className="v3-card" style={{ marginTop: 14 }}>
        <div className="v3-card-body">
          {center ? (
            <>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="v3-dream-logo" style={{ background: 'var(--v3-green)', color: '#fff', height: 22, fontSize: 12 }}>꿈드림</span>
                <span className="v3-tag">{region}에서 가까운 센터</span>
              </span>
              <p className="v3-near-name">{shortName(center)}</p>
              <p className="v3-near-meta">{center.address}</p>
              <div className="v3-near-actions">
                <a className="v3-btn ghost" href={`tel:${center.phone}`}><Phone size={16} /> 전화</a>
                <button type="button" className="v3-btn" onClick={() => goTo('thread', { centerId: center.id })}>
                  <Mail size={16} /> 선생님께 쪽지
                </button>
              </div>
              <button type="button" className="v3-sec-more" style={{ marginTop: 12 }} onClick={() => goTo('center', { centerId: center.id })}>
                센터에서 뭘 하는지 보기 ›
              </button>
            </>
          ) : (
            <>
              <p className="v3-near-name" style={{ marginTop: 0 }}>어디에 살아요?</p>
              <p className="v3-near-meta">지역을 고르면 가까운 꿈드림센터를 바로 보여 줄게요.</p>
              <div className="v3-chips" style={{ padding: 0, flexWrap: 'wrap' }}>
                {REGIONS.map((r) => (
                  <button key={r} type="button" className="v3-chip" onClick={() => setProfile(setHomeRegion(r))}>{r}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {latest && (
        <>
          <h2 className="v3-sec-title">
            꿈드림 쪽지
            <button type="button" className="v3-sec-more" onClick={() => goTo('inbox')}>쪽지함 ›</button>
          </h2>
          <div className="v3-list">
            <button type="button" className="v3-row" onClick={() => goTo('thread', { centerId: latest.centerId })}>
              <span className="v3-cav" aria-hidden="true">{centerMark(getCenter(latest.centerId))}</span>
              <span className="v3-row-main">
                <span className="v3-row-title">{latest.centerName}</span>
                <span className="v3-row-sub clamp">
                  {latest.messages.at(-1)?.from === 'staff' ? '선생님: ' : '나: '}{latest.messages.at(-1)?.body}
                </span>
              </span>
              <span className="v3-row-end">
                {!latest.readByStudent ? <span className="v3-tag green">새 답장</span> : timeLabel(latest.updatedAt)}
              </span>
            </button>
          </div>
        </>
      )}

      <h2 className="v3-sec-title">
        꿈드림에선 이런 걸 해요
        <button type="button" className="v3-sec-more" onClick={() => goTo('about-dream')}>꿈드림이 뭐예요? ›</button>
      </h2>
      <div className="v3-hscroll">
        {DREAM_SERVICES.map((sv) => {
          const Icon = ICONS[sv.icon];
          return (
            <button key={sv.id} type="button" className="v3-help-item" onClick={() => goTo('about-dream', { open: sv.id })}>
              {Icon && <Icon size={20} />}
              <b>{sv.title}</b>
              <span>{sv.short}</span>
            </button>
          );
        })}
      </div>

      <h2 className="v3-sec-title">진학 준비</h2>
      <div className="v3-list">
        <button type="button" className="v3-row" onClick={() => goTo('univ-home')}>
          <span className="v3-row-ico"><GraduationCap size={18} /></span>
          <span className="v3-row-main">
            <span className="v3-row-title">{rm.headline}</span>
            <span className="v3-row-sub">
              {rm.nearest ? `${rm.nearest.label} ${rm.nearest.dday || rm.nearest.text || ''}` : '검정고시부터 원서까지 순서대로'}
            </span>
          </span>
          <ChevronRight size={18} className="v3-row-end" />
        </button>
      </div>

      <h2 className="v3-sec-title">
        커뮤니티
        <button type="button" className="v3-sec-more" onClick={() => goTo('community')}>더 보기 ›</button>
      </h2>
      <div className="v3-list">
        {posts.length === 0 && <div className="v3-empty">아직 글이 없어요.</div>}
        {posts.map((p) => (
          <button key={p.id} type="button" className="v3-row" onClick={() => goTo('community-post', { id: p.id })}>
            <span className="v3-row-main">
              <span className="v3-row-title" style={{ fontWeight: 500 }}>{p.title}</span>
              <span className="v3-row-sub">{boardLabel(p.board)} · 댓글 {p.commentCount}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
