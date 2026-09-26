import { useEffect, useMemo, useState } from 'react';
import {
  Search, X, Mail, Navigation, ChevronRight, ChevronDown, Phone,
  HeartHandshake, GraduationCap, School, Compass, Users, Activity,
} from 'lucide-react';
import { DREAM_ABOUT, DREAM_SERVICES } from '../data/dreamServices.js';
import {
  REGIONS, REGION_COUNT, filterCenters, shortName, centerMark, distLabel, locationAllowed, requestPosition,
} from '../lib/centers.js';
import { getHomeRegion } from '../lib/persona.js';
import { COMMON_SUPPORT } from '../data/commonSupport.js';
import { subscribeMessages, unreadCount, getDemoRole } from '../lib/messages.js';
import '../styles.v3.css';

// 꿈드림 탭 첫 화면 (PRD v2 F1·F4 — 2026-09-26 시연판)
//   ① 꿈드림이 뭘 하는 곳인지 한 문장 → ② 센터 찾기(지역·검색·내 주변) → ③ 누구나 받을 수 있는 지원
//   0619 영등포 꿈드림 인터뷰: "학교가 힘들어 나온 친구들은 쉬고 싶어 한다", "로그인 없이 정보를 보는 게 좋다"
//   → 재촉하는 말투를 쓰지 않고, 로그인 없이 전부 볼 수 있게 둔다.
//   위치는 처음부터 묻지 않는다(예전 화면은 들어오자마자 동의 창을 띄웠다). '내 주변' 칩을 누를 때만.

const PAGE = 15;
const SVC_ICONS = { HeartHandshake, GraduationCap, School, Compass, Users, Activity };

