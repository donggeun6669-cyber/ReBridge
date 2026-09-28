// 마이페이지 — 시안: 마이페이지.png
// 기능은 기존 lib/persona.js·lib/auth.js·lib/bookmarks.js 를 그대로 쓴다.
import { useMemo } from 'react';
import { Pencil, Heart, Bell, BookA, MapPin, ChevronRight, CheckCircle2, Navigation } from 'lucide-react';
import { loadProfile, getPersona, gradeOption, getHomeRegion } from '../lib/persona.js';
import { getCachedUser } from '../lib/auth.js';
import { getBookmarks } from '../lib/bookmarks.js';
import SyTop from './SyTop.jsx';
import './sy-f.css';

function Row({ Icon, title, sub, onClick }) {
  return (
    <button type="button" className="sy-f-mp-row" onClick={onClick}>
      <span className="sy-f-mp-row-ico"><Icon size={20} /></span>
      <span className="sy-f-mp-row-text">
        <span className="sy-f-mp-row-title">{title}</span>
        {sub && <span className="sy-f-mp-row-sub">{sub}</span>}
      </span>
      <ChevronRight size={18} className="sy-f-mp-row-arrow" />
    </button>
  );
}

export default function SyMyPage({ goTo = () => {} }) {
  const profile = useMemo(loadProfile, []);
  const persona = getPersona(profile);
  const user = useMemo(getCachedUser, []);
  const bookmarks = useMemo(getBookmarks, []);

  const grade = gradeOption(profile?.grade);
  const region = getHomeRegion(profile);
  const nameLine = user?.nickname || '닉네임 없음';
  const subLine = [grade?.short, region].filter(Boolean).join(' · ') || '학년·지역을 아직 안 골랐어요';

  // '검정고시 합격 회차'를 넣으면 stage가 tested로 바뀐다(ProfileScreen) → 실제로 합격한 상태.
  const gedChip = !persona ? null : persona.stage === 'tested' ? '검정고시 합격' : '검정고시 준비 중';
  const goalChip = !persona ? null : persona.stage === 'tested' ? '수시 준비 중' : '대학 진학 준비 중';

  return (
    <div className="sy-screen sy-f-screen">
      <SyTop title="마이페이지" />

      <div className="sy-f-mp-card">
        <div className="sy-f-mp-card-top">
          <div>
            <p className="sy-f-mp-name">{nameLine}</p>
            <p className="sy-f-mp-sub">{subLine}</p>
          </div>
          <button type="button" className="sy-f-mp-edit" onClick={() => goTo('profile')}>
            <Pencil size={13} /> 정보 수정
          </button>
        </div>
        {(gedChip || goalChip) && (
          <div className="sy-f-mp-chips">
            {gedChip && <span className="sy-f-mp-chip"><CheckCircle2 size={13} /> {gedChip}</span>}
            {goalChip && <span className="sy-f-mp-chip"><Navigation size={13} /> {goalChip}</span>}
          </div>
        )}
      </div>

      <div className="sy-f-mp-group">
        <Row Icon={Heart} title="관심 대학"
          sub={bookmarks.length > 0 ? `${bookmarks.length}곳을 담았어요` : '아직 담은 대학이 없어요'}
          onClick={() => goTo('saved')} />
        <div className="sy-f-mp-divider" />
        <Row Icon={Bell} title="알림 · 내 스크랩" sub="저장한 글과 새 소식"
          onClick={() => goTo('noti-scrap')} />
      </div>

      <p className="sy-f-mp-sec-label">도움말</p>
      <div className="sy-f-mp-group">
        <Row Icon={BookA} title="입시 용어 사전" sub="어려운 말을 쉽게 확인해요"
          onClick={() => goTo('glossary')} />
        <div className="sy-f-mp-divider" />
        <Row Icon={MapPin} title="꿈드림센터" sub="가까운 센터를 찾아요"
          onClick={() => goTo('centers')} />
      </div>

      <div className="sy-f-mp-plain">
        <button type="button" className="sy-f-mp-plain-row" onClick={() => goTo('privacy')}>
          개인정보처리방침 <ChevronRight size={16} />
        </button>
        <button type="button" className="sy-f-mp-plain-row" onClick={() => goTo('terms')}>
          이용약관 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
