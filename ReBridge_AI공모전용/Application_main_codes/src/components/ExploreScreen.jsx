import { useMemo, useState } from 'react';
import { Search, X, ChevronRight, SlidersHorizontal, Sparkles, Map as MapIcon, ArrowLeft } from 'lucide-react';
import { getExploreList } from '../lib/analysis.js';
import { evaluateAdmission, admissionChance, gedFit } from '../lib/scoreEngine.js';
import ChanceGauge from './ChanceGauge.jsx';

const STORAGE_KEY = 'rebridge_profile';

const GEOJEOM = new Set([
  '부산대학교', '경북대학교', '전남대학교', '충남대학교', '전북대학교',
  '강원대학교', '제주대학교', '충북대학교', '경상국립대학교', '국립강릉원주대학교',
]);

const FILTERS = ['전체', '서울', '수도권', '지방거점', '전문대학'];
const SORTS = [
  { key: 'reco', label: '추천순' },
  { key: 'name', label: '가나다순' },
];

// 점수는 있는데 칸수가 안 뜨는 이유(왜 어떤 카드는 칸수, 어떤 카드는 적합도만 뜨는지 설명).
const NO_CHANCE_REASON = { csat: '수능 기준', cutline: '합격선 자료 없음' };

// 약칭(로고용 2글자)
function shortName(name) {
  const base = name.replace(/대학교$|대학$|학교$/, '');
  return base.slice(0, 2) || name.slice(0, 2);
}

