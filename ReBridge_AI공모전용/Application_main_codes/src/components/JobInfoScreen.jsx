import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ChevronDown, Loader2, ArrowRight, ExternalLink, Sparkles, Check, Compass,
  RotateCw, Lock,
} from 'lucide-react';
import { loadProfile, setJobTarget, loadJobTarget } from '../lib/persona.js';
import { enrichJobResult } from '../lib/careernet.js';
import { CATALOG_FIELDS, catalogFor } from '../data/careerData.js';
import '../styles.job.css';

// 연결 경로에서 한눈 칩 도출 — 학교 밖 청소년이 가장 궁금한 '학력/돈/방법'.
// 정직성: '무료/국비' 처럼 단정하지 않는다(자격이 불확실한 제도가 섞여 있음).
function metaChips(item) {
  const chips = ['학력 무관'];
  const pid = item.connect?.programId;
  if (pid === 'tomorrow-card') chips.push('국비 직업훈련');
  else if (pid === 'technician-cert') chips.push('국가기능사 자격');
  else if (pid === 'national-employment') chips.push('단기 교육 → 취업');
  return chips;
}

export default function JobInfoScreen({ goBack = () => {}, goTo = () => {} }) {
  const jp = useMemo(() => loadProfile()?.jobProfile || null, []);
  const initialField = jp?.interest && CATALOG_FIELDS.includes(jp.interest)
    ? jp.interest : 'IT·디자인';

  const [field, setField] = useState(initialField);
  const [openIdx, setOpenIdx] = useState(null);
  const [enrich, setEnrich] = useState({}); // "field::idx" -> { loading, status, data }
  const [target, setTarget] = useState(() => loadJobTarget());

  const items = catalogFor(field);

  useEffect(() => { setOpenIdx(null); }, [field]);

  const saveTarget = useCallback((item) => {
    const next = {
      name: item.name,
      field,
      programId: item.connect?.programId,
      programLabel: item.connect?.label,
    };
    setJobTarget(next);
    setTarget(next);
    goTo('job-roadmap');
  }, [field, goTo]);

  const load = useCallback(async (key, q) => {
    setEnrich((e) => ({ ...e, [key]: { loading: true } }));
    const r = await enrichJobResult(q);
    setEnrich((e) => ({ ...e, [key]: { loading: false, status: r.status, data: r.data } }));
  }, []);

  const toggle = useCallback((idx, item) => {
    if (openIdx === idx) { setOpenIdx(null); return; }
    setOpenIdx(idx);
    const key = `${field}::${idx}`;
    if (!enrich[key]) load(key, item.q);
  }, [openIdx, field, enrich, load]);

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">직업 탐색</span>
      </header>

      <div className="srm-intro">
        <span className="srm-intro-kicker">2단계 · 직업 고르기</span>
        <h2 className="srm-intro-title">학력보다 기술,<br />지금 시작할 수 있는 일</h2>
      </div>

      <p className="job-reason" style={{ marginBottom: 13 }}>
        <Sparkles size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
        학위가 꼭 필요한 직업은 빼고, <b>학력 제한이 낮거나 자격·훈련으로 시작</b>할 수 있는
        직업만 골라 모았어요. 마음에 드는 직업을 고르면 <b>맞춤 로드맵</b>으로 이어져요.
      </p>

      {/* 분야 칩 */}
      <div className="ji-chips">
        {CATALOG_FIELDS.map((f) => (
          <button
            key={f}
            className={`ji-chip ${field === f ? 'sel' : ''}`}
            onClick={() => setField(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="ji-list">
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          const key = `${field}::${idx}`;
          const e = enrich[key];
          const isTarget = target?.name === item.name && target?.field === field;
          return (
            <div key={item.name} className={`ji-item ${isOpen ? 'open' : ''}`}>
              <button className="ji-item-head" onClick={() => toggle(idx, item)}>
                <span className="ji-item-text">
                  <span className="ji-item-name">{item.name}</span>
                  <span className="ji-meta">
                    {metaChips(item).map((c) => (
                      <span key={c} className="ji-meta-chip">{c}</span>
                    ))}
                  </span>
                  <span className="ji-item-sum">{item.why}</span>
                </span>
                <ChevronDown size={18} className="ji-item-chev" />
              </button>
              {isOpen && (
                <div className="ji-item-body">
                  {e?.loading ? (
                    <p className="ji-detail-loading">
                      <Loader2 size={15} className="ji-spin" /> 하는 일 불러오는 중…
                    </p>
                  ) : e?.status === 'ok' && e.data?.summary ? (
                    <div className="ji-detail-row">
                      <span className="ji-detail-label">하는 일</span>
                      <p className="ji-detail-text">{e.data.summary}</p>
                    </div>
                  ) : e?.status === 'error' ? (
                    <div className="ji-detail-fail">
                      <p className="ji-detail-fail-text">
                        직업 설명을 불러오지 못했어요. 잠깐 인터넷이 불안정했을 수 있어요.
                      </p>
                      <button className="ji-retry" onClick={() => load(key, item.q)}>
                        <RotateCw size={14} /> 다시 시도
                      </button>
                    </div>
                  ) : (
                    <p className="ji-detail-empty">
                      이 일이 마음에 들면, 아래에서 바로 준비를 이어갈 수 있어요.
                    </p>
                  )}

                  {isTarget ? (
                    <button
                      className="ji-connect is-target"
                      onClick={() => goTo('job-roadmap')}
                    >
                      <span className="ji-connect-text">
                        <span className="ji-connect-label">내 목표 직업이에요</span>
                        <span className="ji-connect-sub">맞춤 로드맵 보기</span>
                      </span>
                      <Check size={17} />
                    </button>
                  ) : (
                    <button
                      className="ji-connect"
                      onClick={() => saveTarget(item)}
                    >
                      <span className="ji-connect-text">
                        <span className="ji-connect-label">이 직업으로 준비 시작</span>
                        <span className="ji-connect-sub">
                          {item.connect ? item.connect.label : '목표로 정하고 로드맵 보기'}
                        </span>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                  )}

                  {e?.data?.seq && (
                    <a
                      className="ji-more"
                      href={`https://www.career.go.kr/cnet/front/base/job/jobView.do?seq=${e.data.seq}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      커리어넷에서 자세히 보기 <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 뭐가 맞을지 모를 때 — 진로심리검사로 분리 */}
      <button className="ji-connect" onClick={() => goTo('job-psych')} style={{ marginTop: 16 }}>
        <span className="ji-connect-text">
          <span className="ji-connect-label">아직 뭐가 맞을지 모르겠다면</span>
          <span className="ji-connect-sub">진로심리검사로 나부터 알아보기</span>
        </span>
        <Compass size={17} />
      </button>

      <p className="note" style={{ marginTop: 18 }}>
        <Lock size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
        직업 설명은 <b>커리어넷(한국직업능력연구원)</b> 자료예요. 자격·비용 조건은 제도마다 다를 수 있어,
        실제 신청 전 공식 기관 확인을 함께 안내해요.
      </p>
    </div>
  );
}
