import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import SyTop from './SyTop.jsx';
import { GED_SUBJECTS, gedAverage, estimateGrade } from '../lib/scoreEngine.js';
import { getPersona, loadProfile } from '../lib/persona.js';
import { examYearOptions } from '../data/meta.js';
import './sy-c.css';

// 서연 UI 「내 점수 입력」 — 2026-09-28 시안
// 저장 형식은 예전 ProfileScreen 과 같다(localStorage rebridge_profile 의
// gedScores · gedAvg · gedGrade · examYear · examRound · csatGrades · csatPlan · scoreMode).
// 점수 엔진(scoreEngine.evaluateAdmission)은 과목별 점수(gedScores)로 계산하므로,
// 시안처럼 평균 한 칸만 받을 때는 필수 6과목에 그 평균을 똑같이 넣어 저장한다.
// (이미 과목별 점수가 있고 평균을 바꾸지 않았으면 과목별 점수를 그대로 둔다)

const STORAGE_KEY = 'rebridge_profile';
const CSAT_SHOWN = ['국어', '수학', '영어']; // 시안에 있는 세 과목. 탐구1·2 값은 건드리지 않는다.
const NOT_YET = '아직 안 봤어요';

// 합격 회차 선택지 — 연도(meta.examYearOptions) × 1·2회차
const ROUND_OPTIONS = [
  ...examYearOptions().flatMap((y) => [
    { value: `${y.value}|1회차`, label: `${y.label} 1회` },
    { value: `${y.value}|2회차`, label: `${y.label} 2회` },
  ]),
  { value: `|${NOT_YET}`, label: NOT_YET },
];

function fmtAvg(v) {
  if (v == null || Number.isNaN(Number(v))) return '';
  return String(Math.round(Number(v) * 10) / 10);
}

export default function SyScore({ goBack, goTo, onProfileComplete }) {
  const [profile] = useState(() => loadProfile() || {});
  const initialAvg = profile.gedAvg ?? gedAverage(profile.gedScores);
  const [avgText, setAvgText] = useState(() => fmtAvg(initialAvg));
  const [round, setRound] = useState(() => {
    if (profile.examRound === NOT_YET) return `|${NOT_YET}`;
    if (profile.examYear && profile.examRound) return `${profile.examYear}|${profile.examRound}`;
    return '';
  });
  const [csat, setCsat] = useState(() => {
    const g = profile.csatGrades || {};
    return Object.fromEntries(CSAT_SHOWN.map((s) => [s, g[s] != null ? String(g[s]) : '']));
  });
  const [noCsat, setNoCsat] = useState(profile.csatPlan === '안 볼 거예요');

  function onAvg(raw) {
    let v = raw.replace(/[^0-9.]/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
    if (v !== '' && v !== '.' && Number(v) > 100) v = '100';
    setAvgText(v);
  }

  function save() {
    const next = { ...profile };

    // 검정고시 평균
    const avgNum = avgText === '' || avgText === '.' ? null : Math.min(100, Math.max(0, Number(avgText)));
    if (avgNum == null) {
      next.gedScores = {};
      next.gedAvg = null;
      next.gedGrade = null;
    } else {
      const prevAvg = gedAverage(profile.gedScores);
      const unchanged = prevAvg != null && fmtAvg(prevAvg) === fmtAvg(avgNum);
      if (!unchanged) {
        next.gedScores = { ...Object.fromEntries(GED_SUBJECTS.map((s) => [s, avgNum])), elective: '' };
      }
      next.gedAvg = gedAverage(next.gedScores);
      next.gedGrade = estimateGrade(next.gedAvg);
    }

    // 합격 회차
    const [examYear, examRound] = round ? round.split('|') : ['', ''];
    next.examYear = examYear;
    next.examRound = examRound;

    // 수능 모의 등급 + 수능 계획
    const prevCsat = profile.csatGrades || {};
    const csatGrades = { ...prevCsat };
    CSAT_SHOWN.forEach((s) => { csatGrades[s] = csat[s] === '' ? null : Number(csat[s]); });
    next.csatGrades = csatGrades;
    if (noCsat) next.csatPlan = '안 볼 거예요';
    else if (profile.csatPlan === '안 볼 거예요' || !profile.csatPlan) {
      const any = Object.values(csatGrades).some((v) => v != null);
      if (any) next.csatPlan = '볼 거예요';
      else if (profile.csatPlan === '안 볼 거예요') next.csatPlan = '고민 중이에요';
    }

    // 예전 ProfileScreen 과 같은 규칙: 공부 중이면 목표 점수, 회차를 넣었으면 응시한 사람
    next.scoreMode = getPersona()?.stage === 'studying' ? 'target' : 'actual';
    if (examYear && examRound && examRound !== NOT_YET) next.stage = 'tested';

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
    if (onProfileComplete) onProfileComplete();
    else goBack();
  }

  const roundLabel = ROUND_OPTIONS.find((o) => o.value === round)?.label;

  return (
    <div className="sy-screen">
      <SyTop title="내 점수" onBack={goBack} action="저장" onAction={save} actionTone="orange" />

      <h2 className="sy-c-hero">아는 만큼만 입력해요</h2>
      <p className="sy-c-lead">나와 맞는 대학을 살펴볼 때 참고해요.</p>

      <label className="sy-c-label" htmlFor="sy-c-avg">검정고시 평균 점수</label>
      <div className="sy-c-field">
        <input
          id="sy-c-avg"
          className="sy-c-input"
          type="text"
          inputMode="decimal"
          value={avgText}
          onChange={(e) => onAvg(e.target.value)}
        />
        <span className="sy-c-unit">점</span>
      </div>

      <label className="sy-c-label" htmlFor="sy-c-round">합격 회차</label>
      <div className="sy-c-field">
        <span className={`sy-c-select-text${roundLabel ? '' : ' empty'}`}>{roundLabel || '선택해요'}</span>
        <ChevronDown size={12} strokeWidth={2} className="sy-c-select-caret" aria-hidden="true" />
        <select id="sy-c-round" className="sy-c-select-native" value={round} onChange={(e) => setRound(e.target.value)}>
          <option value="">선택 안 함</option>
          {ROUND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="sy-c-sec">
        <h3 className="sy-c-sec-title">수능 모의 등급</h3>
        <button type="button" className="sy-c-sec-link" onClick={() => goTo('glossary', { termId: '등급 (9등급제)' })}>
          등급이 뭔가요?
        </button>
      </div>
      <div className="sy-c-grades">
        {CSAT_SHOWN.map((s) => (
          <label key={s} className={`sy-c-grade${noCsat ? ' off' : ''}`}>
            {s} {csat[s] || '–'}
            <select
              className="sy-c-select-native"
              aria-label={`${s} 모의 등급`}
              value={csat[s]}
              disabled={noCsat}
              onChange={(e) => setCsat((c) => ({ ...c, [s]: e.target.value }))}
            >
              <option value="">–</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={String(n)}>{n}등급</option>)}
            </select>
          </label>
        ))}
      </div>

      <button
        type="button"
        role="checkbox"
        aria-checked={noCsat}
        className={`sy-c-check${noCsat ? ' on' : ''}`}
        onClick={() => setNoCsat((v) => !v)}
      >
        <span className="sy-c-check-box">{noCsat && <Check size={16} strokeWidth={3} aria-hidden="true" />}</span>
        수능 볼 예정 아니에요
      </button>

      <p className="sy-c-foot">입력한 점수는 합격을 보장하지 않아요. 대학 모집요강을 함께 확인해요.</p>
    </div>
  );
}
