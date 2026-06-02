import { useMemo } from 'react';
import { ArrowLeft, MapPin, ExternalLink, CheckCircle2, Target, Users, MessageSquare } from 'lucide-react';
import { getUniversityDetail, getUniversityDetailByName } from '../lib/analysis.js';

const ELIG = { 가능: 'ok', 조건부: 'cond', 불가: 'no' };

function cleanCsat(raw) {
  if (!raw) return '모집요강 확인';
  if (raw.includes('해당없음')) return '해당 없음';
  return raw;
}

export default function DetailScreen({ goTo = () => {}, univId, univName }) {
  const detail = useMemo(() => {
    if (univId) return getUniversityDetail(univId);
    if (univName) return getUniversityDetailByName(univName);
    return null;
  }, [univId, univName]);

  if (!detail) {
    return (
      <div className="screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="뒤로" onClick={() => goTo('home')}>
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

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={() => goTo('home')}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">대학 정보</span>
      </header>

      <div className="detail-header">
        <div className="detail-univ-name">{univ.name}</div>
        <div className="detail-meta">
          <MapPin size={13} /> {univ.region}
          {univ.establishment ? ` · ${univ.establishment}` : ''}
          {univ.kind === '전문대학' ? ' · 전문대학' : ''}
        </div>
        <div className="detail-eligible-line">
          검정고시로 지원할 수 있는 전형이 <b>{eligibleCount}개</b> 있어요
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

      {okRows.length > 0 && (
        <>
          <div className="detail-section-title">지원할 수 있는 전형</div>
          <div className="result-list">
            {okRows.map((r, i) => (
              <article className="detail-row" key={`${r.admissionName}-${i}`}>
                <div className="detail-row-head">
                  <div className="detail-row-name">{r.admissionName}</div>
                  <span className={`badge ${ELIG[r.gedEligible]}`}>{r.gedEligible}</span>
                </div>
                <div className="detail-meta-line">
                  {r.phase} · {r.admissionType}
                </div>

                {r.gedReflection && (
                  <div className="detail-reflect">
                    <CheckCircle2 size={14} /> {r.gedReflection}
                  </div>
                )}

                <div className="detail-facts">
                  <span className="fact">
                    <Target size={13} /> 수능최저 {cleanCsat(r.csatMinimum)}
                  </span>
                  <span className="fact">
                    <MessageSquare size={13} /> 면접 {r.interview ? '있음' : '없음'}
                  </span>
                  {r.recruitCount != null && (
                    <span className="fact">
                      <Users size={13} /> {r.recruitCount}명
                    </span>
                  )}
                </div>

                {r.comparativeGrade && (
                  <div className="detail-extra">비교내신: {r.comparativeGrade}</div>
                )}
                {r.evalMethod && <div className="detail-extra">{r.evalMethod}</div>}
                {r.gedEligible === '조건부' && r.gedIneligibleReason && (
                  <div className="detail-reason">{r.gedIneligibleReason}</div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {noRows.length > 0 && (
        <>
          <div className="detail-section-title muted">지금은 어려운 전형</div>
          <div className="result-list">
            {noRows.map((r, i) => (
              <article className="detail-row muted" key={`no-${i}`}>
                <div className="detail-row-head">
                  <div className="detail-row-name">{r.admissionName}</div>
                  <span className="badge no">불가</span>
                </div>
                <div className="detail-meta-line">
                  {r.phase} · {r.admissionType}
                </div>
                <div className="detail-reason">검정고시로는 지원할 수 없어요</div>
              </article>
            ))}
          </div>
        </>
      )}

      <p className="note">
        2028학년도 시행계획 기준이에요.
        <br />
        정확한 내용은 입학처 모집요강에서 확인해 주세요.
      </p>
    </div>
  );
}
