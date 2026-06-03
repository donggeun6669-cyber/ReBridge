import { useMemo, useState, useEffect } from 'react';
import {
  ArrowLeft, MapPin, ExternalLink, Target, Users, MessageSquare,
  ChevronDown, Table2, Info, Lock, FileCheck2, KeyRound, Bookmark,
} from 'lucide-react';
import { getUniversityDetail, getUniversityDetailByName } from '../lib/analysis.js';
import { isBookmarked, toggleBookmark } from '../lib/bookmarks.js';
import {
  evaluateAdmission, coachLine, gedAffinity, admissionChance,
  getComparative, comparativeAvailability,
} from '../lib/scoreEngine.js';
import DocumentsChecklist from './DocumentsChecklist.jsx';
import ChanceGauge from './ChanceGauge.jsx';

const ELIG = { 가능: 'ok', 조건부: 'cond', 불가: 'no' };
const STORAGE_KEY = 'rebridge_profile';

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function cleanCsat(raw) {
  if (!raw) return '모집요강 확인';
  if (raw.includes('해당없음')) return '해당 없음';
  return raw;
}

export default function DetailScreen({ goTo = () => {}, goBack = () => {}, univId, univName }) {
  const profile = useMemo(loadProfile, []);
  const [openRows, setOpenRows] = useState(() => new Set());

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
  const realUnivId = univ.univId;
  const comp = getComparative(realUnivId);
  const compAvail = comparativeAvailability(comp);

  // 각 가능 전형 평가
  const evals = okRows.map((r) => {
    const ev = hasScore
      ? evaluateAdmission(profile, { ...r, univId: realUnivId })
      : null;
    return { r, ev, chance: ev ? admissionChance(ev) : null };
  });

  // 담임 한마디 — 점수 있으면 칸수 분포로, 없으면 전형 안내
  let coachSummary;
  if (hasScore) {
    const levels = evals.map((e) => e.chance?.level).filter((v) => v != null);
    const safe = levels.filter((l) => l >= 4).length;
    const reach = levels.filter((l) => l === 3).length;
    if (levels.length === 0) {
      coachSummary = `검정고시로 지원 가능한 전형이 ${eligibleCount}개 있어요. 다만 작년 합격선 자료가 없어 점수 비교는 어려워요.`;
    } else if (safe > 0) {
      coachSummary = `지금 점수(평균 ${profile.gedAvg}점)면 ${safe}개 전형이 적정~안정권이에요. 충분히 노려볼 만해요!`;
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
            {evals.map(({ r, ev, chance }, i) => {
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
                        <span className={`elig-tag elig-${ELIG[r.gedEligible]}`}>
                          <KeyRound size={11} />
                          {r.gedEligible === '조건부' ? '조건부 지원' : '지원 가능'}
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
                        <Info size={12} /> {ev.dataGap === 'csat' ? '수능 기준 전형 — 검정고시 평균으로 비교 어려움' : '작년 합격선 자료 없음'}
                      </div>
                    )}
                    <ChevronDown size={18} className="adm-chevron" />
                  </button>

                  {/* 상세(펼침) */}
                  {open && (
                    <div className="adm-detail">
                      {/* 합격선 블록 */}
                      {ev && ev.applicable && ev.cutGrade != null ? (
                        <div className="adm-block">
                          <div className="adm-block-title">작년 합격선</div>
                          <div className="adm-cut">
                            약 <b>{ev.cutGrade}등급</b>
                            <span className="adm-cut-meta">
                              {' '}({ev.cutType}{ev.cutN ? ` · 표본 ${ev.cutN}명` : ''})
                            </span>
                          </div>
                          <div className="adm-disclaimer">2025학년도 9등급제 입결 기준 · 참고용 예상이에요</div>
                        </div>
                      ) : (
                        <div className="adm-block adm-block-empty">
                          <div className="adm-empty-row">
                            <Lock size={14} />
                            <div>
                              <b>{ev?.dataGap === 'csat' ? '수능 기준 전형이에요' : '작년 합격선 자료가 없어요'}</b>
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

                      {/* 비교내신 가용성 */}
                      <div className="adm-block">
                        <div className="adm-block-title">
                          <Table2 size={13} /> 비교내신
                          <span className={`avail-tag ${compAvail.has ? 'on' : 'off'}`}>
                            {compAvail.title}
                          </span>
                        </div>
                        <p className="adm-block-desc">{compAvail.desc}</p>
                        {rowComp && (
                          <details className="adm-raw">
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
        2028학년도 시행계획 기준이에요.
        <br />
        합격선·비교내신은 <b>작년 자료 참고용</b>이고, 정확한 내용은 입학처 모집요강에서 확인해 주세요.
      </p>
    </div>
  );
}
