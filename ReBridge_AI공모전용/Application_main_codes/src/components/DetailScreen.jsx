import { useMemo, useState, useEffect } from 'react';
import {
  ArrowLeft, MapPin, ExternalLink, Target, Users, MessageSquare,
  ChevronDown, Table2, Info, Lock, FileCheck2, Bookmark, Sparkles,
} from 'lucide-react';
import { getUniversityDetail, getUniversityDetailByName } from '../lib/analysis.js';
import { isBookmarked, toggleBookmark } from '../lib/bookmarks.js';
import {
  evaluateAdmission, coachLine, gedAffinity, admissionChance,
  getComparative, comparativeAvailability, gedFit,
  applyComparativeConversion, gedAverage, gradeToMinAvg,
} from '../lib/scoreEngine.js';
import DocumentsChecklist from './DocumentsChecklist.jsx';
import ChanceGauge from './ChanceGauge.jsx';
import { loadProfile } from '../lib/persona.js';
import {
  CUTLINE_LABEL, CUTLINE_NO_DATA_LABEL, CUTLINE_NO_DATA_SHORT,
  CUTLINE_SCALE_NOTICE, PLAN_BASIS_NOTICE, STANDARD_CONVERSION_NOTICE,
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

export default function DetailScreen({ goTo = () => {}, goBack = () => {}, univId, univName }) {
  const profile = useMemo(loadProfile, []);
  const [openRows, setOpenRows] = useState(() => new Set());
  const [showCalcBasis, setShowCalcBasis] = useState(false);

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

  const { univ, rows, eligibleCount } = detail;
  const okRows = rows.filter((r) => r.gedEligible === '가능' || r.gedEligible === '조건부');
  const noRows = rows.filter((r) => r.gedEligible === '불가');

  const hasScore = !!(profile && profile.gedScores && profile.gedAvg != null);
  const isTarget = hasScore && profile.scoreMode === 'target'; // 공부 중 = 목표 점수
  const myAvg = hasScore ? profile.gedAvg : null;
  const realUnivId = univ.univId;
  const comp = getComparative(realUnivId);
  const compAvail = comparativeAvailability(comp);
  const compType = comp?.comparativeGradeType === 'numeric_table' ? 'numeric' : comp ? 'prose' : 'none';
  const calcBasis = hasScore ? conversionBasis(profile, comp) : null;

  // 각 가능 전형 평가
  const evals = okRows.map((r) => {
    const ev = hasScore
      ? evaluateAdmission(profile, { ...r, univId: realUnivId })
      : null;
    return { r, ev, chance: ev ? admissionChance(ev) : null, fit: gedFit(r, compType) };
  });

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
          {!hasScore && (
            <button className="coach-panel-cta" onClick={() => goTo('profile')}>
              내 점수 입력하기
            </button>
          )}
        </div>
      </div>

      {okRows.length > 0 && (
        <>
          <div className="detail-section-title">
            지원할 수 있는 전형 <span className="count-pill">{okRows.length}</span>
          </div>
          <div className="result-list">
            {evals.map(({ r, ev, chance, fit }, i) => {
              const aff = gedAffinity(r);
              const open = openRows.has(i);
              const rowComp = r.comparativeGrade || (comp ? comp.comparativeGrade : null);
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
                      {r.phase} · {r.admissionType}
                      <span className={`affinity-mini ${aff.tone}`}>검정고시 {aff.grade}</span>
                    </div>
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
                          <div className="adm-block-title">{CUTLINE_LABEL}</div>
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
                          <div className="adm-disclaimer">{CUTLINE_SCALE_NOTICE}</div>
                        </div>
                      ) : (
                        <div className="adm-block adm-block-empty">
                          <div className="adm-empty-row">
                            <Lock size={14} />
                            <div>
                              <b>{ev?.dataGap === 'csat' ? '수능 기준 전형이에요' : CUTLINE_NO_DATA_LABEL}</b>
                              <p>{ev?.reason || '점수를 입력하면 비교해드릴게요.'}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 전형 요소 */}
                      <div className="adm-facts">
                        <span className="fact"><Target size={13} /> 수능최저 {cleanCsat(r.csatMinimum)}</span>
                        <span className="fact"><MessageSquare size={13} /> 면접 {r.interview ? '있음' : '없음'}</span>
                        {r.recruitCount != null && (
                          <span className="fact"><Users size={13} /> {r.recruitCount}명</span>
                        )}
                      </div>

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
                      </div>

                      {r.evalMethod && (
                        <div className="adm-block">
                          <div className="adm-block-title">전형 방법</div>
                          <p className="adm-block-desc">{r.evalMethod}</p>
                        </div>
                      )}
                      {r.gedEligible === '조건부' && r.gedIneligibleReason && (
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
        {PLAN_BASIS_NOTICE}
        <br />
        합격선·비교내신은 <b>{CUTLINE_LABEL} 자료 참고용</b>이에요.
      </p>
    </div>
  );
}
