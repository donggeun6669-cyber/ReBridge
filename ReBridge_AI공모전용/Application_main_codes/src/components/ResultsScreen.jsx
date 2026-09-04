import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  CUTLINE_YEAR, CUTLINE_SOURCE_LABEL, CUTLINE_SOURCE_LABEL_ALL,
  ADMISSION_DATA_YEAR, PLAN_YEAR, GED_2027_SOURCE_LABEL,
  ADMISSION_DATA_UNIV_COUNT, applyDeadline,
} from '../data/meta.js';
import {
  ArrowLeft, MapPin, Sparkles, Info, CalendarClock,
  ChevronRight, ChevronLeft, SlidersHorizontal, X,
} from 'lucide-react';
import { analyzeProfile, getEssayList } from '../lib/analysis.js';
import { gedFit } from '../lib/scoreEngine.js';
import ChanceGauge from './ChanceGauge.jsx';
import { loadProfile } from '../lib/persona.js';

const METRO = new Set(['서울', '경기', '인천']);

// 프로필 1줄 요약
function profileOneLiner(p) {
  if (!p) return '';
  const parts = [];
  if (p.gedAvg != null) {
    parts.push(`검정고시 평균 ${p.gedAvg}점`);
    if (p.gedGrade != null) parts.push(`${p.gedGrade}등급`);
  } else if (p.gedScore && p.gedScore !== '아직 몰라요') {
    parts.push(`검정고시 ${p.gedScore}`);
  }
  if (p.csatPlan) {
    const m = { '볼 거예요': '수능 예정', '안 볼 거예요': '수능 안 봄', '고민 중이에요': '수능 고민 중' };
    parts.push(m[p.csatPlan] || p.csatPlan);
  }
  if (p.region && p.region !== '아직 몰라요' && p.region !== '전국 다 좋아요') parts.push(p.region);
  return parts.join(' · ');
}

// 수시 뱃지
// hasScore=false(점수 미입력)면 합격 가능성 대신 '지원 가부'만 보여준다.
function SusiBadge({ r, hasScore }) {
  // 대교협 기본사항 템플릿 행 — 이 대학이 실제로 그렇게 뽑는지 확인되지 않았다
  if (r.baseline) {
    return <span className="fit-tag fit-unknown" title="대교협 2028 기본사항 기준 일반 안내예요. 대학 시행계획으로 확인이 필요해요.">확인 필요</span>;
  }
  if (r.chance) {
    return <ChanceGauge chance={r.chance} compact estimated={r.conversionEstimated ?? r.conversionMethod === 'standard'} />;
  }
  // 점수를 넣었는데도 합격선 자료가 없는 경우 — '예측 불가'가 아니라 '자료 없음'
  if (hasScore && r.dataGap === 'cutline') {
    return <span className="fit-tag fit-unknown" title={`이 대학·전형의 ${CUTLINE_YEAR}학년도 합격선이 공개 자료에 없어요.`}>자료 없음</span>;
  }
  const fit = gedFit(
    { admissionType: r.bestType, gedEligible: r.bestGedEligible || (r.status === 'ok' ? '가능' : '조건부') },
    r.comparativeType
  );
  return (
    <span className={`fit-tag fit-${fit?.level || 'ok'}`}>
      <Sparkles size={11} /> {fit?.label || '지원 가능'}
    </span>
  );
}

// 행 안에 붙는 작은 경고 배지 (CSS 추가 없이 인라인)
const ROW_TAG_STYLE = {
  fontSize: 10.5,
  fontWeight: 700,
  color: '#8a6d1f',
  background: '#FEF6E0',
  border: '1px solid #F0DCA8',
  borderRadius: 6,
  padding: '1px 5px',
  marginLeft: 6,
  whiteSpace: 'nowrap',
};

// 행이 어느 학년도 자료에서 왔는지 — 두 학년도가 한 목록에 섞이므로 매 행에 밝힌다.
function YearTag({ dataYear }) {
  const is2027 = dataYear === ADMISSION_DATA_YEAR;
  return (
    <span
      className={`year-tag${is2027 ? ' year-tag-now' : ''}`}
      title={is2027
        ? `${GED_2027_SOURCE_LABEL} 기준이에요.`
        : `${GED_2027_SOURCE_LABEL}에 이 대학은 없어서(${ADMISSION_DATA_UNIV_COUNT}개 대학만 수록) ${PLAN_YEAR}학년도 시행계획으로 보여줘요.`}
    >
      {dataYear}학년도 기준
    </span>
  );
}

