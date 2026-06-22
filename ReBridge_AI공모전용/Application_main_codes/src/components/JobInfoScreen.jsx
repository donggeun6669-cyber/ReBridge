import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ChevronDown, Loader2, ExternalLink, Sparkles, Check, Compass,
  RotateCw, Lock, Plus, ArrowRight,
} from 'lucide-react';
import { loadProfile, toggleSavedJob, loadSavedJobs, isJobSaved } from '../lib/persona.js';
import { enrichJobResult } from '../lib/careernet.js';
import { CATALOG_FIELDS, catalogFor } from '../data/careerData.js';
import { pathFor } from '../data/careerMentor.js';
import '../styles.job.css';

// 연결 경로에서 한눈 칩 — 학교 밖 청소년이 가장 궁금한 '학력/돈/방법'.
function metaChips(item) {
  const chips = ['학력 없어도 돼요'];
  const pid = item.connect?.programId;
  if (pid === 'tomorrow-card') chips.push('나라가 학원비 지원');
  else if (pid === 'technician-cert') chips.push('자격증으로 시작');
  else if (pid === 'national-employment') chips.push('취업 지원받기');
  return chips;
}

export default function JobInfoScreen({ goBack = () => {}, goTo = () => {} }) {
  const jp = useMemo(() => loadProfile()?.jobProfile || null, []);
  const initialField = jp?.interest && CATALOG_FIELDS.includes(jp.interest)
    ? jp.interest : 'IT·디자인';

  const [field, setField] = useState(initialField);
  const [openIdx, setOpenIdx] = useState(null);
  const [enrich, setEnrich] = useState({}); // "field::idx" -> { loading, status, data }
  const [saved, setSaved] = useState(() => loadSavedJobs());
  const [toast, setToast] = useState('');

  const items = catalogFor(field);

  useEffect(() => { setOpenIdx(null); }, [field]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }, []);

  const onToggle = useCallback((item) => {
    const job = {
      name: item.name,
      field,
      programId: item.connect?.programId,
      programLabel: item.connect?.label,
    };
    const r = toggleSavedJob(job);
    if (r.full) { flash('관심 직업은 최대 3개까지예요'); return; }
    setSaved(r.jobs);
    flash(r.added ? `${item.name} 저장했어요` : `${item.name} 뺐어요`);
  }, [field, flash]);

  const load = useCallback(async (key, q) => {
    setEnrich((e) => ({ ...e, [key]: { loading: true } }));
    const r = await enrichJobResult(q);
    setEnrich((e) => ({ ...e, [key]: { loading: false, status: r.status, data: r.data } }));
  }, []);

  const toggleOpen = useCallback((idx, item) => {
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
        <span className="srm-intro-kicker">탐색 · 마음에 드는 일 고르기</span>
        <h2 className="srm-intro-title">학력 없이도<br />지금 시작할 수 있는 일</h2>
      </div>

      <p className="job-reason" style={{ marginBottom: 13 }}>
        <Sparkles size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
        마음에 드는 일을 <b>최대 3개까지</b> 저장해요. 저장하면 그 직업의 <b>단계별 준비</b>를 멘토처럼 알려줘요.
      </p>

      {/* 분야 칩 */}
      <div className="ji-chips">
        {CATALOG_FIELDS.map((f) => (
          <button key={f} className={`ji-chip ${field === f ? 'sel' : ''}`} onClick={() => setField(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="ji-list" style={{ paddingBottom: saved.length ? 84 : 0 }}>
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          const key = `${field}::${idx}`;
          const e = enrich[key];
          const sel = isJobSaved(item.name, field) || saved.some((j) => j.name === item.name && j.field === field);
          const oneLiner = pathFor(item.name, field).oneLiner;
          return (
            <div key={item.name} className={`ji-item ${isOpen ? 'open' : ''} ${sel ? 'picked' : ''}`}>
              <div className="ji-item-head ji-item-head--pick">
                <button className="ji-pick-btn" onClick={() => onToggle(item)} aria-label={sel ? '저장 취소' : '저장'}>
                  <span className={`ji-pick-box ${sel ? 'on' : ''}`}>
                    {sel ? <Check size={15} /> : <Plus size={15} />}
                  </span>
                </button>
                <button className="ji-item-main" onClick={() => toggleOpen(idx, item)}>
                  <span className="ji-item-name">{item.name}</span>
                  <span className="ji-meta">
                    {metaChips(item).map((c) => <span key={c} className="ji-meta-chip">{c}</span>)}
                  </span>
                  <span className="ji-item-sum">{oneLiner || item.why}</span>
                </button>
                <ChevronDown size={18} className="ji-item-chev" onClick={() => toggleOpen(idx, item)} />
              </div>
              {isOpen && (
                <div className="ji-item-body">
                  {e?.loading ? (
                    <p className="ji-detail-loading"><Loader2 size={15} className="ji-spin" /> 하는 일 불러오는 중…</p>
                  ) : e?.status === 'ok' && e.data?.summary ? (
                    <div className="ji-detail-row">
                      <span className="ji-detail-label">하는 일</span>
                      <p className="ji-detail-text">{e.data.summary}</p>
                    </div>
                  ) : e?.status === 'error' ? (
                    <div className="ji-detail-fail">
                      <p className="ji-detail-fail-text">직업 설명을 불러오지 못했어요. 잠깐 인터넷이 불안정했을 수 있어요.</p>
                      <button className="ji-retry" onClick={() => load(key, item.q)}><RotateCw size={14} /> 다시 시도</button>
                    </div>
                  ) : (
                    <p className="ji-detail-empty">{item.why}</p>
                  )}

                  <button className={`ji-connect ${sel ? 'is-target' : ''}`} onClick={() => onToggle(item)}>
                    <span className="ji-connect-text">
                      <span className="ji-connect-label">{sel ? '관심 직업으로 저장됨' : '관심 직업으로 저장'}</span>
                      <span className="ji-connect-sub">{sel ? '한 번 더 누르면 빼요' : '단계별 준비를 알려드려요'}</span>
                    </span>
                    {sel ? <Check size={17} /> : <Plus size={17} />}
                  </button>

                  {e?.data?.seq && (
                    <a className="ji-more" href={`https://www.career.go.kr/cnet/front/base/job/jobView.do?seq=${e.data.seq}`} target="_blank" rel="noopener noreferrer">
                      커리어넷에서 자세히 보기 <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 뭐가 맞을지 모를 때 — 진로심리검사 */}
      <button className="ji-connect" onClick={() => goTo('job-psych')} style={{ marginTop: 16 }}>
        <span className="ji-connect-text">
          <span className="ji-connect-label">아직 뭐가 맞을지 모르겠어요</span>
          <span className="ji-connect-sub">무료 진로심리검사로 나부터 알아봐요</span>
        </span>
        <Compass size={17} />
      </button>

      <p className="note" style={{ marginTop: 18 }}>
        <Lock size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
        직업 설명은 나라에서 만든 <b>커리어넷</b> 자료예요. 자격·돈은 곳마다 다를 수 있어 신청 전에 꼭 확인해요.
      </p>

      {toast && <div className="ji-toast">{toast}</div>}

      {/* 저장한 직업이 있으면 하단 고정 — 준비 시작 */}
      {saved.length > 0 && (
        <div className="ji-savebar">
          <span className="ji-savebar-count">관심 직업 <b>{saved.length}</b>개</span>
          <button className="ji-savebar-cta" onClick={() => goTo('job-roadmap')}>
            준비 시작하기 <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
