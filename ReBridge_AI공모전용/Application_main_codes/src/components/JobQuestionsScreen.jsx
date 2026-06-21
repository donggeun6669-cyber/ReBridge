import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { JOB_QUESTIONS } from '../data/jobData.js';
import { loadProfile } from '../lib/persona.js';

const STORAGE_KEY = 'rebridge_profile';

export default function JobQuestionsScreen({ goTo = () => {}, goBack = () => {}, canGoBack = true }) {
  const [answers, setAnswers] = useState(() => {
    const p = loadProfile();
    return p?.jobProfile || {};
  });

  function pick(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    const prev = loadProfile() || {};
    const next = { ...prev, jobProfile: answers };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
    goTo('job-home');
  }

  const answeredCount = JOB_QUESTIONS.filter((q) => answers[q.key]).length;

  return (
    <div className="screen">
      <header className="topbar center">
        {canGoBack && (
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
            <ArrowLeft size={22} />
          </button>
        )}
        <span className="page-title">내 취업 유형</span>
      </header>

      <div className="intro-line">4가지만 골라주세요</div>
      <div className="intro-sub">
        고른 답에 맞춰 나에게 맞는 길을 알려드려요.
        <br />
        모르는 건 안 골라도 괜찮아요.
      </div>

      {JOB_QUESTIONS.map((q) => (
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
        <button className="cta" onClick={submit}>
          {answeredCount > 0 ? '다 골랐어요, 다음으로' : '그냥 둘러볼래요'}
        </button>
        <p className="reassure">고른 답은 이 폰에만 저장돼요. 로그인 안 해도 돼요.</p>
      </div>
    </div>
  );
}
