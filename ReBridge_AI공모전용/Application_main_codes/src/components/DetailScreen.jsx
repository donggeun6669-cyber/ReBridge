import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MapPin, ExternalLink, Target, Users, MessageSquare,
  ChevronDown, Table2, Info, Lock, FileCheck2, Bookmark, Sparkles,
  CalendarClock, FileText, AlertCircle,
} from 'lucide-react';
import { getUniversityDetail, getUniversityDetailByName } from '../lib/analysis.js';
import { isBookmarked, toggleBookmark } from '../lib/bookmarks.js';
import {
  evaluateAdmission, coachLine, gedAffinity, admissionChance,
  getComparative, comparativeAvailability, gedFit,
  applyComparativeConversion, gedAverage, gradeToMinAvg,
  gedFreshmenStanding,
} from '../lib/scoreEngine.js';
import { loadGedText2027, matchGedTextEntry } from '../lib/gedText2027.js';
import { loadCompText2027 } from '../lib/compText2027.js';
import DocumentsChecklist from './DocumentsChecklist.jsx';
import ChanceGauge from './ChanceGauge.jsx';
import { loadProfile } from '../lib/persona.js';
import {
  CUTLINE_LABEL, CUTLINE_NO_DATA_LABEL, CUTLINE_NO_DATA_SHORT,
  CUTLINE_SCALE_NOTICE, CUTLINE_SOURCE_LABEL, CUTLINE_TYPE_NOTICE,
  PLAN_BASIS_NOTICE, STANDARD_CONVERSION_NOTICE,
  ADMISSION_2027_SECTION_TITLE, ADMISSION_2027_SOURCE_NOTICE,
  PLAN_SECTION_TITLE, NO_2027_DATA_LABEL, NO_2027_DATA_NOTICE,
  PHASE_ESTIMATED_NOTICE, QUOTA_OUTSIDE_TITLE, QUOTA_OUTSIDE_NOTICE,
  YEAR_SPLIT_NOTICE, ADMISSION_DATA_YEAR, PLAN_YEAR,
  CUTLINE_YEAR, cutlineFallbackNotice, cutlineVolatilityNotice,
  applyDeadline,
} from '../data/meta.js';

function cleanCsat(raw) {
  if (!raw) return '모집요강 확인';
  if (raw.includes('해당없음')) return '해당 없음';
  return raw;
}

// 비교내신 환산 계산 근거 텍스트 생성
function conversionBasis(profile, comp) {
  if (!profile?.gedScores) return null;
  const avg = gedAverage(profile.gedScores);
  if (avg == null) return null;

  const result = applyComparativeConversion(avg, profile.gedScores, comp);
  const { grade, score, method } = result;
  const conv = comp?.conversion;

  const lines = [];
  lines.push(`내 검정고시 평균: ${avg}점`);

  switch (method) {
    case 'grade_table': {
      const row = conv?.gradeTable?.find((r) => avg >= (r.minAvg ?? -Infinity) && avg <= (r.maxAvg ?? Infinity));
      if (row) {
        const bandEstimated = conv?.gradeBandSource === 'app_standard_estimate';
        lines.push(`${bandEstimated ? '표준 추정 구간' : '대학 공개 환산표'} 적용: ${row.minAvg ?? 0}~${row.maxAvg ?? 100}점 → ${grade}등급`);
        if (score != null) lines.push(`환산 점수: ${score}점 (대학 공식 등급별 환산점수)`);
        lines.push(bandEstimated
          ? '등급 구간은 앱 표준 추정이고, 등급별 환산점수만 대학이 공식 발표한 값이에요.'
          : '이 수치는 대학이 공식 발표한 비교내신 환산표 기반이에요.');
      }
      break;
    }
    case 'score_table': {
      lines.push(`대학 공개 점수표 적용 → 환산점수 ${score}점 → 추정 ${grade}등급`);
      lines.push('점수표에서 등급을 역산한 결과예요.');
      break;
    }
    case 'score_formula': {
      const f = conv?.scoreFormula;
      lines.push(`점수 산출식 적용: 기준 점수 ${f?.maxScore} - (등급-1)×${f?.gradeCoeff}`);
      if (score != null) lines.push(`산출된 교과 점수: ${score}점`);
      lines.push(`추정 등급: ${grade}등급 (표준 추정표 기반)`);
      break;
    }
    case 'formula_complex': {
      const p = conv?.formulaParams;
      lines.push(`복합 산출식: 최고 ${p?.maxScore}점, 기준 ${p?.baseScore}점 적용`);
      if (score != null) lines.push(`산출된 교과 점수: ${score}점`);
      lines.push(`추정 등급: ${grade}등급`);
      break;
    }
    case 'subject_weighted': {
      lines.push('과목별 환산점수 + 가중치 방식 적용');
      const weights = conv?.subjectWeights || {};
      for (const [subj, w] of Object.entries(weights)) {
        const s = profile.gedScores[subj];
        if (s != null) lines.push(`  ${subj}: ${s}점 (가중치 ${w})`);
      }
      if (score != null) lines.push(`가중 합산 점수: ${score}점`);
      break;
    }
    default: {
      lines.push(`비교내신 환산표 없음 → 표준 추정표 적용`);
      lines.push(`검정고시 평균 ${avg}점 → 추정 ${grade}등급`);
      lines.push('※ 이 수치는 일반적인 내신 환산 추정값이에요. 실제 대학별 환산식과 다를 수 있어요.');
    }
  }

  return { lines, grade, score, method };
}

