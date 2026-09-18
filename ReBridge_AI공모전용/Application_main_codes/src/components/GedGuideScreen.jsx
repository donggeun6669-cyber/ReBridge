import { useMemo, useState } from 'react';
import {
  ArrowLeft, ChevronDown, ExternalLink, CalendarClock, FileText,
  ClipboardList, Award, CheckCircle2, BookOpen, Calculator, Languages,
  Globe2, FlaskConical, Landmark, Info, Target, ListChecks, AlertTriangle,
} from 'lucide-react';
import '../styles.study.css';
import {
  GED_LINKS, PASS_RULE, GED_SUBJECT_GUIDE, GED_ELECTIVE_NOTE,
  SUBJECT_PASS_RULE, ELIGIBILITY,
  getNextSession, daysUntil, formatKDate,
} from '../data/gedGuide.js';
import { loadProfile, V1_UNIV_ONLY } from '../lib/persona.js';
import { MOCK_KEY, loadScores } from '../lib/studyUtils.js';
import '../styles.gedguide.css';

const ICONS = {
  BookOpen, Calculator, Languages, Globe2, FlaskConical, Landmark,
};

// 질문 카드 — 답 한 줄을 크게, 설명은 '자세히 보기'로 펼친다(2026-09-18).
function FactCard({ id, open, onToggle, icon: Icon, tone = 'blue', q, a, sub, alert, chips, more = '자세히 보기', children }) {
  const isOpen = open === id;
  return (
    <section className={`gq-card ${isOpen ? 'open' : ''}`}>
      <button type="button" className="gq-head" onClick={() => onToggle(id)} aria-expanded={isOpen}>
        <span className={`gq-ico tone-${tone}`}><Icon size={22} /></span>
        <span className="gq-text">
          <span className="gq-q">{q}</span>
          <span className="gq-a">{a}</span>
          {sub && <span className="gq-sub">{sub}</span>}
        </span>
      </button>
      {chips && (
        <div className="gq-chips">
          {chips.map((c) => <span key={c} className="gq-chip">{c}</span>)}
          <span className="gq-chip gq-chip--more">+ 선택 1</span>
        </div>
      )}
      {alert && (
        <p className="gq-alert"><AlertTriangle size={14} /> {alert}</p>
      )}
      <button type="button" className="gq-more" onClick={() => onToggle(id)} aria-expanded={isOpen}>
        {isOpen ? '접기' : more} <ChevronDown size={16} className="gq-more-chev" />
      </button>
      {isOpen && <div className="gq-detail">{children}</div>}
    </section>
  );
}

