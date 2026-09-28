import { useEffect, useState } from 'react';
import {
  ChevronRight, Mail, UserRound, GraduationCap, Bookmark, ShieldCheck, ScrollText, RotateCcw,
  MessagesSquare, Pencil, MapPin,
} from 'lucide-react';
import { loadProfile, gradeOption, getHomeRegion, getMyCenterId } from '../lib/persona.js';
import { getCenter, shortName } from '../lib/centers.js';
import { getCachedUser, subscribe } from '../lib/auth.js';
import { getBadge } from '../lib/youthVerify.js';
import { unreadCount, subscribeMessages } from '../lib/messages.js';
import { isStaffDemo, setStaffDemo } from '../lib/demoRole.js';
import '../styles.v3.css';

// MY 탭 (2026-09-26 PRD v2 시연판 — 0925 회의록 「마이페이지: 설정, 개인 프로필, 개인정보동의」)
//   예전 MyPageScreen은 입시 프로필 중심이라, 탭 첫 화면은 이 간단한 화면으로 두고
//   입시 정보는 '진학' 쪽 화면(profile)으로 보낸다.

function resetEverything() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('rebridge_') || k.startsWith('rb_'))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem('rb_track_picked');
  } catch { /* 무시 */ }
  window.location.reload();
}

function Row({ Icon, title, sub, onClick, end }) {
  return (
    <button type="button" className="v3-row" onClick={onClick}>
      <span className="v3-row-ico"><Icon size={18} /></span>
      <span className="v3-row-main">
        <span className="v3-row-title">{title}</span>
        {sub && <span className="v3-row-sub">{sub}</span>}
      </span>
      <span className="v3-row-end">{end}<ChevronRight size={18} /></span>
    </button>
  );
}

export default function MyV3Screen({ goTo = () => {} }) {
  const profile = loadProfile();
  const grade = gradeOption(profile?.grade);
  const region = getHomeRegion(profile);
  const [user, setUser] = useState(() => getCachedUser());
  const [staff, setStaff] = useState(() => isStaffDemo());
  const [unread, setUnread] = useState(() => unreadCount());
  const badge = getBadge(user);

  useEffect(() => subscribe((u) => setUser(u)), []);
  useEffect(() => subscribeMessages(() => { setUnread(unreadCount()); setStaff(isStaffDemo()); }), []);

  function toggleStaff() {
    setStaffDemo(!staff);
    setStaff(!staff);
    setUser(getCachedUser());
  }

  return (
    <div className="screen v3-screen">
      <header className="v3-top root">
        <span className="v3-top-title">MY</span>
      </header>

      <div className="v3-card">
        <div className="v3-card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="v3-row-ico" style={{ width: 48, height: 48, borderRadius: 24 }}><UserRound size={24} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>
              {user?.nickname || '닉네임 없음'}
              {badge && <span className="v3-tag green" style={{ marginLeft: 6 }}>{badge.emoji} {badge.label}</span>}
            </span>
            <span className="v3-row-sub">{[grade?.label, region].filter(Boolean).join(' · ') || '학년·지역을 아직 안 골랐어요'}</span>
          </span>
          <button type="button" className="v3-btn ghost sm" onClick={() => goTo('onboarding')}>
            <Pencil size={14} /> 바꾸기
          </button>
        </div>
      </div>

      <h2 className="v3-sec-title">내 활동</h2>
      <div className="v3-list">
        <Row Icon={MapPin} title="다니는 꿈드림센터"
          sub={getMyCenterId() ? shortName(getCenter(getMyCenterId())) : '아직 안 골랐어요 — 고르면 홈이 우리 센터 화면으로 바뀌어요'}
          onClick={() => goTo('my-center')} />
        <Row Icon={Mail} title={staff ? '받은 쪽지' : '쪽지함'} onClick={() => goTo('inbox')}
          end={unread > 0 ? <span className="v3-tag green">{unread}</span> : null} />
        <Row Icon={MessagesSquare} title="커뮤니티 닉네임·인증"
          sub={user ? '닉네임 바꾸기, 꿈드림 인증코드 넣기' : '글을 쓰려면 닉네임만 정하면 돼요'}
          onClick={() => goTo('community-auth')} />
        <Row Icon={GraduationCap} title="나의 입시 정보" sub="검정고시 점수·희망 지역" onClick={() => goTo('profile')} />
        <Row Icon={Bookmark} title="관심 대학" onClick={() => goTo('saved')} />
      </div>

      <h2 className="v3-sec-title">시연</h2>
      <div className="v3-list">
        <button type="button" className="v3-row" onClick={toggleStaff} aria-pressed={staff}>
          <span className="v3-row-main">
            <span className="v3-row-title">선생님 모드로 보기</span>
            <span className="v3-row-sub">
              꿈드림 선생님 화면을 체험해요. 학생 쪽지에 답하고, 커뮤니티에 선생님으로 댓글을 달 수 있어요.
            </span>
          </span>
          <span className={`v3-switch${staff ? ' on' : ''}`} aria-hidden="true" />
        </button>
      </div>
      <p className="v3-note">실제 서비스에서는 센터가 발급한 인증코드로 선생님을 확인해요.</p>

      <h2 className="v3-sec-title">개인정보</h2>
      <div className="v3-card">
        <div className="v3-card-body" style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--v3-ink-2)' }}>
          TalkDream은 이름·전화번호·주민번호를 받지 않아요. 학년·지역·점수처럼 직접 고른 정보는 이 기기에만 저장돼요.
          위치는 가까운 센터를 찾을 때만 쓰고 저장하지 않아요.
        </div>
      </div>
      <div className="v3-list" style={{ marginTop: 10 }}>
        <Row Icon={ShieldCheck} title="개인정보처리방침" onClick={() => goTo('privacy')} />
        <Row Icon={ScrollText} title="이용약관" onClick={() => goTo('terms')} />
        <button type="button" className="v3-row" onClick={() => {
          if (window.confirm('이 기기에 저장된 정보(프로필·쪽지·관심 대학·커뮤니티 글)를 모두 지우고 처음부터 시작할까요?')) resetEverything();
        }}>
          <span className="v3-row-ico"><RotateCcw size={18} /></span>
          <span className="v3-row-main"><span className="v3-row-title">처음부터 다시 하기</span></span>
        </button>
      </div>
    </div>
  );
}
