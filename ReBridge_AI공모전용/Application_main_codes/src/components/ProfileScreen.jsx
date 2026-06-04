import { useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { GED_SUBJECTS, gedAverage, estimateGrade } from '../lib/scoreEngine';

const CURRENT_YEAR = 2026;
const EXAM_YEARS = ['2026', '2025', '2024', '2023', '2022 이전'];

const QUESTIONS = [
  {
    key: 'region',
    title: '어느 지역 대학이 좋아요?',
    hint: '나중에 언제든 바꿀 수 있어요.',
    options: ['전국 다 좋아요', '서울·수도권', '지방', '아직 몰라요'],
  },
  {
    key: 'field',
    title: '관심 있는 계열이 있어요?',
    hint: '정하지 않았어도 괜찮아요.',
    options: ['인문·사회', '자연·공학', '예체능', '아직 몰라요'],
  },
  {
    key: 'csatPlan',
    title: '수능도 볼 생각이에요?',
    hint: '수능을 보면 지원할 수 있는 길이 더 넓어져요.',
    options: ['볼 거예요', '안 볼 거예요', '고민 중이에요'],
  },
  {
    key: 'highSchool',
    title: '고등학교 재학 이력이 있어요?',
    hint: '서류 준비 안내에 영향을 줘요.',
    options: ['있어요 (자퇴·제적)', '없어요'],
  },
  {
    key: 'overseasSchool',
    title: '해외 학교 다닌 적 있어요?',
    hint: '해외고 이력이 있으면 추가 서류가 생겨요.',
    options: ['없어요', '있어요'],
  },
];

const STORAGE_KEY = 'rebridge_profile';

export default function ProfileScreen({ goTo = () => {}, goBack = () => {}, onComplete }) {
  const [answers, setAnswers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  });

  const [gedScores, setGedScores] = useState(() => {
    const init = {};
    const saved = answers.gedScores || {};
    GED_SUBJECTS.forEach((s) => {
      init[s] = saved[s] != null && saved[s] !== '' ? String(saved[s]) : '';
    });
    return init;
  });

  const [examYear,  setExamYear]  = useState(answers.examYear  || '');
  const [examRound, setExamRound] = useState(answers.examRound || '');

  const is2ndRound    = examRound === '2회차';
  const isCritical2nd = is2ndRound && examYear === String(CURRENT_YEAR);

  function pick(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function setSubject(subject, raw) {
    let v = raw.replace(/[^0-9]/g, '');
    if (v !== '') v = String(Math.min(100, parseInt(v, 10)));
    setGedScores((prev) => ({ ...prev, [subject]: v }));
  }

  const numericScores = Object.fromEntries(
    GED_SUBJECTS.map((s) => [s, gedScores[s] === '' ? '' : Number(gedScores[s])])
  );
  const avg        = gedAverage(numericScores);
  const myGrade    = estimateGrade(avg);
  const filledCount = GED_SUBJECTS.filter((s) => gedScores[s] !== '').length;

  function submit() {
    const next = {
      ...answers,
      gedScores: numericScores,
      gedAvg: avg,
      gedGrade: myGrade,
      examYear,
      examRound,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
    if (onComplete) onComplete();
    else goTo('results', { profile: next });
  }

  return (
    <div className="screen">
      <header className="topbar center">
        <span className="page-title">내 정보</span>
      </header>

      <div className="intro-line">몇 가지만 알려주세요</div>
      <div className="intro-sub">
        검정고시 점수를 넣으면 내게 맞는 대학과 전략을 알려드려요.
        <br />
        모르거나 아직 안 본 항목은 비워둬도 괜찮아요.
      </div>

      {/* ── 1. 시험 회차 ── */}
      <div className="field">
        <h3>검정고시 합격 회차</h3>
        <p className="hint">서류 제출 방식이 달라져요. 아직 안 봤으면 건너뛰어도 돼요.</p>

        <div className="profile-round-row">
          <select
            className="profile-year-select"
            value={examYear}
            onChange={(e) => setExamYear(e.target.value)}
            aria-label="합격 연도"
          >
            <option value="">연도 선택</option>
            {EXAM_YEARS.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <div className="opt-grid" style={{ flex: 1, marginTop: 0 }}>
            {['1회차', '2회차', '아직 안 봤어요'].map((opt) => (
              <button
                key={opt}
                className={`opt ${examRound === opt ? 'sel' : ''}`}
                onClick={() => setExamRound(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {is2ndRound && (
          <div className={`round-warning ${isCritical2nd ? 'critical' : 'caution'}`}>
            <AlertTriangle size={15} className="round-warn-ico" />
            <div className="round-warn-body">
              {isCritical2nd ? (
                <>
                  <b>수시 나이스 온라인 연동이 차단돼요!</b>
                  <p>
                    {CURRENT_YEAR}년 2회차 합격자는 수시 서류를 나이스 온라인으로
                    제출할 수 없어요. 성적증명서 <b>실물 원본을 등기우편으로</b> 직접
                    제출해야 해요.
                  </p>
                </>
              ) : (
                <>
                  <b>2회차 합격자 서류 확인 필요</b>
                  <p>
                    2회차 합격 연도·회차에 따라 수시 나이스 온라인 연동이
                    차단될 수 있어요. 지원 전 반드시 대학 입학처에 확인하세요.
                  </p>
                </>
              )}
              <a
                className="round-warn-link"
                href="https://kged.go.kr"
                target="_blank"
                rel="noopener noreferrer"
              >
                나이스 바로가기 <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. 과목별 점수 ── */}
      <div className="field">
        <h3>검정고시 과목 점수</h3>
        <p className="hint">과목당 100점 만점. 본 과목만 입력해도 돼요.</p>
        <div className="ged-grid">
          {GED_SUBJECTS.map((s) => (
            <label className="ged-cell" key={s}>
              <span className="ged-label">{s}</span>
              <input
                className="ged-input"
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                placeholder="–"
                value={gedScores[s]}
                onChange={(e) => setSubject(s, e.target.value)}
              />
            </label>
          ))}
        </div>
        {avg != null ? (
          <div className="ged-summary">
            입력 {filledCount}과목 · 평균 <b>{avg}점</b>
            <span className="ged-grade"> → 추정 {myGrade}등급</span>
            <span className="ged-note"> (참고용 · 대학별 환산표는 달라요)</span>
          </div>
        ) : (
          <div className="ged-summary muted">점수를 넣으면 평균과 추정 등급을 보여드려요.</div>
        )}
      </div>

      {/* ── 3. 나머지 질문 ── */}
      {QUESTIONS.map((q) => (
        <div className="field" key={q.key}>
          <h3>{q.title}</h3>
          <p className="hint">{q.hint}</p>
          <div className="opt-grid">
            {q.options.map((opt) => (
              <button
                key={opt}
                className={`opt ${answers[q.key] === opt ? 'sel' : ''}`}
                onClick={() => pick(q.key, opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="form-foot">
        <button className="cta" onClick={submit}>나에게 맞는 길 보기</button>
        <p className="reassure">입력한 정보는 이 기기에만 저장돼요. 로그인 필요 없어요.</p>
      </div>
    </div>
  );
}