export default function GedGuideScreen({ goTo = () => {}, goBack = () => {} }) {
  const [openSubject, setOpenSubject] = useState(null);
  const [open, setOpen] = useState(null);   // 펼친 질문 카드 id (한 번에 하나)
  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));

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
      {/* 원래 학습 트랙의 탭 화면이라 로고만 있고 뒤로 버튼이 없었다.
          2026-09-17부터 '담임에게 물어보기'에서 들어오므로 뒤로 버튼을 단다. */}
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">검정고시 안내</span>
      </header>

      {/* 2026-09-18 서연님 피드백: 글이 너무 많아 학생들이 안 읽고 넘긴다.
          → 질문 카드마다 '답 한 줄'을 크게 먼저 보여주고, 설명은 '자세히 보기'로 펼친다.
          정보는 하나도 지우지 않았다. 결시=불합격 경고만은 접혀 있어도 보이게 둔다. */}
      <section className="gq-hero">
        <h1 className="gq-hero-title">검정고시,<br />이것만 알면 돼요</h1>
        <p className="gq-hero-sub">궁금한 카드를 눌러 자세히 봐요</p>
      </section>

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

      <div className="gq-list">
        <FactCard
          id="when" open={open} onToggle={toggle}
          icon={CalendarClock} tone="yellow"
          q="다음 시험은 언제예요?"
          a={session
            ? (session.confirmed
                ? (dday > 0 ? `D-${dday}` : dday === 0 ? 'D-DAY' : '접수 진행 중')
                : `예년 ${session.hint?.exam}`)
            : '공고 확인 필요'}
          sub={session ? `${session.year}년 ${session.label}${session.confirmed ? ` · 시험 ${formatKDate(session.examDate)}` : ' · 아직 공고 전'}` : null}
        >
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
          {session && !session.confirmed && (
            <a className="gq-link" href={GED_LINKS.examSchedule.url} target="_blank" rel="noopener noreferrer">
              공고 확인하러 가기 <ExternalLink size={14} />
            </a>
          )}
        </FactCard>

        <FactCard
          id="pass" open={open} onToggle={toggle}
          icon={Target} tone="blue"
          q="몇 점이면 합격이에요?"
          a={`평균 ${PASS_RULE.passAverage}점`}
          sub="과목별 과락은 없어요"
          alert="접수한 과목을 하나라도 안 보면 불합격"
        >
          <p className="gq-detail-text">{PASS_RULE.note}</p>
          <p className="gedh-pass-warn">
            <AlertTriangle size={14} />
            <span>{PASS_RULE.absentWarning}</span>
          </p>
        </FactCard>

        <FactCard
          id="partial" open={open} onToggle={toggle}
          icon={CheckCircle2} tone="blue"
          q="떨어지면 처음부터 다시 봐요?"
          a="아니요, 60점 넘은 과목은 남아요"
          sub="과목합격제 — 두 번에 나눠 끝내도 돼요"
        >
          <ul className="gedh-partial-list">
            {SUBJECT_PASS_RULE.points.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <p className="gedh-partial-caution">{SUBJECT_PASS_RULE.caution}</p>
        </FactCard>

        <FactCard
          id="elig" open={open} onToggle={toggle}
          icon={Info} tone="yellow"
          q="나도 볼 수 있어요?"
          a="자퇴했다면 6개월 뒤부터"
          sub="제적일부터 공고일까지 6개월이 지나야 해요"
        >
          <p className="gedh-elig-head">볼 수 있어요</p>
          <ul className="gedh-elig-list">
            {ELIGIBILITY.can.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <p className="gedh-elig-head gedh-elig-head--no">볼 수 없어요</p>
          <ul className="gedh-elig-list">
            {ELIGIBILITY.cannot.map((t) => <li key={t}>{t.replace(/\*\*/g, '')}</li>)}
          </ul>
          <p className="gedh-elig-rule">
            <AlertTriangle size={14} />
            <span>{ELIGIBILITY.sixMonthRule}</span>
          </p>
          <p className="gedh-elig-note">{ELIGIBILITY.note}</p>
        </FactCard>

        <FactCard
          id="subjects" open={open} onToggle={toggle}
          icon={BookOpen} tone="blue"
          q="무슨 과목을 봐요?"
          a="7과목 (필수 6 + 선택 1)"
          chips={GED_SUBJECT_GUIDE.map((x) => x.key)}
          more="과목별 공부 팁 보기"
        >
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
        </FactCard>

        <FactCard
          id="mock" open={open} onToggle={toggle}
          icon={Calculator} tone="yellow"
          q="내 점수로 합격할 수 있을까?"
          a={avg == null ? '점수 넣고 확인하기' : `지금 평균 ${avg}점`}
          sub={avg == null ? '기출·모의고사 점수로 가늠해요' : (avg >= passLine ? '합격선을 넘었어요' : `합격선까지 ${passLine - avg}점`)}
          more="점수 넣기"
        >
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

          {/* 약한 과목 → 공부 플래너 — v1에서는 학습(스터디) 트랙을 숨기므로 함께 감춘다 */}
          {!V1_UNIV_ONLY && weakSubject && (
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
        </FactCard>
      </div>

      {/* ── 공식 링크 ── */}
      <div className="home-section">
        <p className="home-section-label">공식 자료</p>
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