// ── 원서 접수 마감 D-day 배지 ─────────────────────────────────────────
function DeadlineBadge({ row, today }) {
  const dl = applyDeadline(row.applyCloseDate, row.applyCloseTime, today);
  if (!dl) return null;
  const tone = dl.past ? 'past' : dl.days <= 3 ? 'urgent' : dl.days <= 10 ? 'soon' : 'far';
  return (
    <span className={`dday-badge dday-${tone}`}>
      <CalendarClock size={11} />
      {dl.label} · {dl.dateLabel} 마감
    </span>
  );
}

// ── 환산표 근거 원문 (모집요강 발췌, public에서 필요할 때만 fetch) ─────
// 비교내신 산출 관련 쪽만 뽑은 발췌라서, 원본 PDF 링크를 반드시 함께 보여준다.
function CompRawText({ univId, phase }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: 'idle', data: null, error: null });

  const fetchText = useCallback(() => {
    setState({ status: 'loading', data: null, error: null });
    loadCompText2027(univId)
      .then((data) => setState({ status: 'done', data, error: null }))
      .catch((err) => setState({ status: 'error', data: null, error: err?.message || '불러오지 못했어요' }));
  }, [univId]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && state.status === 'idle') fetchText();
  }

  const data = state.data;
  // 실제로 환산표를 뽑아낸 쪽(cited)만. 지금 보는 전형의 phase 것을 앞에 둔다.
  const pages = (data?.pages || [])
    .filter((p) => p.cited)
    .sort((a, b) => (a.phase === phase ? -1 : 0) - (b.phase === phase ? -1 : 0));

  return (
    <div className="ged-raw">
      <button className="ged-raw-toggle" onClick={toggle} aria-expanded={open}>
        <FileText size={13} />
        {open ? '환산표 근거 원문 접기' : '환산표 근거 원문 보기 (2027 모집요강 발췌)'}
        <ChevronDown size={14} className={`ged-raw-chev${open ? ' on' : ''}`} />
      </button>

      {open && (
        <div className="ged-raw-body">
          {state.status === 'loading' && <p className="ged-raw-note">원문을 불러오는 중이에요…</p>}
          {state.status === 'error' && (
            <p className="ged-raw-note error">
              <AlertCircle size={12} /> {state.error}
              <button className="ged-raw-retry" onClick={fetchText}>다시 시도</button>
            </p>
          )}
          {state.status === 'done' && pages.length === 0 && (
            <p className="ged-raw-note">이 대학의 환산표 발췌가 자료에 없어요. 아래 모집요강 원본에서 확인하세요.</p>
          )}
          {state.status === 'done' && pages.map((p, idx) => (
            <div key={idx} className="ged-raw-entry">
              <p className="ged-raw-src">{p.sourceFile} · p.{p.page}{p.phase ? ` · ${p.phase}` : ''}</p>
              <pre>{p.text}</pre>
            </div>
          ))}
          {state.status === 'done' && (
            <p className="ged-raw-note">
              * 비교내신 관련 쪽만 발췌한 것이라 모집요강 전체가 아니에요. 전체 원문:{' '}
              {(data?.sources || []).map((src, i) => (
                <a key={i} href={src.sourceUrl} target="_blank" rel="noreferrer">
                  {src.phase || '요강'} PDF{i < data.sources.length - 1 ? ' · ' : ''}
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── 지원자격 원문 (public에서 필요할 때만 fetch) ───────────────────────
// 요약하지 않는다. 대교협 자료의 common/detail/extra를 쪽수와 함께 그대로 보여준다.
function RequirementText({ univId, row }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: 'idle', entry: null, error: null });

  const fetchText = useCallback(() => {
    setState({ status: 'loading', entry: null, error: null });
    loadGedText2027(univId)
      .then((entries) => {
        setState({ status: 'done', entry: matchGedTextEntry(entries, row), error: null });
      })
      .catch((err) => {
        setState({ status: 'error', entry: null, error: err?.message || '불러오지 못했어요' });
      });
  }, [univId, row]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && state.status === 'idle') fetchText();
  }

  const entry = state.entry;
  const reqs = entry?.requirements || [];

  return (
    <div className="ged-raw">
      <button className="ged-raw-toggle" onClick={toggle} aria-expanded={open}>
        <FileText size={13} />
        {open ? '지원자격 원문 접기' : '지원자격 원문 보기'}
        <ChevronDown size={14} className={`ged-raw-chev${open ? ' on' : ''}`} />
      </button>

      {open && (
        <div className="ged-raw-body">
          {state.status === 'loading' && <p className="ged-raw-note">원문을 불러오는 중이에요…</p>}
          {state.status === 'error' && (
            <p className="ged-raw-note error">
              <AlertCircle size={12} /> {state.error}
              <button className="ged-raw-retry" onClick={fetchText}>다시 시도</button>
            </p>
          )}
          {state.status === 'done' && !entry && (
            <p className="ged-raw-note">이 전형의 지원자격 원문이 자료에 없어요.</p>
          )}
          {state.status === 'done' && entry && (
            <>
              {entry.gedQuote && (
                <blockquote className="ged-quote">{entry.gedQuote}</blockquote>
              )}
              {reqs.length === 0 && (
                <p className="ged-raw-note">이 전형의 지원자격 원문이 자료에 없어요.</p>
              )}
              {reqs.map((q, i) => (
                <div className="ged-req" key={i}>
                  <div className="ged-req-head">
                    지원자격 {reqs.length > 1 ? `${i + 1}` : ''}
                    {q.page != null && <span className="ged-req-page">원문 {q.page}쪽</span>}
                  </div>
                  {q.common && (
                    <div className="ged-req-part">
                      <span className="ged-req-label">공통</span>
                      <pre>{q.common}</pre>
                    </div>
                  )}
                  {q.detail && (
                    <div className="ged-req-part">
                      <span className="ged-req-label">세부</span>
                      <pre>{q.detail}</pre>
                    </div>
                  )}
                  {q.extra && (
                    <div className="ged-req-part">
                      <span className="ged-req-label">추가</span>
                      <pre>{q.extra}</pre>
                    </div>
                  )}
                </div>
              ))}
              {entry.sourceFile && (
                <p className="ged-raw-source">출처 파일: {entry.sourceFile}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DetailScreen({ goTo = () => {}, goBack = () => {}, univId, univName }) {
  const profile = useMemo(loadProfile, []);
  const [openRows, setOpenRows] = useState(() => new Set());
  const [openPlanRows, setOpenPlanRows] = useState(() => new Set());
  const [showCalcBasis, setShowCalcBasis] = useState(false);
  const [showQuota, setShowQuota] = useState(false);
  // D-day 기준 '오늘'은 렌더마다 새로 만들지 않는다(같은 화면에서 값이 흔들리지 않게)
  const today = useMemo(() => new Date(), []);

  const detail = useMemo(() => {
    if (univId) return getUniversityDetail(univId);
    if (univName) return getUniversityDetailByName(univName);
    return null;
  }, [univId, univName]);

  // 관심 대학(북마크) — bmId가 바뀌면(다른 대학으로 이동) 상태 재동기화
  const bmId = detail?.univ?.univId || univId || null;
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    setMarked(isBookmarked(bmId));
  }, [bmId]);
  const handleBookmark = () => setMarked(toggleBookmark(bmId));

  if (!detail) {
    return (
      <div className="screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
            <ArrowLeft size={22} />
          </button>
          <span className="page-title">대학 정보</span>
        </header>
        <div className="placeholder">
          <h2>아직 정보가 없어요</h2>
          <p>이 대학의 전형 정보는 곧 채워질 예정이에요.</p>
        </div>
      </div>
    );
  }

  const { univ, rows, eligibleCount, is2027, planRows, quotaRows } = detail;
  const okRows = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
  const noRows = rows.filter((r) => r.gedEligible === '불가');

  const hasScore = !!(profile && profile.gedScores && profile.gedAvg != null);
  const isTarget = hasScore && profile.scoreMode === 'target'; // 공부 중 = 목표 점수
  const myAvg = hasScore ? profile.gedAvg : null;
  const realUnivId = univ.univId;
  const comp = getComparative(realUnivId);
  const compAvail = comparativeAvailability(comp);
  const compType = comp?.comparativeGradeType === 'numeric_table' ? 'numeric' : comp ? 'prose' : 'none';
  // 검정고시 출신 신입생 실측 통계(대학알리미). 자료 없는 대학은 null.
  const gedStanding = gedFreshmenStanding(realUnivId);
  // 합격선 출처가 4년제(대교협)냐 전문대(전문대교협)냐를 가른다.
  const isCollege = univ.kind === '전문대학';
  const calcBasis = hasScore ? conversionBasis(profile, comp) : null;

  // 각 가능 전형 평가
  const evals = okRows.map((r) => {
    const ev = hasScore
      ? evaluateAdmission(profile, { ...r, univId: realUnivId })
      : null;
    return { r, ev, chance: ev ? admissionChance(ev) : null, fit: gedFit(r, compType) };
  });

  // 2028 시행계획을 '구조 참고'로만 따로 보여줄지 — 2027 자료가 있는 대학만 해당.
  // 2027이 없는 대학은 위 목록 자체가 2028이므로 중복해서 보여주지 않는다.
  const showPlanSection = is2027 && planRows.length > 0;

  // 접수 마감이 가장 급한 전형 (상단 요약용)
  // ⚠️ 훅이 아니다 — 위쪽에 조기 return이 있어서 useMemo를 여기 두면 훅 순서가 깨진다.
  let nearestDeadline = null;
  for (const r of okRows) {
    const dl = applyDeadline(r.applyCloseDate, r.applyCloseTime, today);
    if (!dl || dl.past) continue;
    if (!nearestDeadline || dl.days < nearestDeadline.days) nearestDeadline = dl;
  }

  // 담임 한마디 — 점수 있으면 칸수 분포로, 없으면 전형 안내
  let coachSummary;
  if (hasScore) {
    const levels = evals.map((e) => e.chance?.level).filter((v) => v != null);
    const safe = levels.filter((l) => l >= 4).length;
    const reach = levels.filter((l) => l === 3).length;
    if (levels.length === 0) {
      coachSummary = `검정고시로 지원 가능한 전형이 ${eligibleCount}개 있어요. 다만 ${CUTLINE_NO_DATA_SHORT}이라 점수 비교는 어려워요.`;
    } else if (safe > 0) {
      coachSummary = `${isTarget ? '목표' : '지금'} 점수(평균 ${profile.gedAvg}점)면 ${safe}개 전형이 적정~안정권이에요. 충분히 노려볼 만해요!`;
    } else if (reach > 0) {
      coachSummary = `조금 부족하지만 ${reach}개 전형은 소신 지원이 가능해요. 합격선까지 얼마 안 남았어요.`;
    } else {
      coachSummary = `아직 합격선까지 거리가 있어요. 부족한 점수를 같이 채워봐요.`;
    }
  } else {
    coachSummary = `검정고시로 지원할 수 있는 전형이 ${eligibleCount}개 있어요. 내 점수를 넣으면 합격 가능성까지 보여드릴게요.`;
  }

  function toggle(i) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }
  function togglePlan(i) {
    setOpenPlanRows((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">대학 정보</span>
        <button
          className={`icon-btn topbar-right ${marked ? 'on' : ''}`}
          aria-label={marked ? '관심 대학에서 빼기' : '관심 대학에 담기'}
          aria-pressed={marked}
          onClick={handleBookmark}
        >
          <Bookmark size={20} fill={marked ? 'currentColor' : 'none'} />
        </button>
      </header>

      <div className="detail-header">
        <div className="detail-univ-name">{univ.name}</div>
        <div className="detail-meta">
          <MapPin size={13} /> {univ.region}
          {univ.establishment ? ` · ${univ.establishment}` : ''}
          {univ.kind === '전문대학' ? ' · 전문대학' : ''}
        </div>
        {univ.admissionOfficeUrl && (
          <a
            className="detail-officelink"
            href={univ.admissionOfficeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            입학처 바로가기 <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* 담임 한마디 */}
      <div className="coach-panel">
        <span className="coach-panel-ico"><MessageSquare size={18} /></span>
        <div className="coach-panel-body">
          <span className="coach-panel-kicker">담임 한마디</span>
          <span className="coach-panel-text">{coachSummary}</span>
          {nearestDeadline && (
            <span className="coach-panel-dday">
              <CalendarClock size={13} /> 가장 빠른 원서 접수 마감 {nearestDeadline.label}
              {' · '}{nearestDeadline.dateLabel}
            </span>
          )}
          {!hasScore && (
            <button className="coach-panel-cta" onClick={() => goTo('profile')}>
              내 점수 입력하기
            </button>
          )}
        </div>
      </div>

      {/* 검정고시 출신 신입생 — 대학알리미 공시 실측값.
          합격선은 일반학생 기준 추정이라, "실제로 검정고시로 들어간 사람이 있나"에
          답해주는 건 이 숫자뿐이다. 자료가 있는 대학에만 나온다. */}
      {gedStanding && (
        <div className="ged-freshmen">
          <div className="ged-freshmen-head">
            <Users size={15} />
            <b>검정고시로 입학한 선배</b>
            <span className="ged-freshmen-year">{gedStanding.year}학년도</span>
          </div>
          <p className="ged-freshmen-main">
            신입생 {gedStanding.total.toLocaleString()}명 중{' '}
            <b>{gedStanding.ged.toLocaleString()}명</b>이 검정고시 출신이에요
            {' '}({gedStanding.ratio}%).
          </p>
          {gedStanding.times != null && (
            <p className="ged-freshmen-sub">
              전국 평균은 {gedStanding.nationalRatio}%예요.{' '}
              {gedStanding.level === 'high'
                ? `이 대학은 그보다 ${gedStanding.times}배 많아요.`
                : gedStanding.level === 'low'
                  ? '이 대학은 그보다 적은 편이에요.'
                  : '전국 평균과 비슷한 수준이에요.'}
            </p>
          )}
          <p className="ged-freshmen-src">
            출처: 대학알리미 신입생 출신고교유형별 현황 · 검정고시 전형만이 아니라
            모든 전형으로 입학한 검정고시 출신자를 합친 수예요.
          </p>
        </div>
      )}

      {/* 2027 자료가 없는 대학 — 무엇을 보고 있는지 먼저 밝힌다 */}
      {!is2027 && (
        <div className="year-warn">
          <AlertCircle size={15} />
          <div>
            <b>{NO_2027_DATA_LABEL}</b>
            <p>{NO_2027_DATA_NOTICE}</p>
          </div>
        </div>
      )}

      {okRows.length > 0 && (
        <>
          <div className="detail-section-title">
            {is2027 ? ADMISSION_2027_SECTION_TITLE : PLAN_SECTION_TITLE}
            <span className="count-pill">{okRows.length}</span>
          </div>
          {is2027 && <p className="section-sub">{YEAR_SPLIT_NOTICE}</p>}
          <div className="result-list">
            {evals.map(({ r, ev, chance, fit }, i) => {
              const aff = gedAffinity(r);
              const open = openRows.has(i);
              const rowComp = r.comparativeGrade || (comp ? comp.comparativeGrade : null);
              const is2027Row = r.dataYear === ADMISSION_DATA_YEAR;
              return (
                <article className={`adm-card ${open ? 'open' : ''}`} key={`${r.admissionName}-${i}`}>
                  {/* 요약(항상 보임) */}
                  <button className="adm-summary" onClick={() => toggle(i)}>
                    <div className="adm-summary-top">
                      <span className="adm-name">{r.admissionName}</span>
                      {chance ? (
                        <ChanceGauge chance={chance} />
                      ) : (
                        <span className={`fit-tag fit-${fit.level}`}>
                          <Sparkles size={11} /> {fit.label}
                        </span>
                      )}
                    </div>
                    <div className="adm-summary-meta">
                      {r.phase || '수시/정시 미상'} · {r.admissionType || '전형유형 미상'}
                      <span className={`affinity-mini ${aff.tone}`}>검정고시 {aff.grade}</span>
                    </div>
                    {is2027Row && r.applyCloseDate && (
                      <div className="adm-summary-meta">
                        <DeadlineBadge row={r} today={today} />
                      </div>
                    )}
                    {/* 한 줄 코치 / 데이터 부재 안내 */}
                    {ev && ev.applicable && (
                      <div className="adm-oneline">{coachLine(ev)}</div>
                    )}
                    {ev && !ev.applicable && (
                      <div className="adm-oneline muted">
                        <Info size={12} /> {ev.dataGap === 'csat' ? '수능 기준 전형 — 검정고시 평균으로 비교 어려움' : CUTLINE_NO_DATA_SHORT}
                      </div>
                    )}
                    <ChevronDown size={18} className="adm-chevron" />
                  </button>

                  {/* 상세(펼침) */}
                  {open && (
                    <div className="adm-detail">
                      {/* 검정고시 지원 가부 — 2027 자료는 수록 자체가 '지원 가능'이라는 뜻 */}
                      {is2027Row && (
                        <div className="adm-block ged2027-block">
                          <div className="adm-block-title">
                            <FileCheck2 size={13} /> 검정고시 지원 가부
                            <span className={`avail-tag ${r.gedEligible === '가능' ? 'on' : 'off'}`}>
                              {r.gedEligible}
                            </span>
                          </div>
                          <p className="adm-block-desc">
                            {r.gedEligible === '가능'
                              ? `${ADMISSION_DATA_YEAR}학년도 대교협 자료에 검정고시 지원 가능 전형으로 실려 있어요.`
                              : '검정고시 지원에 별도 조건이 붙는 전형이에요. 아래 원문을 꼭 확인하세요.'}
                          </p>
                          {r.gedEligible === '조건부' && r.gedIneligibleReason && (
                            <div className="adm-reason">{r.gedIneligibleReason}</div>
                          )}
                          {r.applyCloseDate && (
                            <div className="adm-need">
                              <CalendarClock size={13} />
                              <span>
                                원서 접수 마감 <b>{applyDeadline(r.applyCloseDate, r.applyCloseTime, today)?.dateLabel}</b>
                                {' '}({applyDeadline(r.applyCloseDate, r.applyCloseTime, today)?.label})
                              </span>
                            </div>
                          )}
                          {r.phaseBasis === 'type' && (
                            <div className="adm-disclaimer">{PHASE_ESTIMATED_NOTICE}</div>
                          )}
                          <RequirementText univId={realUnivId} row={r} />
                          {r.source && <p className="adm-src">출처: {r.source}</p>}
                        </div>
                      )}

                      {/* 검정고시 적합도 — 합격 가능성이 아니라 '지원하기 좋은 정도'(비확률적) */}
                      <div className="adm-block fit-block">
                        <div className="adm-block-title">
                          <Sparkles size={13} /> 검정고시 적합도
                          <span className={`fit-tag fit-${fit.level}`} style={{ marginLeft: 'auto' }}>
                            {fit.label}
                          </span>
                        </div>
                        <ul className="fit-reasons">
                          {fit.reasons.map((rs, ri) => (
                            <li key={ri}>{rs}</li>
                          ))}
                        </ul>
                        <p className="fit-disclaim">
                          ※ 합격 확률이 아니라, 검정고시생이 <b>지원하기 좋은 정도</b>예요.
                        </p>
                      </div>

                      {/* 합격선 블록 */}
                      {ev && ev.applicable && ev.cutGrade != null ? (
                        <div className="adm-block">
                          {/* 연도는 ev.cutlineYear를 쓴다 — 최신 자료가 없어 이전 학년도로
                              내려간 전형이 있어서, 제목을 고정하면 다른 해 값을 다른 해
                              이름으로 보여주게 된다. */}
                          <div className="adm-block-title">{ev.cutlineYear ?? CUTLINE_YEAR}학년도 합격선</div>
                          <div className="adm-cut">
                            약 <b>{ev.cutGrade}등급</b>
                            {/* 컷 종류·집계 근거·신뢰도. 하나도 없으면 괄호 자체를 생략한다. */}
                            {(() => {
                              const cutType = ev.cutGradeType ?? ev.cutScoreType ?? null;
                              const parts = [];
                              if (cutType) parts.push(cutType);
                              // cutN은 '학생 수'가 아니라 집계에 쓴 모집단위 행 수다.
                              if (ev.cutN) parts.push(`모집단위 ${ev.cutN}개 기준(전체 중앙값)`);
                              if (ev.cutConfidence === 'high') parts.push('신뢰도 높음');
                              else if (ev.cutConfidence === 'mid') parts.push('신뢰도 보통');
                              if (parts.length === 0) return null;
                              return (
                                <span className="adm-cut-meta"> ({parts.join(' · ')})</span>
                              );
                            })()}
                          </div>
                          {/* 합격자 최저 등급 — 전문대 자료에만 있다.
                              평균은 "보통 이 정도로 붙는다"이고, 최저는 "이 등급까지도 붙었다"라
                              지원을 망설이는 사람에게는 이쪽이 더 중요한 정보다. */}
                          {ev.cutGradeLowest != null && (
                            <div className="adm-cut-lowest">
                              합격자 중 가장 낮은 등급은 <b>{ev.cutGradeLowest}등급</b>이었어요
                              {ev.cutGrade != null && ' (평균은 위 숫자예요)'}.
                            </div>
                          )}
                          {/* 몇 점 맞아야 하는지 글로 풀어주기 —
                              판정 문구는 반드시 ev.verdict와 같은 기준으로만 말한다.
                              (예전엔 평균만 비교해서 verdict가 '도전'인데 "충분해요"라고 하는 모순이 있었다) */}
                          {(() => {
                            if (ev.scaleMismatch) return null; // 등급 체계가 달라 점수 비교 불가
                            const need = ev.neededAvg ?? gradeToMinAvg(ev.cutGrade);
                            if (need == null || need <= 0) return null;
                            const key = ev.verdict?.key ?? null;
                            const enough = key === 'safe' || key === 'fit';
                            const who = isTarget ? '목표' : '내';
                            let tail = null;
                            if (key && myAvg != null) {
                              if (enough) {
                                tail = ` ${who} 평균 ${myAvg}점이면 ${ev.verdict.label}권이에요 👍`;
                              } else if (ev.shortPoints > 0) {
                                tail = ` ${who} 평균 ${myAvg}점에서 약 ${ev.shortPoints}점 더 필요해요.`;
                              } else {
                                tail = ` ${who} 평균 ${myAvg}점은 ${ev.verdict.label} 지원권이에요.`;
                              }
                            }
                            return (
                              <div className="adm-need">
                                <Target size={13} />
                                <span>
                                  검정고시 <b>평균 약 {need}점</b> 이상이면 이 합격선에 닿아요.
                                  {tail}
                                </span>
                              </div>
                            );
                          })()}
                          {ev.conversionMethod === 'standard' && (
                            <div className="adm-disclaimer">{STANDARD_CONVERSION_NOTICE}</div>
                          )}
                          {ev.gradeBandEstimated && (
                            <div className="adm-disclaimer">
                              이 대학은 등급별 환산점수만 공개했어요. 검정고시 평균을 등급으로 바꾸는 구간은 표준 추정이라, 등급 판정은 참고값이에요.
                            </div>
                          )}
                          {/* 최신 학년도 자료가 없어 이전 학년도를 쓴 경우 — 연도를 감추지 않는다 */}
                          {ev.cutlineIsFallbackYear && (
                            <div className="adm-disclaimer">{cutlineFallbackNotice(ev.cutlineYear)}</div>
                          )}
                          {/* 두 해가 크게 다르면 두 해를 나란히 알린다.
                              집계 학과 수가 너무 달라 견줄 수 없는 경우도 그 사실을 그대로 말한다. */}
                          {cutlineVolatilityNotice(ev.cutlineVolatility) && (
                            <div className="adm-disclaimer">
                              {cutlineVolatilityNotice(ev.cutlineVolatility)}
                            </div>
                          )}
                          <div className="adm-disclaimer">{CUTLINE_SCALE_NOTICE}</div>
                          {/* 4년제와 전문대는 자료를 낸 곳이 다르다. 출처를 뭉뚱그리지 않는다. */}
                          <p className="adm-src">
                            출처: {isCollege ? '전문대교협 전문대학포털' : '대교협 어디가'}{' '}
                            {ev.cutlineYear ?? CUTLINE_YEAR}학년도 전형결과
                          </p>
                        </div>
                      ) : (
                        <div className="adm-block adm-block-empty">
                          <div className="adm-empty-row">
                            <Lock size={14} />
                            <div>
                              <b>{ev?.dataGap === 'csat' ? '수능 기준 전형이에요' : CUTLINE_NO_DATA_LABEL}</b>
                              <p>{ev?.reason || '점수를 입력하면 비교해드릴게요.'}</p>
                              {(r.admissionType === '논술' || r.admissionType === '실기') && (
                                <p>{CUTLINE_TYPE_NOTICE}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 전형 요소 — 2028 시행계획 행에만 있는 정보 */}
                      {!is2027Row && (
                        <div className="adm-facts">
                          <span className="fact"><Target size={13} /> 수능최저 {cleanCsat(r.csatMinimum)}</span>
                          <span className="fact"><MessageSquare size={13} /> 면접 {r.interview ? '있음' : '없음'}</span>
                          {r.recruitCount != null && (
                            <span className="fact"><Users size={13} /> {r.recruitCount}명</span>
                          )}
                        </div>
                      )}

                      {/* 비교내신 가용성 + 계산 근거 */}
                      <div className="adm-block">
                        <div className="adm-block-title">
                          <Table2 size={13} /> 비교내신
                          <span className={`avail-tag ${compAvail.has ? 'on' : 'off'}`}>
                            {compAvail.title}
                          </span>
                        </div>
                        <p className="adm-block-desc">{compAvail.desc}</p>

                        {/* 계산 근거 보기 — 내 점수 있을 때만 */}
                        {calcBasis && (
                          <>
                            <div className="calc-basis-summary">
                              <span>내 비교내신 추정:&nbsp;
                                <b>{calcBasis.grade != null ? `${calcBasis.grade}등급` : '–'}</b>
                                {calcBasis.score != null && ` (${calcBasis.score}점)`}
                              </span>
                              <button
                                className="calc-basis-toggle"
                                onClick={() => setShowCalcBasis((v) => !v)}
                              >
                                {showCalcBasis ? '▲ 닫기' : '계산 근거 보기 ▼'}
                              </button>
                            </div>
                            {showCalcBasis && (
                              <div className="calc-basis-box">
                                {calcBasis.lines.map((line, idx) => (
                                  <p key={idx} className="calc-basis-line">{line}</p>
                                ))}
                                <p className="calc-basis-note">
                                  * 대학별 실제 환산식은 모집요강에서 최종 확인하세요.
                                </p>
                              </div>
                            )}
                          </>
                        )}

                        {rowComp && (
                          <details className="adm-raw" style={{ marginTop: 8 }}>
                            <summary>공개된 환산 원문 보기</summary>
                            <pre>{rowComp}</pre>
                          </details>
                        )}

                        <CompRawText univId={realUnivId} phase={r.phase} />
                      </div>

                      {r.evalMethod && (
                        <div className="adm-block">
                          <div className="adm-block-title">전형 방법</div>
                          <p className="adm-block-desc">{r.evalMethod}</p>
                        </div>
                      )}
                      {!is2027Row && r.gedEligible === '조건부' && r.gedIneligibleReason && (
                        <div className="adm-reason">{r.gedIneligibleReason}</div>
                      )}

                      {/* 제출서류 체크리스트 (펼침형) */}
                      <details className="adm-docs">
                        <summary>
                          <FileCheck2 size={14} /> 제출서류 체크리스트
                        </summary>
                        <DocumentsChecklist adm={{ ...r, univId: realUnivId }} />
                      </details>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {is2027 && <p className="adm-src section-src">{ADMISSION_2027_SOURCE_NOTICE}</p>}
        </>
      )}

      {/* 정원외 특별전형 — 일반 학생 대상이 아니라 기본 목록에서 뺐다 */}
      {quotaRows.length > 0 && (
        <div className="quota-section">
          <button className="quota-toggle" onClick={() => setShowQuota((v) => !v)} aria-expanded={showQuota}>
            {QUOTA_OUTSIDE_TITLE} <span className="count-pill">{quotaRows.length}</span>
            <ChevronDown size={16} className={`ged-raw-chev${showQuota ? ' on' : ''}`} />
          </button>
          <p className="section-sub">{QUOTA_OUTSIDE_NOTICE}</p>
          {showQuota && (
            <div className="result-list">
              {quotaRows.map((r, i) => (
                <article className="adm-card" key={`quota-${i}`}>
                  <div className="adm-summary-top" style={{ padding: '14px 16px 4px' }}>
                    <span className="adm-name">{r.admissionName}</span>
                    <span className={`avail-tag ${r.gedEligible === '가능' ? 'on' : 'off'}`}>
                      검정고시 {r.gedEligible}
                    </span>
                  </div>
                  <div className="adm-summary-meta" style={{ padding: '0 16px 12px' }}>
                    {r.phase || '수시/정시 미상'} · {r.admissionType || '전형유형 미상'}
                    {r.applyCloseDate && (
                      <>
                        {' '}
                        <DeadlineBadge row={r} today={today} />
                      </>
                    )}
                  </div>
                  <div style={{ padding: '0 16px 14px' }}>
                    <RequirementText univId={realUnivId} row={r} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2028학년도 전형 구조 — 학년도가 다르므로 아래로 내리고 제목으로 구분한다 */}
      {showPlanSection && (
        <>
          <div className="detail-section-title muted">
            {PLAN_SECTION_TITLE} <span className="count-pill">{planRows.length}</span>
          </div>
          <p className="section-sub">
            {PLAN_YEAR}학년도 대학입학전형 시행계획이에요. 전형 방법·수능최저처럼
            {' '}{ADMISSION_DATA_YEAR}학년도 자료에 없는 <b>구조</b>를 참고하려고 남겨 둔 것이고,
            지원 가능 여부는 위 {ADMISSION_DATA_YEAR}학년도 목록이 기준이에요.
          </p>
          <div className="result-list">
            {planRows.map((r, i) => {
              const open = openPlanRows.has(i);
              return (
                <article className={`adm-card plan-card ${open ? 'open' : ''}`} key={`plan-${i}`}>
                  <button className="adm-summary" onClick={() => togglePlan(i)}>
                    <div className="adm-summary-top">
                      <span className="adm-name">{r.admissionName}</span>
                      <span className="year-tag">{PLAN_YEAR}학년도</span>
                    </div>
                    <div className="adm-summary-meta">
                      {r.phase} · {r.admissionType}
                      {r.gedEligible === '불가' && <span className="badge no">검정고시 불가</span>}
                    </div>
                    <ChevronDown size={18} className="adm-chevron" />
                  </button>
                  {open && (
                    <div className="adm-detail">
                      <div className="adm-facts">
                        <span className="fact"><Target size={13} /> 수능최저 {cleanCsat(r.csatMinimum)}</span>
                        <span className="fact"><MessageSquare size={13} /> 면접 {r.interview ? '있음' : '없음'}</span>
                        {r.recruitCount != null && (
                          <span className="fact"><Users size={13} /> {r.recruitCount}명</span>
                        )}
                      </div>
                      {r.evalMethod && (
                        <div className="adm-block">
                          <div className="adm-block-title">전형 방법</div>
                          <p className="adm-block-desc">{r.evalMethod}</p>
                        </div>
                      )}
                      {r.gedReflection && (
                        <div className="adm-block">
                          <div className="adm-block-title">검정고시 성적 반영</div>
                          <p className="adm-block-desc">{r.gedReflection}</p>
                        </div>
                      )}
                      {r.gedIneligibleReason && <div className="adm-reason">{r.gedIneligibleReason}</div>}
                      {r.source && <p className="adm-src">출처: {r.source}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {noRows.length > 0 && (
        <>
          <div className="detail-section-title muted">지금은 어려운 전형</div>
          <div className="result-list">
            {noRows.map((r, i) => (
              <article className="adm-card no" key={`no-${i}`}>
                <div className="adm-summary-top" style={{ padding: '14px 16px' }}>
                  <span className="adm-name">{r.admissionName}</span>
                  <span className="badge no">불가</span>
                </div>
                <div className="adm-summary-meta" style={{ padding: '0 16px 14px' }}>
                  {r.phase} · {r.admissionType} · 검정고시로는 지원할 수 없어요
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <p className="note">
        {is2027
          ? ADMISSION_2027_SOURCE_NOTICE
          : `${ADMISSION_DATA_YEAR}학년도 지원 가능 전형 자료에 이 대학은 실려 있지 않아, 이 화면은 ${PLAN_YEAR}학년도 시행계획 기준이에요.`}
        <br />
        {PLAN_BASIS_NOTICE}
        <br />
        합격선·비교내신은 <b>{CUTLINE_LABEL} 자료 참고용</b>이에요 (출처:{' '}
        {isCollege
          ? '전문대교협 전문대학포털 전년도 입시결과'
          : CUTLINE_SOURCE_LABEL}).
      </p>
    </div>
  );
}
