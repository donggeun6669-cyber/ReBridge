import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

const QUESTIONS = [
  {
    key: 'gedScore',
    title: '검정고시 평균 점수가 어느 정도예요?',
    hint: '대략만 골라도 돼요. 아직 안 봤다면 "아직 몰라요"를 눌러요.',
    options: ['60점대', '70점대', '80점대', '90점 이상', '아직 몰라요'],
  },
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

  function pick(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  const allAnswered = QUESTIONS.every((q) => answers[q.key]);

  function submit() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      /* localStorage 불가 시 무시 */
    }
    goTo('results', { profile: answers });
  }

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={() => goTo('home')}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">내 정보</span>
      </header>

      <div className="intro-line">몇 가지만 알려주세요</div>
      <div className="intro-sub">
        그래야 나에게 맞는 대학과 전형을 찾아드릴 수 있어요.
        <br />
        모르는 건 "아직 몰라요"를 눌러도 돼요.
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
        <button className="cta" onClick={submit} disabled={!allAnswered}>
          {allAnswered ? '나에게 맞는 길 보기' : '하나씩 골라주세요'}
        </button>
        <p className="reassure">입력한 정보는 이 기기에만 저장돼요. 로그인 필요 없어요.</p>
      </div>
    </div>
  );
}