export default function CentersScreen({ goTo = () => {}, params = {} }) {
  const [region, setRegion] = useState(() => {
    const r = getHomeRegion();
    return REGIONS.includes(r) ? r : '서울';
  });
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);
  const [locState, setLocState] = useState('idle'); // idle | loading | on | denied
  const [shown, setShown] = useState(PAGE);
  const [openSupport, setOpenSupport] = useState(params.supportId || null);
  const [unread, setUnread] = useState(() => unreadCount());
  const staff = getDemoRole() === 'staff';

  useEffect(() => subscribeMessages(() => setUnread(unreadCount())), []);

  // 전에 위치를 허락했으면 조용히 다시 받아 가까운 순으로 보여준다.
  useEffect(() => {
    if (!locationAllowed()) return;
    setLocState('loading');
    requestPosition().then((p) => {
      if (p) { setPos(p); setLocState('on'); } else setLocState('idle');
    });
  }, []);

  async function toggleNear() {
    if (locState === 'on') { setPos(null); setLocState('idle'); return; }
    setLocState('loading');
    const p = await requestPosition();
    if (p) { setPos(p); setLocState('on'); setShown(PAGE); } else setLocState('denied');
  }

  const list = useMemo(
    () => filterCenters({ region: locState === 'on' ? null : region, query, pos }),
    [region, query, pos, locState],
  );

  return (
    <div className="screen v3-screen">
      <header className="v3-top root">
        <span className="v3-top-title">꿈드림</span>
        <button className="v3-icon-btn" aria-label="꿈드림 쪽지함" onClick={() => goTo('inbox')}>
          <Mail size={22} />
          {unread > 0 && <span className="v3-dot">{unread}</span>}
        </button>
      </header>

      {staff && (
        <button type="button" className="v3-banner green" style={{ textAlign: 'left' }} onClick={() => goTo('inbox')}>
          <Mail size={16} />
          <span>지금은 <b>선생님 모드</b>예요. 학생이 보낸 쪽지는 쪽지함에서 답할 수 있어요.</span>
        </button>
      )}

      {/* 꿈드림이 어떤 곳인지 먼저 (2026-09-26 2차 — 동근님: 꿈드림을 더 강조) */}
      <section className="v3-dream-hero" style={{ marginTop: staff ? 12 : 2 }}>
        <span className="v3-dream-logo" aria-hidden="true">꿈드림</span>
        <h1 className="v3-dream-hero-title">공부·진로·상담까지<br />무료로 도와주는 곳</h1>
        <p className="v3-dream-hero-sub">
          학교를 그만뒀거나 다니지 않는 만 9~24세라면 누구나 쓸 수 있는 공공 지원센터예요.
        </p>
        <div className="v3-dream-facts">
          <span><b>{Object.values(REGION_COUNT).reduce((a, b) => a + b, 0)}곳</b>전국 센터</span>
          <span><b>{DREAM_ABOUT.age}</b>이용 나이</span>
          <span><b>무료</b>이용 비용</span>
        </div>
        <button type="button" className="v3-btn block" onClick={() => goTo('about-dream')}>
          꿈드림이 뭐 하는 곳인지 자세히 보기
        </button>
      </section>

      <h2 className="v3-sec-title">
        꿈드림에서 받을 수 있는 것
        <small>센터마다 달라요</small>
      </h2>
      <div className="v3-svc-grid">
        {DREAM_SERVICES.map((s) => {
          const Icon = SVC_ICONS[s.icon];
          return (
            <button key={s.id} type="button" className="v3-svc" onClick={() => goTo('about-dream', { open: s.id })}>
              {Icon && <Icon size={20} />}
              <b>{s.title}</b>
              <span>{s.short}</span>
            </button>
          );
        })}
      </div>

      <h2 className="v3-sec-title">
        내 근처 꿈드림 찾기
        <small>전화·쪽지로 바로 연결</small>
      </h2>

      <label className="v3-search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          placeholder="구 이름이나 센터 이름"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
        />
        {query && (
          <button type="button" className="v3-icon-btn" style={{ width: 28, height: 28 }} aria-label="지우기" onClick={() => setQuery('')}>
            <X size={15} />
          </button>
        )}
      </label>

      <div className="v3-chips" style={{ marginTop: 10 }}>
        <button
          type="button"
          className={`v3-chip${locState === 'on' ? ' on' : ''}`}
          onClick={toggleNear}
          aria-pressed={locState === 'on'}
        >
          <Navigation size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {locState === 'loading' ? '찾는 중…' : '내 주변'}
        </button>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            className={`v3-chip${locState !== 'on' && region === r ? ' on' : ''}`}
            onClick={() => { setRegion(r); setPos(null); setLocState('idle'); setShown(PAGE); }}
          >
            {r} {REGION_COUNT[r]}
          </button>
        ))}
      </div>
      {locState === 'denied' && (
        <p className="v3-note">위치를 받지 못했어요. 지역을 골라서 찾아 주세요. 위치는 이 기기 밖으로 보내지 않아요.</p>
      )}

      <div className="v3-list" style={{ marginTop: 12 }}>
        {list.length === 0 && (
          <div className="v3-empty"><b>찾는 센터가 없어요</b>다른 지역을 고르거나 검색어를 바꿔 보세요.</div>
        )}
        {list.slice(0, shown).map((c) => (
          <button key={c.id} type="button" className="v3-row" onClick={() => goTo('center', { centerId: c.id })}>
            <span className="v3-cav" aria-hidden="true">{centerMark(c)}</span>
            <span className="v3-row-main">
              <span className="v3-row-title">{shortName(c)}</span>
              <span className="v3-row-sub clamp">{c.address}</span>
            </span>
            <span className="v3-row-end">
              {c._dist != null && Number.isFinite(c._dist) && distLabel(c._dist)}
              <ChevronRight size={18} />
            </span>
          </button>
        ))}
        {list.length > shown && (
          <button type="button" className="v3-row" style={{ justifyContent: 'center', color: 'var(--v3-ink-2)', fontWeight: 600 }} onClick={() => setShown((n) => n + PAGE)}>
            {list.length - shown}곳 더 보기 <ChevronDown size={16} />
          </button>
        )}
      </div>

      <h2 className="v3-sec-title">누구나 받을 수 있는 지원</h2>
      <div className="v3-list">
        {COMMON_SUPPORT.map((s) => {
          const open = openSupport === s.id;
          return (
            <div key={s.id}>
              <button
                type="button"
                className="v3-row"
                aria-expanded={open}
                onClick={() => setOpenSupport(open ? null : s.id)}
                style={s === COMMON_SUPPORT[0] ? { borderTop: 'none' } : undefined}
              >
                <span className="v3-row-main">
                  <span className="v3-row-title">
                    {s.title}{' '}
                    <span className={`v3-tag${s.status === 'check' ? ' warn' : ' green'}`}>
                      {s.status === 'check' ? '지역마다 달라요' : '전국 공통'}
                    </span>
                  </span>
                  <span className="v3-row-sub">{s.short}</span>
                </span>
                <span className="v3-row-end">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
              </button>
              {open && (
                <div style={{ padding: '0 16px 16px', fontSize: 14.5, lineHeight: 1.65, color: 'var(--v3-ink-2)' }}>
                  <p style={{ margin: 0 }}>{s.detail}</p>
                  {s.action?.tel && (
                    <a className="v3-btn soft sm" style={{ marginTop: 12 }} href={`tel:${s.action.tel}`}>
                      <Phone size={15} /> {s.action.label}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="v3-note">
        센터 주소·전화: 여성가족부 2025 학교밖청소년지원센터 주소록 · 홈페이지: 한국청소년상담복지개발원 전국 꿈드림 센터(2025-09-03).
        센터별 프로그램은 바뀔 수 있어요.
      </p>
    </div>
  );
}
