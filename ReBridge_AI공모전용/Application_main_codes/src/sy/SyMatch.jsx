import { useEffect, useMemo, useState } from 'react';
import { Search, ClipboardPenLine, Target, ShieldCheck, Check, CircleHelp, Minus, Mountain } from 'lucide-react';
import SyTop from './SyTop.jsx';
import { analyzeProfile } from '../lib/analysis.js';
import { gedSubjectCount } from '../lib/scoreEngine.js';
import { loadProfile } from '../lib/persona.js';
import { csatBadgeOf, gapLabelOf } from './cUtil.js';
import './sy-c.css';

// 서연 UI 「나와 맞는 대학」 — 2026-09-28 시안 세 상태
//   불러오는 중 → 혼합 결과 / 결과 빈 화면(점수·정보가 없을 때)
// 계산은 예전 ResultsScreen 과 같은 analyzeProfile(수시 목록)을 그대로 쓴다.
// 칸수 5단계(scoreEngine.admissionChance): 5 안정 · 4 적정 · 3 소신 · 2 도전 · 1 어려움

const CHIPS = [
  { key: 'all', label: '전체' },
  { key: 5, label: '안정' },
  { key: 4, label: '적정' },
  { key: 3, label: '소신' },
  { key: 2, label: '도전' },
];
// 로딩 화면이 깜빡이고 사라지지 않게 최소한 보여 줄 시간(ms)
const MIN_LOADING = 700;

function LevelBadge({ r }) {
  if (!r.chance) {
    return <span className="sy-c-pill gray">{gapLabelOf(r)}</span>;
  }
  const lv = r.chance.level;
  const Icon = lv === 5 ? ShieldCheck : lv === 1 ? Mountain : Target;
  return (
    <span className={`sy-c-pill lv${lv}`}>
      <Icon size={15} strokeWidth={2.2} aria-hidden="true" /> {r.chance.label}
    </span>
  );
}

function CsatBadge({ b }) {
  if (b.kind === 'ok') {
    return <span className="sy-c-csat-ok"><Check size={13} strokeWidth={2.6} aria-hidden="true" />{b.label}</span>;
  }
  const Icon = b.kind === 'none' ? Minus : CircleHelp;
  return <span className="sy-c-pill gray"><Icon size={15} strokeWidth={2} aria-hidden="true" /> {b.label}</span>;
}

export default function SyMatch({ goTo, goBack }) {
  const profile = useMemo(loadProfile, []);
  const hasScore = !!profile && gedSubjectCount(profile.gedScores) > 0;
  const [data, setData] = useState(null);
  const [chip, setChip] = useState('all');

  // 첫 화면을 먼저 그린 뒤 계산한다(계산이 무거워 '불러오는 중'이 보이게)
  useEffect(() => {
    if (!hasScore) return undefined;
    const t0 = Date.now();
    let alive = true;
    const t = setTimeout(() => {
      const res = analyzeProfile(profile);
      const wait = Math.max(0, MIN_LOADING - (Date.now() - t0));
      setTimeout(() => { if (alive) setData(res); }, wait);
    }, 30);
    return () => { alive = false; clearTimeout(t); };
  }, [profile, hasScore]);

  const rows = useMemo(() => {
    const list = data?.susi?.results || [];
    if (chip === 'all') return list;
    return list.filter((r) => r.chance?.level === chip);
  }, [data, chip]);

  // ── 결과 빈 화면: 정보·점수가 아직 없을 때 ──
  if (!hasScore) {
    return (
      <div className="sy-screen sy-c-center-screen">
        <SyTop title="나와 맞는 대학" onBack={goBack} />
        <div className="sy-c-center">
          <div className="sy-c-empty-ico">
            <span><ClipboardPenLine size={28} strokeWidth={1.8} aria-hidden="true" /></span>
          </div>
          <p className="sy-c-center-title">먼저 내 정보를 알려주세요</p>
          <p className="sy-c-center-sub">학년·지역·점수를 입력하면 대학을 단계별로 보여드려요.</p>
          <button type="button" className="sy-btn sy-c-empty-btn" onClick={() => goTo('score')}>입력하러 가기</button>
        </div>
      </div>
    );
  }

  // ── 불러오는 중 ──
  if (!data) {
    return (
      <div className="sy-screen sy-c-center-screen">
        <SyTop title="나와 맞는 대학" onBack={goBack} />
        <div className="sy-c-center loading" role="status">
          <div className="sy-c-spinner" aria-hidden="true">
            <span className="sy-c-spinner-ring" />
            <span className="sy-c-spinner-badge"><Search size={26} strokeWidth={2} /></span>
          </div>
          <p className="sy-c-center-title">조건을 비교하고 있어요</p>
          <p className="sy-c-center-sub">모집요강과 입력한 정보를 살펴봐요.</p>
          <div className="sy-c-progress" aria-hidden="true"><span /></div>
        </div>
      </div>
    );
  }

  // ── 혼합 결과 ──
  const csatGrades = profile.csatGrades || null;
  return (
    <div className="sy-screen">
      <SyTop title="나와 맞는 대학" onBack={goBack} />

      <div className="sy-c-chips" role="tablist">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={chip === c.key}
            className={`sy-c-chip${chip === c.key ? ' on' : ''}`}
            onClick={() => setChip(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="sy-c-note">입력한 정보로 정리한 참고 결과예요. 모집요강을 꼭 확인해요.</p>

      {rows.length > 0 && (
        <div className="sy-c-list">
          {rows.map((r) => (
            <button
              key={r.univId}
              type="button"
              className="sy-c-row"
              onClick={() => goTo('detail', { univ: r.name, univId: r.univId })}
            >
              <span className="sy-c-row-line">
                <span className="sy-c-row-name">{r.name}</span>
                <LevelBadge r={r} />
              </span>
              <span className="sy-c-row-line">
                <span className="sy-c-row-sub">{[r.bestType, r.bestName].filter(Boolean).join(' · ')}</span>
                <CsatBadge b={csatBadgeOf(r, csatGrades)} />
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="sy-c-legend">
        <button
          type="button"
          className={`sy-c-hard${chip === 1 ? ' on' : ''}`}
          aria-pressed={chip === 1}
          onClick={() => setChip(chip === 1 ? 'all' : 1)}
        >
          <Mountain size={15} strokeWidth={2} aria-hidden="true" /> 어려움
        </button>
        <span className="sy-c-legend-text">5단계는 가능성을 비교하는 기준이에요.</span>
      </div>
    </div>
  );
}