// 결과 행
function ResultRow({ r, onClick, badge, today }) {
  const dl = applyDeadline(r.applyCloseDate, r.applyCloseTime, today);
  return (
    <button className="result-row" onClick={onClick}>
      <div className="result-row-body">
        <div className="result-row-name">{r.name}</div>
        <div className="result-row-meta">
          <MapPin size={11} />
          {r.region}
          {r.kind === '전문대학' ? ' · 전문대학' : ''}
          <span className="result-row-type">{r.bestType || '전형유형 미상'} · {r.bestName}</span>
          {r.baseline && (
            <span style={ROW_TAG_STYLE} title="대교협 2028 기본사항의 일반 안내예요. 대학이 발표한 전형이 아니에요.">
              대학 미확인 · 일반 안내
            </span>
          )}
        </div>
        <div className="result-row-meta">
          <YearTag dataYear={r.dataYear} />
          {dl && !dl.past && (
            <span className={`dday-badge dday-${dl.days <= 3 ? 'urgent' : dl.days <= 10 ? 'soon' : 'far'}`}>
              <CalendarClock size={11} /> 접수 마감 {dl.label}
            </span>
          )}
        </div>
      </div>
      <div className="result-row-right">
        {badge}
        <ChevronRight size={14} className="result-row-arrow" />
      </div>
    </button>
  );
}

