import { useMemo, useState } from 'react';
import { ArrowLeft, Check, AlertTriangle, X as XIcon, Info } from 'lucide-react';
import { getAdmissionInventory } from '../lib/analysis.js';
import { hasSpecialEligibility } from '../lib/scoreEngine.js';
import { ADMISSION_DATA_YEAR, PLAN_YEAR, GED_2027_SOURCE_LABEL } from '../data/meta.js';

// ── 전형별 지원 가능 여부 (2026-09) ──────────────────────────────────────
//
// 동근님 요청으로 만든 화면. "이 대학은 어떤 전형이 되고 어떤 전형이 안 되나"를
// 한 장에서 본다. 대학 상세는 '내 점수로 어디까지 되나'를 보는 곳이고,
// 여기는 '문이 어디에 몇 개 열려 있나'를 보는 곳이다. 목적이 다르니 화면을 나눴다.
//
// ⚠️ 두 학년도 자료를 합치지 말 것. 전형명이 서로 달라(2027 '학생부교과(일반전형)' vs
//    2028 '학생부우수자') 이름으로 짝지으면 없는 대응을 만들어낸다.
//    유형으로만 묶고, 행마다 학년도를 붙여 나란히 보여준다.
// ⚠️ 2027 자료에 없다고 '불가'라고 쓰지 말 것. 그 자료는 '지원 가능한 전형'만 모은
//    목록이라 불가 행이 아예 없다(0건). 안 실린 것이 불가라는 근거는 어디에도 없다.

const ELIG = {
  가능: { cls: 'ok', icon: Check, label: '지원 가능' },
  조건부: { cls: 'cond', icon: AlertTriangle, label: '조건 확인' },
  불가: { cls: 'no', icon: XIcon, label: '지원 불가' },
};

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'ok', label: '지원 가능' },
  { key: 'check', label: '조건부 · 불가' },
];

function EligBadge({ value }) {
  const e = ELIG[value];
  if (!e) return <span className="mx-badge unknown">확인 필요</span>;
  const Icon = e.icon;
  return (
    <span className={`mx-badge ${e.cls}`}>
      <Icon size={11} /> {e.label}
    </span>
  );
}

function Row({ r, year }) {
  const special = hasSpecialEligibility(r);
  return (
    <li className={`mx-row elig-${ELIG[r.gedEligible]?.cls || 'unknown'}`}>
      <div className="mx-row-top">
        <span className="mx-name">{r.admissionName}</span>
        <EligBadge value={r.gedEligible} />
      </div>
      <div className="mx-row-meta">
        <span className="mx-year">{year}학년도</span>
        {/* 2027 자료에는 수시/정시가 안 적힌 행이 있다(실기 348건 등).
            빈칸으로 두면 정시인 줄 오해하므로 '미상'이라고 밝힌다. */}
        <span>{r.phase || '수시/정시 미상'}</span>
        {r.quotaOutside && <span className="mx-tag">정원외</span>}
        {special && <span className="mx-tag">자격 제한</span>}
      </div>
      {r.gedIneligibleReason && <p className="mx-reason">{r.gedIneligibleReason}</p>}
      {/* 지원이 안 되는 전형에 "검정고시 반영: …"을 붙이면 말이 어긋난다.
          그 문구는 2028 자료의 유형별 기본 설명이라 불가 행에도 붙어 있다. */}
      {r.gedReflection && r.gedEligible !== '불가' && (
        <p className="mx-reflect">검정고시 반영: {r.gedReflection}</p>
      )}
    </li>
  );
}

