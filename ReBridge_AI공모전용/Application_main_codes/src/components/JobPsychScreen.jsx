import { ArrowLeft, ExternalLink } from 'lucide-react';
import { PSYCH_TESTS } from '../data/careerData.js';
import '../styles.job.css';

export default function JobPsychScreen({ goBack = () => {} }) {
  const youth = PSYCH_TESTS.filter((t) => t.target === '청소년');
  const adult = PSYCH_TESTS.filter((t) => t.target === '성인');

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">진로심리검사</span>
      </header>

      <div className="srm-intro">
        <span className="srm-intro-kicker">나부터 알아보기</span>
        <h2 className="srm-intro-title">뭐가 맞을지 모르겠다면<br />나를 먼저 알아봐요</h2>
      </div>

      <p className="job-reason" style={{ marginBottom: 13 }}>
        나라에서 만든 검사예요. 모두 <b>무료</b>고, 나한테 맞는 일을 알려줘요.
      </p>

      <PsychGroup tests={youth} />

      {adult.length > 0 && (
        <>
          <p className="ji-test-glabel">만 18세가 넘었다면, 어른용 검사도 있어요</p>
          <PsychGroup tests={adult} />
        </>
      )}

      <p className="note" style={{ marginTop: 18 }}>
        검사 결과는 정답이 아니라 참고예요. 여러 개 해보면 방향이 더 또렷해져요.
      </p>
    </div>
  );
}

function PsychGroup({ tests }) {
  return (
    <div className="ji-test-list">
      {tests.map((t) => (
        <a
          key={t.id}
          className="ji-test"
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="ji-test-text">
            <span className="ji-test-name">
              {t.name}<span className="ji-test-min">{t.minutes}</span>
            </span>
            <span className="ji-test-desc">{t.desc}</span>
          </span>
          <ExternalLink size={15} />
        </a>
      ))}
    </div>
  );
}