// 필터 칩 행
function FilterRow({ label, options, value, onChange }) {
  return (
    <div className="filter-group">
      <span className="filter-group-label">{label}</span>
      <div className="filter-chips-scroll">
        {options.map((opt) => (
          <button
            key={opt}
            className={`fchip${value === opt ? ' active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// 페이지 번호 계산
function buildPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

// ── 필터 + 페이지네이션 훅 ──────────────────────────────────────────────
function useFilteredPaged(results) {
  const [regionF, setRegionF] = useState('전체');
  const [typeF, setTypeF] = useState('전체');
  const [chanceF, setChanceF] = useState('전체');
  const [kindF, setKindF] = useState('전체');
  const [sortF, setSortF] = useState('합격가능성');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const set = useCallback((setter) => (v) => { setter(v); setPage(1); }, []);

  const filtered = useMemo(() => {
    let out = [...results];
    if (regionF === '서울') out = out.filter((r) => r.region === '서울');
    else if (regionF === '수도권') out = out.filter((r) => METRO.has(r.region));
    else if (regionF === '지방') out = out.filter((r) => !METRO.has(r.region));

    const typeMap = { '학종': '학생부종합', '논술': '논술', '교과': '학생부교과', '서류': '일반(서류)' };
    if (typeF !== '전체') out = out.filter((r) => r.bestType === typeMap[typeF]);

    if (chanceF === '예측 가능') out = out.filter((r) => r.chance != null);
    else if (chanceF === '자료 없음') out = out.filter((r) => r.chance == null);
    else if (chanceF === '안정') out = out.filter((r) => r.chance?.level === 5);
    else if (chanceF === '적정') out = out.filter((r) => r.chance?.level === 4);
    else if (chanceF === '소신') out = out.filter((r) => r.chance?.level === 3);
    else if (chanceF === '도전') out = out.filter((r) => r.chance && r.chance.level <= 2);

    if (kindF === '4년제') out = out.filter((r) => r.kind !== '전문대학');
    else if (kindF === '전문대') out = out.filter((r) => r.kind === '전문대학');

    if (sortF === '가나다') out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [results, regionF, typeF, chanceF, kindF, sortF]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // 활성 필터 수 (정렬 제외)
  const activeFilterCount = [
    regionF !== '전체', typeF !== '전체', chanceF !== '전체', kindF !== '전체',
  ].filter(Boolean).length;

  return {
    filtered, paged, totalPages, page: safePage, setPage,
    regionF, setRegionF: set(setRegionF),
    typeF, setTypeF: set(setTypeF),
    chanceF, setChanceF: set(setChanceF),
    kindF, setKindF: set(setKindF),
    sortF, setSortF: set(setSortF),
    pageSize, setPageSize: (n) => { setPageSize(n); setPage(1); },
    activeFilterCount,
    resetFilters: () => {
      setRegionF('전체'); setTypeF('전체'); setChanceF('전체'); setKindF('전체'); setPage(1);
    },
  };
}

// ── 페이지네이션 UI ──────────────────────────────────────────────────────
function Pagination({ page, totalPages, setPage }) {
  if (totalPages <= 1) return null;
  const pages = buildPages(page, totalPages);
  return (
    <div className="pagination">
      <button className="page-nav" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="이전">
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="page-ellipsis">…</span>
        ) : (
          <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>
            {p}
          </button>
        )
      )}
      <button className="page-nav" disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="다음">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── 결과 섹션 ──────────────────────────────────────────────────────────
function ResultSection({ state, goTo, badgeFn, showChance = true, today }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const topRef = useRef(null);
  const mountedRef = useRef(false);

  // 페이지를 '바꿨을 때만' 목록 상단으로 스크롤.
  // 첫 렌더에도 실행돼서 화면에 들어오자마자 스크롤이 튀던 문제를 막는다.
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [state.page]);

  const { filtered, paged, totalPages, page, setPage, pageSize, setPageSize, sortF, setSortF,
    activeFilterCount, resetFilters } = state;

  return (
    <>
      {/* 정렬 + 표시 개수 + 필터 토글 */}
      <div className="result-toolbar" ref={topRef}>
        <div className="sort-group">
          <SlidersHorizontal size={13} className="sort-icon" />
          {['합격가능성', '가나다'].map((s) => (
            <button key={s} className={`sort-chip${sortF === s ? ' on' : ''}`} onClick={() => setSortF(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <div className="pagesize-group">
            {[10, 20].map((n) => (
              <button key={n} className={`sort-chip${pageSize === n ? ' on' : ''}`} onClick={() => setPageSize(n)}>
                {n}개
              </button>
            ))}
          </div>
          <button
            className={`filter-toggle-btn${filterOpen ? ' open' : ''}${activeFilterCount > 0 ? ' has-active' : ''}`}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <SlidersHorizontal size={13} />
            필터
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {/* 필터 패널 — 접었다 펼치기 */}
      {filterOpen && (
        <div className="filter-panel">
          <FilterRow label="지역" options={['전체', '서울', '수도권', '지방']} value={state.regionF} onChange={state.setRegionF} />
          <FilterRow label="전형" options={['전체', '학종', '논술', '교과', '서류']} value={state.typeF} onChange={state.setTypeF} />
          {showChance && (
            <FilterRow
              label="안정도"
              options={['전체', '예측 가능', '안정', '적정', '소신', '도전', '자료 없음']}
              value={state.chanceF}
              onChange={state.setChanceF}
            />
          )}
          <FilterRow label="구분" options={['전체', '4년제', '전문대']} value={state.kindF} onChange={state.setKindF} />
          {activeFilterCount > 0 && (
            <button className="filter-reset-btn" onClick={resetFilters}>
              <X size={12} /> 필터 초기화
            </button>
          )}
        </div>
      )}

      {/* 결과 수 */}
      <p className="result-filtered-count">
        {filtered.length}개 대학
        {filtered.length === 0 && <span style={{ color: 'var(--brand)' }}> — 조건을 바꿔보세요</span>}
      </p>

      {/* 리스트 */}
      {filtered.length > 0 && (
        <div className="result-card-wrap">
          {paged.map((r, i) => (
            <div key={r.univId}>
              {i > 0 && <div className="result-divider" />}
              <ResultRow
                r={r}
                today={today}
                onClick={() => goTo('detail', { univ: r.name, univId: r.univId })}
                badge={badgeFn(r)}
              />
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

// ── 논술 전형 카드 ──────────────────────────────────────────────────────
const STAR_COLORS = { green: '#16a34a', brand: 'var(--brand)', gold: '#d97706' };

function EssayCard({ item, goTo, today }) {
  const filled   = '★'.repeat(item.star);
  const empty    = '☆'.repeat(3 - item.star);
  const dl = applyDeadline(item.applyCloseDate, item.applyCloseTime, today);

  const csatBadge =
    item.csatStatus === 'ok'      ? <span className="essay-csat-badge ok">수능 최저 충족</span>
    : item.csatStatus === 'fail'  ? <span className="essay-csat-badge fail">수능 최저 미달</span>
    : item.csatStatus === 'unknown' ? <span className="essay-csat-badge unknown">최저 불확실</span>
    : null;

  return (
    <button className="essay-card" onClick={() => goTo('detail', { univ: item.name, univId: item.univId })}>
      <div className={`essay-cat-bar essay-cat-${item.color}`}>
        <span className="essay-cat-label">{item.label}</span>
        <span className="essay-stars" style={{ color: STAR_COLORS[item.color] || 'var(--brand)' }}>
          {filled}<span style={{ opacity: 0.3 }}>{empty}</span>
        </span>
      </div>
      <div className="essay-card-body">
        <div className="essay-card-name">{item.name}</div>
        <div className="essay-card-sub">
          <MapPin size={11} /> {item.region}
          {item.admissionName && <span className="essay-adm-name">{item.admissionName}</span>}
        </div>
        {item.desc && <div className="essay-card-desc">{item.desc}</div>}
        <div className="essay-card-foot">
          <YearTag dataYear={item.dataYear} />
          {dl && !dl.past && (
            <span className={`dday-badge dday-${dl.days <= 3 ? 'urgent' : dl.days <= 10 ? 'soon' : 'far'}`}>
              <CalendarClock size={11} /> 접수 마감 {dl.label}
            </span>
          )}
          {item.csatMinimum && !item.csatMinimum.includes('없음') && (
            <span className="essay-csat-text">{item.csatMinimum}</span>
          )}
          {csatBadge}
          {item.gedEligible === '조건부' && (
            <span className="essay-cond-badge">조건부</span>
          )}
        </div>
        {/* 전형방법이 2027 자료에 없어 2028 시행계획에서 빌려 온 경우 반드시 밝힌다 */}
        {item.methodYear === PLAN_YEAR && item.dataYear === ADMISSION_DATA_YEAR && (
          <div className="essay-card-desc" style={{ opacity: .75 }}>
            ※ 논술 비중·수능최저는 {PLAN_YEAR}학년도 시행계획 기준이에요
            ({ADMISSION_DATA_YEAR}학년도 자료에는 전형방법이 없어요).
          </div>
        )}
      </div>
      <ChevronRight size={14} className="result-row-arrow" />
    </button>
  );
}

// ── 논술 탭 필터 ──────────────────────────────────────────────────────────
function useEssayFiltered(items) {
  const [catF,    setCatF]    = useState('전체');
  const [csatF,   setCsatF]   = useState('전체');
  const [regionF, setRegionF] = useState('전체');
  const [sortF,   setSortF]   = useState('추천순');

  const filtered = useMemo(() => {
    let out = [...items];
    if (catF === '논술 100%')   out = out.filter((r) => r.cat === 'essay100');
    else if (catF === '역산')   out = out.filter((r) => r.cat === 'inverse');
    else if (catF === '논술 90%+') out = out.filter((r) => r.cat === 'essay90');
    else if (catF === '혼합')   out = out.filter((r) => ['essay80','essay70','mixed'].includes(r.cat));

    if (csatF === '충족 예상') out = out.filter((r) => r.csatStatus === 'ok');
    else if (csatF === '최저 없음') out = out.filter((r) => r.csatStatus === null);
    else if (csatF === '확인 필요') out = out.filter((r) => ['unknown','fail'].includes(r.csatStatus));

    if (regionF === '서울')   out = out.filter((r) => r.region === '서울');
    else if (regionF === '수도권') out = out.filter((r) => METRO.has(r.region));
    else if (regionF === '지방') out = out.filter((r) => !METRO.has(r.region));

    if (sortF === '가나다') out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [items, catF, csatF, regionF, sortF]);

  return { filtered, catF, setCatF, csatF, setCsatF, regionF, setRegionF, sortF, setSortF };
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────
export default function ResultsScreen({ goTo = () => {}, goBack = () => {} }) {
  const profile = useMemo(loadProfile, []);
  const data = useMemo(() => (profile ? analyzeProfile(profile) : null), [profile]);
  const essayData = useMemo(() => (profile ? getEssayList(profile) : []), [profile]);
  const [tab, setTab] = useState('수시');
  // D-day 기준 '오늘' — 렌더마다 새로 만들지 않는다
  const today = useMemo(() => new Date(), []);

  const susiState    = useFilteredPaged(data?.susi?.results ?? []);
  const jeongsiState = useFilteredPaged(data?.jeongsi?.results ?? []);
  const essayState   = useEssayFiltered(essayData);

  if (!profile) {
    return (
      <div className="screen">
        <header className="topbar center">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
          <span className="page-title">나와 맞는 대학</span>
        </header>
        <div className="profile-card" style={{ marginTop: 40 }}>
          <span className="profile-name">먼저 내 정보를 알려주세요</span>
          <span className="profile-summary">몇 가지만 입력하면 맞춤 대학을 찾아드려요.</span>
          <button className="btn-outline" onClick={() => goTo('profile')}>정보 입력하기</button>
        </div>
      </div>
    );
  }

  const { susi, jeongsi } = data;
  const hasScore = !!data.hasScore;
  const summary = profileOneLiner(profile);
  const yearMix = data.yearMix || { with2027: 0, without2027: 0 };

  // 목록 하단 고지문 — 무엇이 어느 학년도 자료인지 밝힌다
  const yearNotice = (
    <>
      지원 가능 여부는 <b>{GED_2027_SOURCE_LABEL}</b> 기준이에요
      ({ADMISSION_DATA_UNIV_COUNT}개 대학 수록).
      {' '}이 자료에 없는 대학은 <b>{PLAN_YEAR}학년도 시행계획</b>으로 보여주고 행에 표시했어요.
      {' '}{PLAN_YEAR}학년도 전형 구조는 대학 상세에서 별도 섹션으로 따로 표시해요.
    </>
  );

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="page-title">나와 맞는 대학</span>
      </header>

      {/* 프로필 1줄 요약 */}
      <div className="result-profile-bar">
        <span className="result-profile-text">{summary}</span>
        <button className="result-profile-edit" onClick={() => goTo('profile')}>수정</button>
      </div>

      {/* 수시 / 논술 / 정시 탭 */}
      <div className="result-tabs">
        <button className={`result-tab${tab === '수시' ? ' active' : ''}`} onClick={() => setTab('수시')}>
          수시 <span className="result-tab-count">{susi.total}</span>
        </button>
        <button className={`result-tab${tab === '논술' ? ' active' : ''}`} onClick={() => setTab('논술')}>
          논술 <span className="result-tab-count">{essayData.length}</span>
        </button>
        <button
          className={`result-tab${tab === '정시' ? ' active' : ''}`}
          onClick={() => setTab('정시')}
          disabled={!jeongsi.available}
        >
          정시
          {jeongsi.available
            ? <span className="result-tab-count">{jeongsi.total}</span>
            : <span className="result-tab-count muted">–</span>}
        </button>
      </div>

      {/* ── 수시 탭 ── */}
      {tab === '수시' && (
        <>
          {/* 점수를 아직 안 넣었으면 '예측 불가' 목록 대신 입력을 크게 안내한다 */}
          {!hasScore && (
            <div className="profile-card" style={{ marginTop: 12, marginBottom: 4 }}>
              <span className="profile-name">점수를 넣으면 가능성을 보여드려요</span>
              <span className="profile-summary">
                검정고시 과목 점수를 넣으면 {CUTLINE_YEAR}학년도 합격선과 비교해 칸수를 보여드려요.
                <br />지금은 <b>지원할 수 있는지</b>만 표시하고 있어요.
              </span>
              <button className="btn-outline" onClick={() => goTo('profile')}>내 점수 입력</button>
            </div>
          )}
          <div className="result-count">
            지원 가능한 대학 <b>{susi.total}곳</b>
            <span className="result-exclude-hint">
              · {ADMISSION_DATA_YEAR}학년도 기준 {yearMix.with2027}곳 / {PLAN_YEAR}학년도 기준 {yearMix.without2027}곳
            </span>
          </div>
          <ResultSection
            state={susiState}
            goTo={goTo}
            today={today}
            badgeFn={(r) => <SusiBadge r={r} hasScore={hasScore} />}
            showChance={hasScore}
          />
          <p className="note" style={{ marginTop: 16 }}>
            {yearNotice}
            <br />합격 가능성 예측은 일반학생 입결 기반 참고값이에요({CUTLINE_SOURCE_LABEL_ALL}).
            <br />'추정' 표시는 대학이 검정고시 환산표를 공개하지 않아, 공개된 다른 대학 표의 중앙값으로 계산한 경우예요.
            <br />'대학 미확인 · 일반 안내'는 대교협 기본사항 기준 안내라 대학 시행계획 확인이 필요해요.
          </p>
        </>
      )}

      {/* ── 논술 탭 ── */}
      {tab === '논술' && (
        <>
          <div className="result-count">
            논술 전형 지원 가능 <b>{essayData.length}곳</b>
            <span className="result-exclude-hint">· 검정고시 지원 가능·조건부 한정</span>
          </div>

          {/* 논술 카테고리 안내 */}
          <div className="essay-legend">
            {[
              { label: '★★★ 논술 100%·역산', color: 'green', desc: '내신 영향 거의 없음' },
              { label: '★★ 논술 80~90%',      color: 'brand', desc: '내신 소폭 반영' },
              { label: '★ 혼합형',             color: 'gold',  desc: '모집요강 확인 필요' },
            ].map(({ label, color, desc }) => (
              <div key={color} className={`essay-legend-item legend-${color}`}>
                <span>{label}</span>
                <span className="essay-legend-sub">{desc}</span>
              </div>
            ))}
          </div>

          {/* 논술 필터 바 */}
          <div className="essay-filter-bar">
            <div className="essay-filter-row">
              <span className="essay-filter-label">유형</span>
              {['전체', '논술 100%', '역산', '논술 90%+', '혼합'].map((v) => (
                <button key={v}
                  className={`fchip${essayState.catF === v ? ' active' : ''}`}
                  onClick={() => essayState.setCatF(v)}>{v}</button>
              ))}
            </div>
            <div className="essay-filter-row">
              <span className="essay-filter-label">수능 최저</span>
              {['전체', '충족 예상', '최저 없음', '확인 필요'].map((v) => (
                <button key={v}
                  className={`fchip${essayState.csatF === v ? ' active' : ''}`}
                  onClick={() => essayState.setCsatF(v)}>{v}</button>
              ))}
            </div>
            <div className="essay-filter-row">
              <span className="essay-filter-label">지역</span>
              {['전체', '서울', '수도권', '지방'].map((v) => (
                <button key={v}
                  className={`fchip${essayState.regionF === v ? ' active' : ''}`}
                  onClick={() => essayState.setRegionF(v)}>{v}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <span className="essay-filter-label">정렬</span>
              {['추천순', '가나다'].map((v) => (
                <button key={v}
                  className={`fchip${essayState.sortF === v ? ' active' : ''}`}
                  onClick={() => essayState.setSortF(v)}>{v}</button>
              ))}
            </div>
          </div>

          <p className="result-filtered-count">
            {essayState.filtered.length}개
            {essayState.filtered.length === 0 && <span style={{ color: 'var(--brand)' }}> — 조건을 바꿔보세요</span>}
          </p>

          {essayState.filtered.length > 0 && (
            <div className="essay-list">
              {essayState.filtered.map((item) => (
                <EssayCard key={`${item.univId}-${item.admissionName}`} item={item} goTo={goTo} today={today} />
              ))}
            </div>
          )}

          <p className="note" style={{ marginTop: 16 }}>
            {yearNotice}
            <br />★★★ 논술 100% 전형은 검정고시생에게 가장 유리해요.
            <br />수능 최저 충족 여부는 프로필의 모의고사 등급 기준이에요.
            <br />{CUTLINE_SOURCE_LABEL}는 논술 전형의 합격선을 공개하지 않아, 논술은 칸수 대신 전형 성격으로 안내해요.
          </p>
        </>
      )}

      {/* ── 정시 탭 ── */}
      {tab === '정시' && (
        <>
          {!jeongsi.available ? (
            <div className="profile-card" style={{ marginTop: 24 }}>
              <span className="profile-name">수능을 볼 예정이 아니에요</span>
              <span className="profile-summary">수능 계획을 바꾸면 정시 대학도 볼 수 있어요.</span>
              <button className="btn-outline" onClick={() => goTo('profile')}>정보 수정하기</button>
            </div>
          ) : (
            <>
              <div className="result-count">
                수능 후 지원 가능한 대학 <b>{jeongsi.total}곳</b>
              </div>
              <div className="result-note" style={{ marginTop: 8 }}>
                <Info size={16} />
                <p>정시는 수능 점수로 결정돼요. 여기선 지원 자격만 확인해드려요.</p>
              </div>
              <ResultSection
                state={jeongsiState}
                goTo={goTo}
                today={today}
                badgeFn={() => <span className="fit-tag fit-ok">지원 가능</span>}
                showChance={false}
              />
              <p className="note" style={{ marginTop: 16 }}>{yearNotice}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
