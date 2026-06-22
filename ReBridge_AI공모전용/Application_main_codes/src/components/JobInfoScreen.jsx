import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ChevronDown, Loader2, ExternalLink, Sparkles, Check, Compass,
  RotateCw, Lock, Plus, ArrowRight, Search, X,
} from 'lucide-react';
import { loadProfile, toggleSavedJob, loadSavedJobs, isJobSaved } from '../lib/persona.js';
import { enrichJobResult } from '../lib/careernet.js';
import { CATALOG_FIELDS, catalogFor, searchJobs } from '../data/careerData.js';
import { pathFor } from '../data/careerMentor.js';
import '../styles.job.css';

// 학력 칩 — '학력 없어도 돼요'(모호) 대신, 직업마다 정확한 뜻으로 보여준다.
//   cert-free  학력 제한 없는 국가자격(기능사 등)이 있는 길
//   open       학력보다 실력·포트폴리오·실무를 보는 길
//   check      학력 무관 여부가 자리마다 달라 확인이 필요한 길
const EDU_CHIP = {
  'cert-free': '학력 제한 없는 자격',
  open: '학교 안 나와도 도전 가능',
  check: '학력 조건 확인 필요',
};

// 연결 경로에서 한눈 칩 — 학교 밖 청소년이 가장 궁금한 '학력/돈/방법'.
function metaChips(item) {
  // 학력 칩: 직업의 edu 값으로 정확히. (값이 없으면 기본은 '확인 필요' — 단정하지 않음)
  const chips = [EDU_CHIP[item.edu] || EDU_CHIP.check];
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
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState(null); // 열린 항목 키 ("분야::이름")
  const [enrich, setEnrich] = useState({}); // "분야::이름" -> { loading, status, data }
  const [saved, setSaved] = useState(() => loadSavedJobs());
  const [toast, setToast] = useState('');

  const searching = query.trim().length > 0;

  // 검색 중이면 전 분야에서 매칭, 아니면 선택한 분야의 큐레이션 목록.
  // 두 경우 모두 항목에 실제 분야(_field)를 함께 실어 키·저장에 쓴다.
  const items = useMemo(() => {
    if (searching) return searchJobs(query);
    return catalogFor(field).map((it) => ({ ...it, field }));
  }, [searching, query, field]);

  // 분야 전환 / 검색어 변경 시 열린 항목 닫기
  useEffect(() => { setOpenKey(null); }, [field, query]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }, []);

  const onToggle = useCallback((item) => {
    const job = {
      name: item.name,
      field: item.field,
      programId: item.connect?.programId,
      programLabel: item.connect?.label,
    };
    const r = toggleSavedJob(job);
    if (r.full) { flash('관심 직업은 최대 3개까지예요'); return; }
    setSaved(r.jobs);
    flash(r.added ? `${item.name} 저장했어요` : `${item.name} 뺐어요`);
  }, [flash]);

  const load = useCallback(async (key, q) => {
    setEnrich((e) => ({ ...e, [key]: { loading: true } }));
    const r = await enrichJobResult(q);
    setEnrich((e) => ({ ...e, [key]: { loading: false, status: r.status, data: r.data } }));
  }, []);

  const toggleOpen = useCallback((key, item) => {
    if (openKey === key) { setOpenKey(null); return; }
    setOpenKey(key);
    if (!enrich[key]) load(key, item.q);
  }, [openKey, enrich, load]);

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

      {/* 직업 검색 */}
      <div className="ji-search">
        <Search size={16} className="ji-search-ico" />
        <input
          className="ji-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="직업·분야 검색 (예: 영상, 카페, 반려동물)"
          aria-label="직업 검색"
        />
        {query && (
          <button className="ji-search-clear" onClick={() => setQuery('')} aria-label="검색어 지우기">
            <X size={16} />
          </button>
        )}
      </div>

      {/* 분야 칩 — 검색 중에는 숨김 */}
      {!searching && (
        <div className="ji-chips">
          {CATALOG_FIELDS.map((f) => (
            <button key={f} className={`ji-chip ${field === f ? 'sel' : ''}`} onClick={() => setField(f)}>
              {f}
            </button>
          ))}
        </div>
      )}

      {searching && (
        <p className="job-reason" style={{ marginBottom: 10 }}>
          {items.length > 0
            ? <>‘<b>{query.trim()}</b>’ 검색 결과 <b>{items.length}</b>개</>
            : <>‘<b>{query.trim()}</b>’에 맞는 직업을 못 찾았어요. 다른 말로 검색해 보세요.</>}
        </p>
      )}

      <div className="ji-list" style={{ paddingBottom: saved.length ? 84 : 0 }}>
        {items.map((item) => {
          const itemField = item.field;
          const key = `${itemField}::${item.name}`;
          const isOpen = openKey === key;
          const e = enrich[key];
          const sel = isJobSaved(item.name, itemField) || saved.some((j) => j.name === item.name && j.field === itemField);
          const oneLiner = pathFor(item.name, itemField).oneLiner;
          return (
            <div key={key} className={`ji-item ${isOpen ? 'open' : ''} ${sel ? 'picked' : ''}`}>
              <div className="ji-item-head ji-item-head--pick">
                <button className="ji-pick-btn" onClick={() => onToggle(item)} aria-label={sel ? '저장 취소' : '저장'}>
                  <span className={`ji-pick-box ${sel ? 'on' : ''}`}>
                    {sel ? <Check size={15} /> : <Plus size={15} />}
                  </span>
                </button>
                <button className="ji-item-main" onClick={() => toggleOpen(key, item)}>
                  <span className="ji-item-name">{item.name}</span>
                  <span className="ji-meta">
                    {searching && <span className="ji-meta-chip ji-meta-field">{itemField}</span>}
                    {metaChips(item).map((c) => <span key={c} className="ji-meta-chip">{c}</span>)}
                  </span>
                  <span className="ji-item-sum">{oneLiner || item.why}</span>
                </button>
                <ChevronDown size={18} className="ji-item-chev" onClick={() => toggleOpen(key, item)} />
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

      {/* 뭐가 맞을지 모를 때 — 진로심리검사 (검색 중에는 숨김) */}
      {!searching && (
      <button className="ji-connect" onClick={() => goTo('job-psych')} style={{ marginTop: 16 }}>
        <span className="ji-connect-text">
          <span className="ji-connect-label">아직 뭐가 맞을지 모르겠어요</span>
          <span className="ji-connect-sub">무료 진로심리검사로 나부터 알아봐요</span>
        </span>
        <Compass size={17} />
      </button>
      )}

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
