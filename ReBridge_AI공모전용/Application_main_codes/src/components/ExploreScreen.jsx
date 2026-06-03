import { useMemo, useState } from 'react';
import { Search, X, ChevronRight, SlidersHorizontal, KeyRound, Map as MapIcon } from 'lucide-react';
import { getExploreList } from '../lib/analysis.js';
import { evaluateAdmission, admissionChance } from '../lib/scoreEngine.js';
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

// 자격(eligibility) 라벨 — '합격 가능성(칸수)'이 아니라 '지원할 수 있는지'를 뜻함.
const STATUS_LABEL = { ok: '지원 가능', cond: '조건 확인' };
// 점수는 있는데 칸수가 안 뜨는 이유(왜 어떤 카드는 칸수, 어떤 카드는 자격만 뜨는지 설명).
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

export default function ExploreScreen({ goTo = () => {} }) {
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
      const status = s.bestGedEligible === '가능' ? 'ok' : 'cond';
      return { ...s, chance, noChanceReason, status };
    });
    rows.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      // 추천순: 데이터 충실도 → 가능 우선 → 가나다
      const e = (b.status === 'ok') - (a.status === 'ok');
      if (e) return e;
      if (b.dataScore !== a.dataScore) return b.dataScore - a.dataScore;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [all, query, filter, sort, isSearching, hasScore, profile]);

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">대학 탐색</span>
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
                  {s.label}
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
                  <span className={`elig-tag elig-${s.status}`}>
                    <KeyRound size={11} /> {STATUS_LABEL[s.status]}
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
        <b>지원 가능</b>은 검정고시로 <b>넣을 수 있는지</b>(자격)를,
        <b> 칸수 게이지</b>는 내 점수로 본 <b>합격 가능성</b>을 뜻해요. 둘은 서로 달라요.
        <br />
        내 점수를 넣으면 합격선이 있는 전형은 칸수로, 자료가 없으면 그대로 <b>지원 가능</b>만 보여드려요.
        합격선·비교내신은 <b>작년 자료 참고용</b>이고, 실제는 모집요강을 확인해요.
      </p>
    </div>
  );
}
