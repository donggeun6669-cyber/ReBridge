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
        <h2 className="srm-intro-title">뭐가 맞을지 모르겠다면,<br />나를 먼저 알아봐요</h2>
      </div>

      <p className="job-reason" style={{ marginBottom: 13 }}>
        커리어넷 진로심리검사예요. 모두 <b>무료</b>고, 결과로 어울리는 분야를 추천받아요.
      </p>

      <PsychGroup tests={youth} />

      {adult.length > 0 && (
        <>
          <p className="ji-test-glabel">만 18세 이상이라면, 성인용 검사도 있어요</p>
          <PsychGroup tests={adult} />
        </>
      )}

      <p className="note" style={{ marginTop: 18 }}>
        검사 결과는 정답이 아니라 참고예요. 여러 검사를 함께 보면 방향을 더 또렷하게 잡을 수 있어요.
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
