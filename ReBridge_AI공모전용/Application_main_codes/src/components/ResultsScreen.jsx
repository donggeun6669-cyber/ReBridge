import { useMemo } from 'react';
import { ArrowLeft, MapPin, CheckCircle2, MessageCircle, Lightbulb } from 'lucide-react';
import { analyzeProfile } from '../lib/analysis.js';

const STORAGE_KEY = 'rebridge_profile';
const STATUS_LABEL = { ok: '검정고시 가능', cond: '조건부' };

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function profileChips(p) {
  if (!p) return [];
  const chips = [];
  if (p.gedScore) chips.push(p.gedScore === '아직 몰라요' ? '점수 미정' : `검정고시 ${p.gedScore}`);
  if (p.csatPlan) {
    const m = { '볼 거예요': '수능 볼 예정', '안 볼 거예요': '수능 안 봄', '고민 중이에요': '수능 고민 중' };
    chips.push(m[p.csatPlan] || p.csatPlan);
  }
  if (p.region && p.region !== '아직 몰라요') chips.push(p.region);
  return chips;
}

export default function ResultsScreen({ goTo = () => {} }) {
  const profile = useMemo(loadProfile, []);
  const data = useMemo(() => (profile ? analyzeProfile(profile) : null), [profile]);

  if (!profile) {
    return (
      <div className="screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="홈으로" onClick={() => goTo('home')}>
            <ArrowLeft size={22} />
          </button>
          <span className="page-title">나와 맞는 대학</span>
        </header>
        <div className="profile-card" style={{ marginTop: 40 }}>
          <span className="profile-name">먼저 내 정보를 알려주세요</span>
          <span className="profile-summary">몇 가지만 입력하면 맞춤 대학을 찾아드려요.</span>
          <button className="btn-outline" onClick={() => goTo('profile')}>
            정보 입력하기
          </button>
        </div>
      </div>
    );
  }

  const chips = profileChips(profile);

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="홈으로" onClick={() => goTo('home')}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">나와 맞는 대학</span>
      </header>

      <div className="result-summary">
        <div className="result-count">
          검정고시로 지원할 수 있는 대학 <b>{data.total}곳</b>이에요
        </div>
        <div className="profile-chips" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
          {chips.map((c) => (
            <span className="pchip" key={c}>
              {c}
            </span>
          ))}
          <button className="pchip pchip-edit" onClick={() => goTo('profile')}>
            수정
          </button>
        </div>
      </div>

      <div className="result-note">
        <Lightbulb size={16} />
        <p>{data.note}</p>
      </div>

      {data.shown < data.total && (
        <p className="result-more-hint">가장 잘 맞는 {data.shown}곳을 먼저 보여드려요.</p>
      )}

      <div className="result-list">
        {data.results.map((r) => (
          <button
            key={r.univId}
            className="result-card"
            onClick={() => goTo('detail', { univ: r.name, univId: r.univId })}
          >
            <div className="result-head">
              <div>
                <div className="result-name">{r.name}</div>
                <div className="result-region">
                  <MapPin size={12} /> {r.region}
                  {r.kind === '전문대학' ? ' · 전문대학' : ''}
                </div>
              </div>
              <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
            </div>

            <div className="result-tag">
              {r.bestType} · {r.bestName}
              {r.csat ? ` · ${r.csat}` : ''}
            </div>

            {r.reflection && (
              <div className="result-reflect">
                <CheckCircle2 size={14} /> {r.reflection}
              </div>
            )}

            <div className="result-next">
              <span className="result-next-label">👉 지금 할 일</span>
              {r.next}
            </div>
          </button>
        ))}
      </div>

      <p className="note">
        여기 나오는 곳은 <b>검정고시로 지원할 수 있는</b> 대학이에요.
        <br />
        실제 합격 가능성은 점수·경쟁률에 따라 달라요.
      </p>
    </div>
  );
}
