import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { JOB_QUESTIONS } from '../data/jobData.js';
import { loadProfile } from '../lib/persona.js';

const STORAGE_KEY = 'rebridge_profile';

export default function JobQuestionsScreen({ goTo = () => {}, goBack = () => {} }) {
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
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">내 취업 유형</span>
      </header>

      <div className="intro-line">몇 가지만 알려주세요</div>
      <div className="intro-sub">
        답에 맞춰 어떤 길과 지원이 있는지 안내해드려요.
        <br />
        모르는 건 비워둬도 괜찮아요.
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
          {answeredCount > 0 ? '저장하고 맞춤 정보 보기' : '건너뛰고 둘러보기'}
        </button>
        <p className="reassure">입력한 정보는 이 기기에만 저장돼요. 로그인 필요 없어요.</p>
      </div>
    </div>
  );
}
