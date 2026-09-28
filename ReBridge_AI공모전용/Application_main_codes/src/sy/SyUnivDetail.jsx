import { useEffect, useMemo, useState } from 'react';
import {
  MapPin, Sparkles, ChevronRight, ChevronDown, CircleCheck, CircleX, TriangleAlert, ExternalLink,
} from 'lucide-react';
import SyTop from './SyTop.jsx';
import './sy-d.css';
import { getUniversityDetail, getUniversityDetailByName } from '../lib/analysis.js';
import { isBookmarked, toggleBookmark } from '../lib/bookmarks.js';
import { loadProfile } from '../lib/persona.js';
import { applyDeadline, TARGET_ADMISSION_YEAR } from '../data/meta.js';
import GUIDELINES from '../data/guidelines_2027.json';
import { admissionLabel, admissionSub, univChip, univSubline, coachSummary } from './dUtil.js';

// 대학 상세 (시안 '대학 상세.png') — 기능은 예전 DetailScreen 과 같은 자료·계산을 쓴다.
// params: { univId, univ }  (ResultsScreen·ExploreScreen·SavedScreen 등이 이렇게 부른다)

const BADGE = {
  가능: { cls: 'ok', Icon: CircleCheck, label: '가능' },
  불가: { cls: 'no', Icon: CircleX, label: '검정고시 불가' },
  조건부: { cls: 'cond', Icon: TriangleAlert, label: '조건부' },
};

export default function SyUnivDetail({ goTo, goBack, params = {} }) {
  const { univId, univ: univName } = params;
  const profile = useMemo(loadProfile, []);
  const today = useMemo(() => new Date(), []);
  const [openGuide, setOpenGuide] = useState(false);

  const detail = useMemo(() => {
    if (univId) return getUniversityDetail(univId);
    if (univName) return getUniversityDetailByName(univName);
    return null;
  }, [univId, univName]);

  // 관심 대학(북마크) — 기존 bookmarks.js 그대로
  const bmId = detail?.univ?.univId || univId || null;
  const [marked, setMarked] = useState(false);
  useEffect(() => { setMarked(isBookmarked(bmId)); }, [bmId]);

  if (!detail) {
    return (
      <div className="sy-screen sy-d">
        <SyTop title="대학 정보" onBack={goBack} />
        <div className="sy-d-card sy-d-coach">
          <div className="sy-d-coach-head"><Sparkles size={18} /> 담임 한마디</div>
          <p className="sy-d-coach-body">이 대학의 전형 정보는 아직 모으지 못했어요.</p>
        </div>
      </div>
    );
  }

  const { univ, rows, eligibleCount } = detail;
  const realId = univ.univId;
  const okRows = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
  const coach = coachSummary(profile, okRows, eligibleCount, realId);
  const sub = univSubline(rows);

  // 모집요강 원본 — 수시를 먼저(기존 GuidelineCheck 와 같은 순서)
  const links = (GUIDELINES[realId] || [])
    .slice()
    .sort((a, b) => (a.phase === '수시' ? 0 : 1) - (b.phase === '수시' ? 0 : 1));

  return (
    <div className="sy-screen sy-d">
      <SyTop
        title="대학 정보"
        onBack={goBack}
        action={marked ? '관심 빼기' : '관심 담기'}
        onAction={() => setMarked(toggleBookmark(bmId))}
      />

      <span className="sy-chip sy-d-chip"><MapPin size={14} /> {univChip(univ)}</span>
      <h2 className="sy-d-univ">{univ.name}</h2>
      {sub && <p className="sy-d-univsub">{sub}</p>}

      <div className="sy-d-card sy-d-coach">
        <div className="sy-d-coach-head"><Sparkles size={18} /> 담임 한마디</div>
        <p className="sy-d-coach-body">{coach}</p>
      </div>

      <div className="sy-d-sechead">
        <h3 className="sy-d-sec">전형 목록</h3>
        <button type="button" className="sy-d-link"
          onClick={() => goTo('admission-matrix', { univId: realId, univ: univ.name })}>
          비교하기
        </button>
      </div>

      <div className="sy-d-card sy-d-list sy-d-shadow">
        {rows.length === 0 && (
          <div className="sy-d-adm">
            <span className="sy-d-adm-text">
              <span className="sy-d-adm-name">전형 자료가 아직 없어요</span>
              <span className="sy-d-adm-sub">모집요강에서 확인해요</span>
            </span>
          </div>
        )}
        {rows.map((r, i) => {
          const b = BADGE[r.gedEligible] || BADGE.조건부;
          const dl = applyDeadline(r.applyCloseDate, r.applyCloseTime, today);
          return (
            <div key={`${r.admissionName}-${i}`}>
              <button type="button" className="sy-d-adm"
                onClick={() => goTo('documents', { univId: realId, univ: univ.name, admissionName: r.admissionName })}>
                <span className="sy-d-adm-text">
                  <span className="sy-d-adm-name">{admissionLabel(r)}</span>
                  <span className="sy-d-adm-sub">{admissionSub(r, dl)}</span>
                </span>
                <span className={`sy-d-pill ${b.cls}`}><b.Icon size={14} strokeWidth={2.2} /> {b.label}</span>
                <ChevronRight size={18} className="sy-d-chev" />
              </button>
              {i === 0 && rows.length > 1 && <hr className="sy-d-div" />}
            </div>
          );
        })}
      </div>

      <div className={`sy-d-card sy-d-fold${openGuide ? ' open' : ''}`}>
        <button type="button" className="sy-d-fold-head" aria-expanded={openGuide}
          onClick={() => setOpenGuide((v) => !v)}>
          모집요강 원문 펼치기
          <ChevronDown size={18} className="sy-d-fold-chev" />
        </button>
        {openGuide && (
          <div className="sy-d-fold-body">
            <p>앱 내용은 정리한 자료예요. 최종 근거는 대학이 낸 모집요강이에요.</p>
            {links.map((l, i) => (
              <a key={i} className="sy-d-extlink" href={l.url} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
                {TARGET_ADMISSION_YEAR}학년도 {l.phase || ''} 모집요강{l.campus ? ` · ${l.campus}` : ''} PDF
              </a>
            ))}
            {links.length === 0 && <p>이 대학의 모집요강 원본 주소를 아직 모아두지 못했어요.</p>}
            {univ.admissionOfficeUrl && (
              <a className="sy-d-extlink" href={univ.admissionOfficeUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> {univ.name} 입학처 홈페이지
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
