import { useMemo, useState } from 'react';
import {
  CircleCheck, CircleX, CalendarDays, FilePenLine, Calculator, ChevronDown, ArrowUpRight, ExternalLink,
} from 'lucide-react';
import SyTop from './SyTop.jsx';
import './sy-d.css';
import {
  GED_LINKS, PASS_RULE, SUBJECT_PASS_RULE, ELIGIBILITY, getNextSession, formatKDate,
} from '../data/gedGuide.js';

// 검정고시 안내 (시안 '검정고시 안내.png') — 기존 GedGuideScreen 의 사실 자료(data/gedGuide.js)를 그대로 쓴다.
// 시안은 한 줄 요약만 보이고, 줄을 누르면 기존 안내 문장이 그 자리에서 펼쳐진다(문구는 gedGuide.js 원문).
// ⚠️ 검정고시 사실은 여기서 새로 쓰지 않는다. 고칠 일이 있으면 data/gedGuide.js 에서 출처와 함께.

export default function SyGedGuide({ goBack }) {
  const [open, setOpen] = useState(null);     // 펼친 줄 id
  const [elig, setElig] = useState(false);    // 응시 자격 자세히
  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));
  const session = useMemo(() => getNextSession(), []);

  const rows = [
    {
      id: 'when', Icon: CalendarDays,
      t: '시험은 보통 연 2회예요', s: '정확한 날짜는 교육청 공고를 확인해요',
      body: session && (
        <>
          <p className="sy-d-strong">{session.year}년 {session.label}{session.confirmed ? '' : ' · 아직 공고 전'}</p>
          <ul>
            <li>원서접수 {session.confirmed ? formatKDate(session.applyDate) : `예년 ${session.hint?.apply}`}</li>
            <li>시험일 {session.confirmed ? formatKDate(session.examDate) : `예년 ${session.hint?.exam}`}</li>
            <li>합격발표 {session.confirmed ? formatKDate(session.resultDate) : `예년 ${session.hint?.result}`}</li>
          </ul>
          <p>
            {session.confirmed
              ? `${session.year}년 공고 기준이에요. 접수처는 거주지 시·도교육청이에요.`
              : '아직 공고 전이라 예년에 언제였는지만 알려드려요. 날짜가 정해지면 공고로 확인하세요.'}
          </p>
          <a className="sy-d-extlink" href={GED_LINKS.examSchedule.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} /> {GED_LINKS.examSchedule.label} · {GED_LINKS.examSchedule.host}
          </a>
        </>
      ),
    },
    {
      id: 'apply', Icon: FilePenLine,
      t: '온라인·방문 접수가 가능해요', s: '지역 교육청에 따라 다를 수 있어요',
      body: (
        <>
          <p>{ELIGIBILITY.note}</p>
          <a className="sy-d-extlink" href={GED_LINKS.apply.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} /> {GED_LINKS.apply.label} · {GED_LINKS.apply.host}
          </a>
        </>
      ),
    },
    {
      id: 'pass', Icon: Calculator,
      t: `평균 ${PASS_RULE.passAverage}점 이상이면 합격해요`, s: '과목별 과락은 없어요',
      body: (
        <>
          <p>{PASS_RULE.note}</p>
          <p className="sy-d-warn">{PASS_RULE.absentWarning}</p>
          <p className="sy-d-strong">{SUBJECT_PASS_RULE.title}</p>
          <ul>{SUBJECT_PASS_RULE.points.map((t) => <li key={t}>{t}</li>)}</ul>
          <p>{SUBJECT_PASS_RULE.caution}</p>
        </>
      ),
    },
  ];

  return (
    <div className="sy-screen sy-d sy-d-greenback">
      <SyTop title="검정고시 안내" onBack={goBack} />

      <p className="sy-d-kicker">핵심만 짧게</p>
      <h2 className="sy-d-hero sy-d-hero-ged">검정고시, 이것만 알면 돼요</h2>
      <p className="sy-d-herosub">응시 조건과 공식 자료부터 확인해요.</p>

      {/* 볼 수 있어요 / 없어요 — 누르면 응시 자격 원문(data/gedGuide.js ELIGIBILITY)이 아래에 펼쳐진다 */}
      <div className="sy-d-elig">
        <button type="button" className="sy-d-elig-card can" aria-expanded={elig} onClick={() => setElig((v) => !v)}>
          <span className="sy-d-elig-pill"><CircleCheck size={14} strokeWidth={2.2} /> 볼 수 있어요</span>
          <span className="sy-d-elig-t">초·중·고 졸업 학력이 필요한 학교 밖 청소년</span>
        </button>
        <button type="button" className="sy-d-elig-card cannot" aria-expanded={elig} onClick={() => setElig((v) => !v)}>
          <span className="sy-d-elig-pill"><CircleX size={14} strokeWidth={2.2} /> 볼 수 없어요</span>
          <span className="sy-d-elig-t">같은 학력의 학교에 재학 중인 경우</span>
        </button>
      </div>
      {elig && (
        <div className="sy-d-card sy-d-fold-body sy-d-eligbody">
          <p className="sy-d-strong">볼 수 있어요 (고졸 검정고시)</p>
          <ul>{ELIGIBILITY.can.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="sy-d-strong">볼 수 없어요</p>
          <ul>{ELIGIBILITY.cannot.map((t) => <li key={t}>{t.replace(/\*\*/g, '')}</li>)}</ul>
          <p className="sy-d-warn">{ELIGIBILITY.sixMonthRule}</p>
        </div>
      )}

      <div className="sy-d-card sy-d-gedlist sy-d-shadow">
        {rows.map((r, i) => (
          <div key={r.id}>
            <button type="button" className={`sy-d-gedrow${open === r.id ? ' open' : ''}`} aria-expanded={open === r.id}
              onClick={() => toggle(r.id)}>
              <span className="sy-d-gedico"><r.Icon size={20} strokeWidth={1.9} /></span>
              <span className="sy-d-gedtext">
                <span className="sy-d-gedt">{r.t}</span>
                <span className="sy-d-geds">{r.s}</span>
              </span>
              <ChevronDown size={18} className="sy-d-gedchev" />
            </button>
            {open === r.id && r.body && <div className="sy-d-fold-body sy-d-gedbody">{r.body}</div>}
            {i === 0 && <hr className="sy-d-div sy-d-div-ged" />}
          </div>
        ))}
      </div>

      <h3 className="sy-d-sec sy-d-sec-official">공식 자료</h3>
      {/* 시안의 '교육부' 카드 — 연결할 곳은 국가평생교육진흥원 검정고시지원센터(교육부 산하) 응시일정·공고 페이지.
          카드 왼쪽 네모는 시안대로 비워 둔다(로고 자리일 수 있음). */}
      <a className="sy-d-official" href={GED_LINKS.examSchedule.url} target="_blank" rel="noopener noreferrer">
        <span className="sy-d-official-sq" aria-hidden="true" />
        <span className="sy-d-official-text">
          <span className="sy-d-official-t">교육부 검정고시 안내</span>
          <span className="sy-d-official-s">공식 응시 자격과 공고를 확인해요</span>
        </span>
        <ArrowUpRight size={20} />
      </a>
    </div>
  );
}
