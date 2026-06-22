import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Loader2, ExternalLink, Sparkles, Check, Compass,
  RotateCw, Lock, Plus, ArrowRight, Search, X, ChevronDown,
} from 'lucide-react';
import { toggleSavedJob, loadSavedJobs, isJobSaved } from '../lib/persona.js';
import { fetchJobs, fetchJobsMulti, enrichJobResult } from '../lib/careernet.js';
import { CATALOG_FIELDS, FIELD_SEARCH_KEYWORDS } from '../data/careerData.js';
import '../styles.job.css';

const PER_PAGE = 20;

export default function JobInfoScreen({ goBack = () => {}, goTo = () => {}, initialQuery = '' }) {
  const [field, setField] = useState('전체');
  const [query, setQuery] = useState(initialQuery);
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openKey, setOpenKey] = useState(null);
  const [enrich, setEnrich] = useState({});
  const [saved, setSaved] = useState(() => loadSavedJobs());
  const [toast, setToast] = useState('');

  const searching = query.trim().length > 0;
  const debounceRef = useRef(null);

  // 서버 페이지네이션 모드(전체/검색)인지 여부. 분야 칩은 여러 키워드를 병합해 한 번에 보여준다.
  const paginated = searching || field === '전체';

  const doFetch = useCallback(async (pg, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    let result;
    const q = query.trim();
    if (q) {
      result = await fetchJobs({ keyword: q, perPage: PER_PAGE, pageIndex: pg });
    } else if (field === '전체') {
      result = await fetchJobs({ keyword: '', perPage: PER_PAGE, pageIndex: pg });
    } else {
      result = await fetchJobsMulti(FIELD_SEARCH_KEYWORDS[field] || []);
    }

    const { jobs: fetched, total: tot } = result;
    setJobs((prev) => append ? [...prev, ...fetched] : fetched);
    setTotal(tot);
    setPage(pg);
    if (!append) { setOpenKey(null); setEnrich({}); }
    if (append) setLoadingMore(false);
    else setLoading(false);
  }, [query, field]);

  // 칩 or 검색어 변경 시 fetch (검색어는 400ms 디바운스)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doFetch(1);
    }, searching ? 400 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [field, query]); // eslint-disable-line

  const loadMore = useCallback(() => {
    doFetch(page + 1, true);
  }, [page, doFetch]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }, []);

  const onToggle = useCallback((item) => {
    const job = { name: item.name, field: item.field };
    const r = toggleSavedJob(job);
    if (r.full) { flash('관심 직업은 최대 3개까지예요'); return; }
    setSaved(r.jobs);
    flash(r.added ? `${item.name} 저장했어요` : `${item.name} 뺐어요`);
  }, [flash]);

  const loadDetail = useCallback(async (key, item) => {
    // 목록 API에서 이미 summary를 받았으면 바로 사용
    if (item.summary) {
      setEnrich((e) => ({
        ...e,
        [key]: { loading: false, status: 'ok', data: { summary: item.summary, seq: item.seq } },
      }));
      return;
    }
    setEnrich((e) => ({ ...e, [key]: { loading: true } }));
    const r = await enrichJobResult(item.name);
    setEnrich((e) => ({ ...e, [key]: { loading: false, status: r.status, data: r.data } }));
  }, []);

  const toggleOpen = useCallback((key, item) => {
    if (openKey === key) { setOpenKey(null); return; }
    setOpenKey(key);
    if (!enrich[key]) loadDetail(key, item);
  }, [openKey, enrich, loadDetail]);

  return (
    <>
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">직업 탐색</span>
      </header>

      <div className="srm-intro">
        <span className="srm-intro-kicker">탐색 · 마음에 드는 일 고르기</span>
        <h2 className="srm-intro-title">꿈은 학력과<br />상관없이 고르세요</h2>
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
            <button
              key={f}
              className={`ji-chip ${field === f ? 'sel' : ''}`}
              onClick={() => setField(f)}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* 결과 수 */}
      {!loading && (
        <p className="job-reason" style={{ marginBottom: 10 }}>
          {total > 0
            ? searching
              ? <><b>'{query.trim()}'</b> 검색 결과 <b>{total.toLocaleString()}</b>개</>
              : field === '전체'
                ? <>커리어넷 직업사전 <b>{total.toLocaleString()}</b>개 전체</>
                : <><b>{field}</b> 관련 직업 <b>{total.toLocaleString()}</b>개</>
            : searching
              ? <>'<b>{query.trim()}</b>'에 맞는 직업을 못 찾았어요. 다른 말로 검색해 보세요.</>
              : <>직업을 불러오는 중이에요.</>
          }
        </p>
      )}

      {/* 직업 목록 */}
      <div className="ji-list">
        {loading ? (
          <p className="ji-detail-loading" style={{ padding: '32px 0', textAlign: 'center' }}>
            <Loader2 size={18} className="ji-spin" /> 직업 불러오는 중…
          </p>
        ) : (
          jobs.map((item) => {
            const key = `${item.field}::${item.name}`;
            const isOpen = openKey === key;
            const e = enrich[key];
            const sel = isJobSaved(item.name, item.field) || saved.some((j) => j.name === item.name);
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
                      <span className="ji-meta-chip">학력 조건 확인 필요</span>
                    </span>
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
                        <button className="ji-retry" onClick={() => loadDetail(key, item)}><RotateCw size={14} /> 다시 시도</button>
                      </div>
                    ) : (
                      <p className="ji-detail-empty">커리어넷에서 상세 정보를 확인해 보세요.</p>
                    )}

                    <button className={`ji-connect ${sel ? 'is-target' : ''}`} onClick={() => onToggle(item)}>
                      <span className="ji-connect-text">
                        <span className="ji-connect-label">{sel ? '관심 직업으로 저장됨' : '관심 직업으로 저장'}</span>
                        <span className="ji-connect-sub">{sel ? '한 번 더 누르면 빼요' : '단계별 준비를 알려드려요'}</span>
                      </span>
                      {sel ? <Check size={17} /> : <Plus size={17} />}
                    </button>

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
          })
        )}
      </div>

      {/* 더 보기 */}
      {!loading && jobs.length > 0 && jobs.length < total && (
        <button
          className="ji-connect"
          style={{ marginTop: 8 }}
          onClick={loadMore}
          disabled={loadingMore}
        >
          <span className="ji-connect-text">
            <span className="ji-connect-label">
              {loadingMore ? '불러오는 중…' : `더 보기`}
            </span>
            <span className="ji-connect-sub">
              {jobs.length}/{total.toLocaleString()}개 표시 중
            </span>
          </span>
          {loadingMore ? <Loader2 size={17} className="ji-spin" /> : <ArrowRight size={17} />}
        </button>
      )}

      {/* 뭐가 맞을지 모를 때 — 진로심리검사 */}
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
        직업 정보는 나라에서 만든 <b>커리어넷</b> 자료예요. 학력·자격 조건은 자리마다 다를 수 있어 신청 전에 꼭 확인해요.
      </p>

      {toast && <div className="ji-toast">{toast}</div>}
    </div>

    {saved.length > 0 && (
      <div className="ji-savebar">
        <span className="ji-savebar-count">관심 직업 <b>{saved.length}</b>개</span>
        <button className="ji-savebar-cta" onClick={() => goTo('job-roadmap')}>
          준비 시작하기 <ArrowRight size={16} />
        </button>
      </div>
    )}
    </>
  );
}