export default function AdmissionMatrixScreen({ goBack = () => {}, univId, univName }) {
  const [filter, setFilter] = useState('all');
  const [phase, setPhase] = useState('전체');
  const inv = useMemo(() => getAdmissionInventory(univId), [univId]);

  if (!inv) {
    return (
      <div className="screen">
        <header className="topbar">
          <span className="topbar-left">
            <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
            <span className="page-title">전형별 지원 가능 여부</span>
          </span>
        </header>
        <div className="placeholder">
          <h2>{univName || '이 대학'} 자료가 없어요</h2>
          <p>전형 목록을 아직 모으지 못했어요.</p>
        </div>
      </div>
    );
  }

  const keep = (r) => {
    if (phase !== '전체' && r.phase !== phase) return false;
    if (filter === 'ok') return r.gedEligible === '가능';
    if (filter === 'check') return r.gedEligible === '조건부' || r.gedEligible === '불가';
    return true;
  };

  const groups = inv.groups
    .map((g) => ({ ...g, rows2027: g.rows2027.filter(keep), rows2028: g.rows2028.filter(keep) }))
    .filter((g) => g.rows2027.length > 0 || g.rows2028.length > 0);

  const shown = groups.reduce((n, g) => n + g.rows2027.length + g.rows2028.length, 0);

  // 수시/정시 필터를 걸면 '미상' 행이 조용히 사라진다. 몇 개가 빠졌는지 밝힌다.
  const hiddenByPhase = inv.groups.reduce(
    (n, g) => n + [...g.rows2027, ...g.rows2028].filter((r) => !r.phase).length,
    0
  );

  return (
    <div className="screen">
      <header className="topbar">
        <span className="topbar-left">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
          <span className="page-title">전형별 지원 가능 여부</span>
        </span>
      </header>

      <div className="mx-head">
        <h1 className="mx-univ">{inv.univ.name}</h1>
        <div className="mx-totals">
          <span className="mx-total ok"><b>{inv.totals.ok}</b> 지원 가능</span>
          <span className="mx-total cond"><b>{inv.totals.cond}</b> 조건 확인</span>
          <span className="mx-total no"><b>{inv.totals.no}</b> 지원 불가</span>
        </div>
      </div>

      <div className="mx-filters">
        <div className="mx-chiprow">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`mx-chip${filter === f.key ? ' on' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mx-chiprow">
          {['전체', '수시', '정시'].map((v) => (
            <button
              key={v}
              className={`mx-chip${phase === v ? ' on' : ''}`}
              onClick={() => setPhase(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {phase !== '전체' && hiddenByPhase > 0 && (
        <p className="mx-phase-note">
          수시/정시가 자료에 안 적힌 전형 {hiddenByPhase}개는 이 목록에서 빠져 있어요.
          ‘전체’를 누르면 같이 볼 수 있어요.
        </p>
      )}

      {shown === 0 && (
        <p className="mx-empty">조건에 맞는 전형이 없어요. 위 버튼을 바꿔보세요.</p>
      )}

      {groups.map((g) => (
        <section className="mx-group" key={g.label}>
          <div className="mx-group-head">
            <h2 className="mx-group-title">{g.label}</h2>
            <span className="mx-group-counts">
              {g.counts.ok > 0 && <span className="mx-mini ok">가능 {g.counts.ok}</span>}
              {g.counts.cond > 0 && <span className="mx-mini cond">조건 {g.counts.cond}</span>}
              {g.counts.no > 0 && <span className="mx-mini no">불가 {g.counts.no}</span>}
            </span>
          </div>

          {g.rows2027.length > 0 && (
            <>
              <p className="mx-src-label">
                {ADMISSION_DATA_YEAR}학년도 · {GED_2027_SOURCE_LABEL}
              </p>
              <ul className="mx-list">
                {g.rows2027.map((r, i) => <Row key={`a${i}`} r={r} year={ADMISSION_DATA_YEAR} />)}
              </ul>
            </>
          )}

          {g.rows2028.length > 0 && (
            <>
              <p className="mx-src-label">{PLAN_YEAR}학년도 대학입학전형 시행계획</p>
              <ul className="mx-list">
                {g.rows2028.map((r, i) => <Row key={`b${i}`} r={r} year={PLAN_YEAR} />)}
              </ul>
            </>
          )}
        </section>
      ))}

      <section className="mx-note">
        <div className="mx-note-title"><Info size={14} /> 두 학년도가 같이 나오는 이유</div>
        <p>
          <b>{ADMISSION_DATA_YEAR}학년도</b> 자료는 대교협이 모은 <b>‘검정고시로 지원할 수 있는 전형’ 목록</b>이에요.
          지원 가능한 것만 실려 있어서 여기엔 ‘불가’가 나오지 않아요.
          <b> 목록에 없다고 지원이 안 된다는 뜻은 아니에요.</b>
        </p>
        <p>
          <b>{PLAN_YEAR}학년도</b> 자료는 대학이 낸 시행계획이라 <b>전형 전체</b>가 들어 있어요.
          그래서 ‘불가’와 그 이유도 같이 볼 수 있어요. 대신 지금 원서를 쓰는 학년도와는 달라요.
        </p>
        <p className="mx-note-warn">
          두 해가 다르게 적혀 있으면 합치지 않고 그대로 보여드려요.
          최종 확인은 그 대학 모집요강에서 하세요.
        </p>
      </section>
    </div>
  );
}
