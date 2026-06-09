import { useMemo, useState } from 'react';
import {
  ArrowRight, ChevronDown, ExternalLink, CalendarClock, FileText,
  ClipboardList, Award, CheckCircle2, BookOpen, Calculator, Languages,
  Globe2, FlaskConical, Landmark, Info,
} from 'lucide-react';
import LogoMark from './LogoMark.jsx';
import {
  GED_LINKS, PASS_RULE, GED_SUBJECT_GUIDE, GED_ELECTIVE_NOTE,
  getNextSession, daysUntil, formatKDate,
} from '../data/gedGuide.js';
import '../styles.gedguide.css';

const ICONS = {
  BookOpen, Calculator, Languages, Globe2, FlaskConical, Landmark,
};

export default function GedGuideScreen({ goTo = () => {} }) {
  const [openSubject, setOpenSubject] = useState(null);

  const session = useMemo(() => getNextSession(), []);
  const dday = session ? daysUntil(session.examDate) : null;

  // 다음 회차의 3단계 (원서접수 → 시험 → 합격발표)
  const milestones = session
    ? [
        { id: 'apply',  icon: ClipboardList, label: '원서접수', date: session.applyDate },
        { id: 'exam',   icon: FileText,      label: '시험일',   date: session.examDate },
        { id: 'result', icon: Award,         label: '합격발표', date: session.resultDate },
      ].map((m) => {
        const d = daysUntil(m.date);
        return { ...m, dday: d, done: d < 0 };
      })
    : [];

  return (
    <div className="screen">
      <header className="topbar">
        <span className="brand-lockup">
          <LogoMark size={24} />
          <span className="wordmark">검고담임</span>
        </span>
      </header>

      <section className="home-hero" style={{ marginBottom: 18 }}>
        <p className="home-kicker">검정고시 준비 도우미</p>
        <h1 className="home-title">
          시험부터 합격까지,<br />
          <span className="accent">같이 준비해요</span>
        </h1>
      </section>

      {/* ── D-day 히어로 ── */}
      {session && (
        <div className="gedh-hero">
          <div className="gedh-hero-top">
            <CalendarClock size={16} />
            <span>다음 검정고시까지</span>
          </div>
          <div className="gedh-hero-dday">
            {dday > 0 ? `D-${dday}` : dday === 0 ? 'D-DAY' : '접수 진행 중'}
          </div>
          <div className="gedh-hero-date">
            {session.year}년 {session.label} · 시험 {formatKDate(session.examDate)}
          </div>
        </div>
      )}

      {/* ── 일정 타임라인 ── */}
      {milestones.length > 0 && (
        <div className="gedh-timeline">
          {milestones.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.id} className={`gedh-tl-item ${m.done ? 'done' : ''}`}>
                <span className="gedh-tl-ico">
                  {m.done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                </span>
                <span className="gedh-tl-body">
                  <span className="gedh-tl-label">{m.label}</span>
                  <span className="gedh-tl-date">{formatKDate(m.date)}</span>
                </span>
                <span className="gedh-tl-dday">
                  {m.done ? '지남' : m.dday === 0 ? '오늘' : `D-${m.dday}`}
                </span>
              </div>
            );
          })}
          <p className="gedh-tl-note">
            <Info size={12} /> 접수·시험일은 예년 패턴 기준이에요. 정확한 날짜는 공고로 확인하세요.
          </p>
        </div>
      )}

      {/* ── 합격 기준 ── */}
      <div className="gedh-passbox">
        <div className="gedh-pass-big">
          평균 <b>{PASS_RULE.passAverage}점</b>이면 합격
        </div>
        <p className="gedh-pass-sub">{PASS_RULE.note}</p>
      </div>

      {/* ── 과목별 공부 가이드 ── */}
      <div className="home-section">
        <p className="home-section-label">과목별 공부 가이드</p>
        <div className="gedh-subjects">
          {GED_SUBJECT_GUIDE.map((s) => {
            const Icon = ICONS[s.icon] || BookOpen;
            const open = openSubject === s.key;
            return (
              <div key={s.key} className={`gedh-subj ${open ? 'open' : ''}`}>
                <button
                  className="gedh-subj-head"
                  onClick={() => setOpenSubject(open ? null : s.key)}
                  aria-expanded={open}
                >
                  <span className={`gedh-subj-ico ico-${s.color}`}>
                    <Icon size={18} />
                  </span>
                  <span className="gedh-subj-text">
                    <span className="gedh-subj-name">{s.key}</span>
                    <span className="gedh-subj-sum">{s.summary}</span>
                  </span>
                  <ChevronDown size={18} className="gedh-subj-chev" />
                </button>
                {open && (
                  <ul className="gedh-subj-tips">
                    {s.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <p className="gedh-elective">{GED_ELECTIVE_NOTE}</p>
      </div>

      {/* ── 공식 링크 ── */}
      <div className="home-section">
        <p className="home-section-label">공식 자료 바로가기</p>
        <div className="gedh-links">
          {Object.values(GED_LINKS).map((l) => (
            <a
              key={l.url}
              className="gedh-link"
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="gedh-link-body">
                <span className="gedh-link-label">{l.label}</span>
                <span className="gedh-link-host">{l.host}</span>
              </span>
              <ExternalLink size={16} className="gedh-link-ext" />
            </a>
          ))}
        </div>
      </div>

      {/* ── 이미 합격한 사람 → 점수 입력 ── */}
      <button className="gedh-cta" onClick={() => goTo('profile')}>
        <span className="gedh-cta-inner">
          <span className="gedh-cta-label">이미 검정고시에 합격했어요</span>
          <span className="gedh-cta-title">점수 넣고 대학 찾기</span>
        </span>
        <span className="gedh-cta-arrow"><ArrowRight size={22} /></span>
      </button>

      <p className="note" style={{ marginTop: 22 }}>
        검정고시로 대학을 준비하는<br />
        학교 밖 청소년을 위한 안내예요.
      </p>
    </div>
  );
}
