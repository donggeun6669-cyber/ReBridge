import { useMemo, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import SyTop from './SyTop.jsx';
import { getExploreList } from '../lib/analysis.js';
import { gedFit } from '../lib/scoreEngine.js';
import { EXPLORE_FILTERS, EXPLORE_EMPTY, exploreMatches } from './cUtil.js';
import './sy-c.css';

// 서연 UI 「대학 찾기」 — 2026-09-28 시안
// 목록 원본은 예전 ExploreScreen 과 같은 getExploreList() (점수와 무관한 둘러보기, 가나다순).
// 시안에는 '조건 필터' 화면만 있다. 아래 버튼을 누르거나 이름을 검색하면
// 같은 화면 안에서 대학 목록을 보여 준다(목록 모양은 「나와 맞는 대학」 카드를 따름).

export default function SyExplore({ goTo, goBack }) {
  const all = useMemo(getExploreList, []);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(EXPLORE_EMPTY);
  const [showList, setShowList] = useState(false);

  const q = query.trim();
  const isSearching = q !== '';

  const list = useMemo(() => {
    const rows = all.filter((s) => (isSearching ? s.name.includes(q) : exploreMatches(s, sel)));
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return rows;
  }, [all, sel, q, isSearching]);

  const listMode = isSearching || showList;

  function back() {
    if (showList && !isSearching) setShowList(false);
    else goBack();
  }

  return (
    <div className="sy-screen">
      <SyTop title="대학 찾기" onBack={back} />

      <label className="sy-c-search">
        <Search size={20} strokeWidth={2} className="sy-c-search-ico" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="대학 이름을 검색해요"
          aria-label="대학 이름 검색"
        />
      </label>

      {!listMode && (
        <>
          <div className="sy-c-sec">
            <h3 className="sy-c-sec-title">조건 필터</h3>
            <button type="button" className="sy-c-sec-link green" onClick={() => setSel(EXPLORE_EMPTY)}>초기화</button>
          </div>

          <div className="sy-c-filters">
            {EXPLORE_FILTERS.map((f) => {
              const value = sel[f.key];
              const label = f.options.find(([k]) => k === value)?.[1] ?? f.options[0][1];
              return (
                <label key={f.key} className="sy-c-filter">
                  <span className="sy-c-filter-name">{f.label}</span>
                  <span className={`sy-c-filter-val${value ? ' on' : ''}`}>{label}</span>
                  <ChevronDown size={16} strokeWidth={2} className="sy-c-filter-caret" aria-hidden="true" />
                  <select
                    className="sy-c-select-native"
                    aria-label={f.label}
                    value={value}
                    onChange={(e) => setSel((s) => ({ ...s, [f.key]: e.target.value }))}
                  >
                    {f.options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
              );
            })}
          </div>

          <button type="button" className="sy-btn sy-c-cta" onClick={() => setShowList(true)} disabled={list.length === 0}>
            조건에 맞는 대학 {list.length}곳 보기
          </button>
        </>
      )}

      {listMode && (
        <>
          <p className="sy-c-note">
            {isSearching ? `"${q}" 검색 결과 ${list.length}곳` : `조건에 맞는 대학 ${list.length}곳 · 가나다순`}
          </p>
          {list.length > 0 ? (
            <div className="sy-c-list">
              {list.map((s) => {
                const fit = gedFit({ admissionType: s.bestType, gedEligible: s.bestGedEligible }, s.comparativeType);
                return (
                  <button
                    key={s.univId}
                    type="button"
                    className="sy-c-row"
                    onClick={() => goTo('detail', { univ: s.name, univId: s.univId })}
                  >
                    <span className="sy-c-row-line">
                      <span className="sy-c-row-name">{s.name}</span>
                      <span className="sy-c-pill lv4">{fit?.label || '지원 가능'}</span>
                    </span>
                    <span className="sy-c-row-line">
                      <span className="sy-c-row-sub">
                        {s.region}
                        {s.establishment ? ` · ${s.establishment}` : ''}
                        {s.kind === '전문대학' ? ' · 전문대학' : ''}
                        {s.eligibleCount > 0 ? ` · 검정고시 ${s.eligibleCount}전형` : ''}
                        {!s.is2027 ? ` · ${s.dataYear}학년도 기준` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="sy-c-note">
              {isSearching ? '이름에 맞는 대학이 없어요.' : '조건에 맞는 대학이 없어요. 필터를 줄여 보세요.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
