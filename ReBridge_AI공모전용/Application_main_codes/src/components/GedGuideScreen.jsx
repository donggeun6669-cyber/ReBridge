import { useMemo, useState } from 'react';
import {
  ChevronDown, ExternalLink, CalendarClock, FileText,
  ClipboardList, Award, CheckCircle2, BookOpen, Calculator, Languages,
  Globe2, FlaskConical, Landmark, Info, Target, ListChecks, AlertTriangle,
} from 'lucide-react';
import LogoMark from './LogoMark.jsx';
import '../styles.study.css';
import {
  GED_LINKS, PASS_RULE, GED_SUBJECT_GUIDE, GED_ELECTIVE_NOTE,
  SUBJECT_PASS_RULE, ELIGIBILITY,
  getNextSession, daysUntil, formatKDate,
} from '../data/gedGuide.js';
import { loadProfile } from '../lib/persona.js';
import { MOCK_KEY, loadScores } from '../lib/studyUtils.js';
import '../styles.gedguide.css';

const ICONS = {
  BookOpen, Calculator, Languages, Globe2, FlaskConical, Landmark,
};

export default function GedGuideScreen({ goTo = () => {} }) {
  const [openSubject, setOpenSubject] = useState(null);

  const profile = useMemo(loadProfile, []);
  const targetAvg = profile?.scoreMode === 'target' ? profile.gedAvg : null;

  // ── 내 모의점수 (과목별) → 합격선 60점과 비교 ──
  const [scores, setScores] = useState(loadScores);
  function setScore(subjKey, raw) {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 3);
    const next = { ...scores };
    if (digits === '') delete next[subjKey];
    else next[subjKey] = Math.min(100, parseInt(digits, 10));
    setScores(next);
    try { localStorage.setItem(MOCK_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  }
  const entered = GED_SUBJECT_GUIDE
    .map((s) => scores[s.key])
    .filter((v) => v != null && v !== '');
  const avg = entered.length ? Math.round(entered.reduce((a, b) => a + b, 0) / entered.length) : null;
  const passLine = PASS_RULE.passAverage;

  // 가장 약한 과목 (플래너로 연결)
  const weakSubject = useMemo(() => {
    const arr = GED_SUBJECT_GUIDE
      .map((s) => ({ key: s.key, v: scores[s.key] }))
      .filter((x) => x.v != null && x.v !== '')
      .sort((a, b) => a.v - b.v);
    return arr[0] || null;
  }, [scores]);

  const session = useMemo(() => getNextSession(), []);
  const dday = session ? daysUntil(session.examDate) : null;
  const applyDday = session ? daysUntil(session.applyDate) : null;
  // 원서접수 임박/진행 중(D-14 ~ 접수일+5일)일 때 적극 안내
  // 공고된 회차에만 띄운다. 추정 날짜로 "접수 N일 남았어요"라고 재촉하면 안 된다.
  const applyOpen = session?.confirmed && applyDday != null && applyDday <= 14 && applyDday >= -5;

  // 다음 회차의 3단계 (원서접수 → 시험 → 합격발표)
  const milestones = session
    ? [
        { id: 'apply',  icon: ClipboardList, label: '원서접수', date: session.applyDate,  hintText: session.hint?.apply },
        { id: 'exam',   icon: FileText,      label: '시험일',   date: session.examDate,   hintText: session.hint?.exam },
        { id: 'result', icon: Award,         label: '합격발표', date: session.resultDate, hintText: session.hint?.result },
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
      {/* 공고된 회차만 D-day를 띄운다. 공고 전이면 날짜를 지어내지 않는다. */}
      {session && session.confirmed && (
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

      {/* 아직 공고 전 — 예년 패턴만 알려주고 공식 공고로 보낸다 */}
      {session && !session.confirmed && (
        <div className="gedh-hero gedh-hero--pending">
          <div className="gedh-hero-top">
            <CalendarClock size={16} />
            <span>{session.year}년 일정은 아직 공고 전이에요</span>
          </div>
          <div className="gedh-hero-pending">
            예년엔 {session.label} 시험을 <b>{session.hint?.exam}</b>에 봤어요
          </div>
          <div className="gedh-hero-date">
            접수는 보통 {session.hint?.apply} · 발표는 {session.hint?.result}
          </div>
          <a
            className="gedh-hero-link"
            href={GED_LINKS.examSchedule.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            공고 확인하러 가기
          </a>
        </div>
      )}

      {/* ── 원서접수 임박/진행 배너 ── */}
      {applyOpen && (
        <a
          className="gedh-applybanner"
          href={GED_LINKS.apply.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="gedh-applybanner-ico"><ClipboardList size={18} /></span>
          <span className="gedh-applybanner-body">
            <span className="gedh-applybanner-title">
              {applyDday > 0
                ? `원서접수 ${applyDday}일 남았어요`
                : '지금 원서접수 기간이에요'}
            </span>
            <span className="gedh-applybanner-sub">
              놓치면 이번 회차는 응시할 수 없어요 · 접수 바로가기
            </span>
          </span>
          <ExternalLink size={15} />
        </a>
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
                  <span className="gedh-tl-date">
                    {session.confirmed ? formatKDate(m.date) : m.hintText}
                  </span>
                </span>
                {/* 공고 전에는 D-day를 계산하지 않는다 — 기준 날짜가 없으니 숫자가 거짓이 된다 */}
                {session.confirmed && (
                  <span className="gedh-tl-dday">
                    {m.done ? '지남' : m.dday === 0 ? '오늘' : `D-${m.dday}`}
                  </span>
                )}
              </div>
            );
          })}
          <p className="gedh-tl-note">
            <Info size={12} />{' '}
            {session.confirmed
              ? `${session.year}년 공고 기준이에요. 접수처는 거주지 시·도교육청이에요.`
              : '아직 공고 전이라 예년에 언제였는지만 알려드려요. 날짜가 정해지면 공고로 확인하세요.'}
          </p>
        </div>
      )}

      {/* ── 합격 기준 ── */}
      <div className="gedh-passbox">
        <div className="gedh-pass-big">
          평균 <b>{PASS_RULE.passAverage}점</b>이면 합격
        </div>
        <p className="gedh-pass-sub">{PASS_RULE.note}</p>
        {/* 학생이 가장 자주 오해하는 지점 — 결시는 0점이 아니라 불합격이다 */}
        <p className="gedh-pass-warn">
          <AlertTriangle size={14} />
          <span>{PASS_RULE.absentWarning}</span>
        </p>
      </div>

      {/* ── 과목합격제(부분합격) ── */}
      <div className="home-section">
        <p className="home-section-label">{SUBJECT_PASS_RULE.title}</p>
        <div className="gedh-partial">
          <ul className="gedh-partial-list">
            {SUBJECT_PASS_RULE.points.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="gedh-partial-caution">{SUBJECT_PASS_RULE.caution}</p>
        </div>
      </div>

      {/* ── 응시 자격 ── */}
      <div className="home-section">
        <p className="home-section-label">나는 볼 수 있을까?</p>
        <div className="gedh-elig">
          <p className="gedh-elig-head">볼 수 있어요</p>
          <ul className="gedh-elig-list">
            {ELIGIBILITY.can.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <p className="gedh-elig-head gedh-elig-head--no">볼 수 없어요</p>
          <ul className="gedh-elig-list">
            {ELIGIBILITY.cannot.map((t) => (
              <li key={t}>{t.replace(/\*\*/g, '')}</li>
            ))}
          </ul>
          <p className="gedh-elig-rule">
            <AlertTriangle size={14} />
            <span>{ELIGIBILITY.sixMonthRule}</span>
          </p>
          <p className="gedh-elig-note">{ELIGIBILITY.note}</p>
        </div>
      </div>

      {/* ── 내 점수 체크 (모의/기출 점수 → 합격선 비교) ── */}
      <div className="home-section">
        <p className="home-section-label">
          <Target size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
          내 점수 체크
        </p>
        <div className="gedh-mock">
          <div className="gedh-mock-grid">
            {GED_SUBJECT_GUIDE.map((s) => (
              <label key={s.key} className={`gedh-mock-item ${scores[s.key] != null ? 'on' : ''}`}>
                <span className="gedh-mock-subj">{s.key}</span>
                <input
                  className="gedh-mock-input"
                  inputMode="numeric"
                  value={scores[s.key] ?? ''}
                  onChange={(e) => setScore(s.key, e.target.value)}
                  placeholder="-"
                  aria-label={`${s.key} 점수`}
                />
                <span className="gedh-mock-unit">점</span>
              </label>
            ))}
          </div>

          {avg == null ? (
            <p className="gedh-mock-hint">
              풀어본 기출·모의고사 점수를 적으면 합격선({passLine}점)까지 얼마나 남았는지 알려드려요.
            </p>
          ) : (
            <div className="gedh-mock-result">
              <div className="gedh-mock-avgrow">
                <span className="gedh-mock-avg">평균 {avg}점</span>
                <span className="gedh-mock-cnt">{entered.length}과목 기준</span>
              </div>
              <div className="gedh-mock-bar">
                <span className={`gedh-mock-bar-fill ${avg >= passLine ? 'ok' : ''}`} style={{ width: `${avg}%` }} />
                <span className="gedh-mock-bar-mark pass" style={{ left: `${passLine}%` }} />
                {targetAvg != null && <span className="gedh-mock-bar-mark target" style={{ left: `${targetAvg}%` }} />}
              </div>
              <p className="gedh-mock-legend">
                ▏합격선 {passLine}점{targetAvg != null ? ` · 내 목표 ${targetAvg}점` : ''}
              </p>
              <p className={`gedh-mock-status ${avg >= passLine ? 'ok' : 'under'}`}>
                {avg >= passLine
                  ? (targetAvg != null && avg < targetAvg
                      ? `합격선 통과! 목표 평균까지 ${targetAvg - avg}점 남았어요.`
                      : '합격선에 도달했어요. 이대로 꾸준히 가요! 👏')
                  : `합격선까지 평균 ${passLine - avg}점만 더 올리면 돼요.`}
              </p>
            </div>
          )}
          <p className="gedh-mock-note">점수는 이 기기에만 저장돼요. 선택 과목은 빼고 필수 6과목으로만 가늠해요.</p>

          {weakSubject && (
            <button className="study-ged-weakcta" onClick={() => goTo('study-planner')}>
              <span className="study-ged-weakcta-ico"><ListChecks size={18} /></span>
              <span className="study-ged-weakcta-body">
                <span className="study-ged-weakcta-title">
                  {weakSubject.v < passLine
                    ? `${weakSubject.key}이(가) 가장 약해요 (${weakSubject.v}점)`
                    : `${weakSubject.key} 점수가 가장 낮아요 (${weakSubject.v}점)`}
                </span>
                <span className="study-ged-weakcta-sub">플래너에서 {weakSubject.key} 보완 할 일을 담아 공부해요</span>
              </span>
              <ExternalLink size={15} style={{ transform: 'rotate(-45deg)' }} />
            </button>
          )}
        </div>
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

      <p className="note" style={{ marginTop: 22 }}>
        검정고시로 대학을 준비하는<br />
        학교 밖 청소년을 위한 안내예요.
      </p>
    </div>
  );
}