function matchFilter(s, filter) {
  if (filter === '전체') return true;
  if (filter === '전문대학') return s.kind === '전문대학';
  if (filter === '서울') return s.region === '서울' && s.kind === '대학교';
  if (filter === '수도권') return ['경기', '인천'].includes(s.region) && s.kind === '대학교';
  if (filter === '지방거점') return GEOJEOM.has(s.name) && s.kind === '대학교';
  return true;
}

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export default function ExploreScreen({ goTo = () => {}, goBack = () => {} }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('전체');
  const [sort, setSort] = useState('reco');

  const profile = useMemo(loadProfile, []);
  const all = useMemo(getExploreList, []);
  const hasScore = !!(profile && profile.gedScores && profile.gedAvg != null);

  const isSearching = query.trim() !== '';

  const list = useMemo(() => {
    const q = query.trim();
    let rows = all.filter((s) =>
      isSearching ? s.name.includes(q) : matchFilter(s, filter)
    );
    rows = rows.map((s) => {
      // 프로필 점수 있으면 best 전형에 대해 합격 판정 → 칸수 게이지.
      // 칸수가 안 나오면(수능 기준/합격선 없음) 그 '이유'를 같이 담아 자격만 뜨는 카드를 설명.
      let chance = null;
      let noChanceReason = null;
      if (hasScore && s.bestType) {
        const ev = evaluateAdmission(profile, {
          univId: s.univId,
          admissionType: s.bestType,
          admissionName: s.bestName,
          gedEligible: s.bestGedEligible,
        });
        if (ev.applicable) chance = admissionChance(ev);
        if (!chance) noChanceReason = NO_CHANCE_REASON[ev.dataGap] || null;
      }
      // 비확률적 '적합도' — 칸수가 없을 때(또는 점수 없을 때)도 항상 주는 힌트.
      const fit = gedFit(
        { admissionType: s.bestType, gedEligible: s.bestGedEligible },
        s.comparativeType
      );
      const status = s.bestGedEligible === '가능' ? 'ok' : 'cond';
      return { ...s, chance, noChanceReason, status, fit };
    });
    rows.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      // 추천순:
      //  - 점수가 있으면 '합격 가능성(칸수)' 높은 순을 최우선 → 위에서부터 유리한 대학.
      //    칸수를 낼 자료가 없는 대학(level 0)은 아래로 내려, "더 유리한 순"이 명확해지게.
      //  - 그 다음은 지원 가능 우선 → 데이터 충실도 → 가나다.
      if (hasScore) {
        const al = a.chance ? a.chance.level : 0;
        const bl = b.chance ? b.chance.level : 0;
        if (al !== bl) return bl - al;
      }
      const e = (b.status === 'ok') - (a.status === 'ok');
      if (e) return e;
      // 칸수가 없는(또는 점수 없는) 대학끼리는 '적합도'가 좋은 순으로.
      const FIT = { good: 3, ok: 2, check: 1, no: 0 };
      const fa = FIT[a.fit?.level] ?? 2;
      const fb = FIT[b.fit?.level] ?? 2;
      if (fa !== fb) return fb - fa;
      if (b.dataScore !== a.dataScore) return b.dataScore - a.dataScore;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [all, query, filter, sort, isSearching, hasScore, profile]);

  return (
    <div className="screen">
      <header className="topbar">
        <span className="topbar-left">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
            <ArrowLeft size={22} />
          </button>
          <span className="page-title">대학 탐색</span>
        </span>
        <button className="topbar-textbtn" onClick={() => goTo('map')}>
          <MapIcon size={16} /> 지도
        </button>
      </header>

      {/* 검색 (토스풍 큰 입력) */}
      <div className="search-bar">
        <Search size={18} color="var(--text-sub)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="대학 이름으로 검색"
          aria-label="대학 검색"
        />
        {isSearching && (
          <button
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => setQuery('')}
            aria-label="검색 지우기"
          >
            <X size={16} color="var(--text-sub)" />
          </button>
        )}
      </div>

      {!isSearching && (
        <>
          <div className="filter-row">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`fchip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="explore-toolbar">
            <span className="explore-count">
              <b>{list.length}</b>개 대학
            </span>
            <div className="sort-group">
              <SlidersHorizontal size={14} />
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  className={`sort-chip ${sort === s.key ? 'on' : ''}`}
                  onClick={() => setSort(s.key)}
                >
                  {s.key === 'reco' && hasScore ? '가능성순' : s.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {!hasScore && !isSearching && (
        <button className="explore-banner" onClick={() => goTo('profile')}>
          <span className="explore-banner-body">
            <b>내 검정고시 점수</b>를 넣으면<br />각 대학 합격 가능성까지 한눈에 보여요
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      <div className="uni-list" style={{ marginTop: 12 }}>
        {list.map((s) => (
          <button
            key={s.univId}
            className="uni-card"
            onClick={() => goTo('detail', { univ: s.name, univId: s.univId })}
          >
            <span className={`uni-logo uni-logo-${s.status}`}>{shortName(s.name)}</span>
            <span className="uni-body">
              <span className="uni-name-row">
                <span className="uni-name">{s.name}</span>
                {s.chance ? (
                  <ChanceGauge chance={s.chance} compact />
                ) : (
                  <span className={`fit-tag fit-${s.fit?.level || 'ok'}`}>
                    <Sparkles size={11} /> {s.fit?.label || '지원 가능'}
                  </span>
                )}
              </span>
              <span className="uni-sub">
                {s.region}
                {s.establishment ? ` · ${s.establishment}` : ''}
                {s.kind === '전문대학' ? ' · 전문대학' : ''}
                {s.eligibleCount > 0 ? ` · 검정고시 ${s.eligibleCount}전형` : ''}
                {hasScore && !s.chance && s.noChanceReason ? ` · ${s.noChanceReason}` : ''}
              </span>
            </span>
            <ChevronRight size={18} className="uni-arrow" />
          </button>
        ))}
        {list.length === 0 && (
          <p className="empty-line">
            {isSearching ? `"${query.trim()}"에 해당하는 대학이 없어요.` : '해당 대학이 없어요.'}
          </p>
        )}
      </div>

      <p className="note">
        <b>칸수 게이지</b>(안정·적정·소신…)는 내 점수로 본 <b>합격 가능성</b>이에요.
        <br />
        <b>지원 수월/지원 가능</b>은 합격선 자료가 없을 때, <b>검정고시생이 지원하기 좋은 정도</b>(전형 성격·환산표·수능최저)를 알려주는 거예요 —
        <b> 합격 확률이 아니에요.</b> 카드를 누르면 그 이유를 자세히 볼 수 있어요.
        <br />
        합격선·비교내신은 <b>작년 자료 참고용</b>이고, 실제는 모집요강을 확인해요.
      </p>
    </div>
  );
}
