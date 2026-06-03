import { useState } from 'react';
import { GED_SUBJECTS, gedAverage, estimateGrade } from '../lib/scoreEngine';

const QUESTIONS = [
  {
    key: 'csatPlan',
    title: '수능도 볼 생각이에요?',
    hint: '수능을 보면 지원할 수 있는 길이 더 넓어져요.',
    options: ['볼 거예요', '안 볼 거예요', '고민 중이에요'],
  },
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
];

const STORAGE_KEY = 'rebridge_profile';

export default function ProfileScreen({ goTo = () => {} }) {
  const [answers, setAnswers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  });

  // 과목별 점수: 기존 프로필에 gedScores 있으면 사용, 없으면 빈 객체
  const [gedScores, setGedScores] = useState(() => {
    const init = {};
    const saved = answers.gedScores || {};
    GED_SUBJECTS.forEach((s) => {
      init[s] = saved[s] != null && saved[s] !== '' ? String(saved[s]) : '';
    });
    return init;
  });

  function pick(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function setSubject(subject, raw) {
    // 0~100 정수만 허용, 빈 값 허용
    let v = raw.replace(/[^0-9]/g, '');
    if (v !== '') {
      let n = Math.min(100, parseInt(v, 10));
      v = String(n);
    }
    setGedScores((prev) => ({ ...prev, [subject]: v }));
  }

  // 점수엔진이 기대하는 형태: 숫자 또는 미입력(빈문자)
  const numericScores = Object.fromEntries(
    GED_SUBJECTS.map((s) => [s, gedScores[s] === '' ? '' : Number(gedScores[s])])
  );
  const avg = gedAverage(numericScores);
  const myGrade = estimateGrade(avg);
  const filledCount = GED_SUBJECTS.filter((s) => gedScores[s] !== '').length;

  // 뒤로가기를 없앴으므로 제출(=화면 나가기)은 항상 가능. 미선택 항목은 기본값으로 처리.
  const canSubmit = true;

  function submit() {
    const next = {
      ...answers,
      gedScores: numericScores,
      gedAvg: avg,
      gedGrade: myGrade,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* localStorage 불가 시 무시 */
    }
    goTo('results', { profile: next });
  }

  return (
    <div className="screen">
      <header className="topbar center">
        <span className="page-title">내 정보</span>
      </header>

      <div className="intro-line">몇 가지만 알려주세요</div>
      <div className="intro-sub">
        검정고시 과목 점수를 넣으면 작년 합격선과 직접 비교해드려요.
        <br />
        아직 안 봤거나 모르는 과목은 비워둬도 괜찮아요.
      </div>

      {/* 과목별 점수 입력 (정밀) */}
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
            <span className="ged-note"> (대학별 환산표는 달라요 · 참고용)</span>
          </div>
        ) : (
          <div className="ged-summary muted">점수를 넣으면 평균과 추정 등급을 보여드려요.</div>
        )}
      </div>

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
        <button className="cta" onClick={submit} disabled={!canSubmit}>
          {canSubmit ? '나에게 맞는 길 보기' : '아래 질문을 골라주세요'}
        </button>
        <p className="reassure">입력한 정보는 이 기기에만 저장돼요. 로그인 필요 없어요.</p>
      </div>
    </div>
  );
}
