import { useMemo, useState, useEffect } from 'react';
import { Search, X, ChevronRight, SlidersHorizontal, Sparkles, Map as MapIcon, ArrowLeft, Check, RotateCcw } from 'lucide-react';
import { getExploreList } from '../lib/analysis.js';
import { MAP_ENABLED } from '../lib/kakaoMap.js';
import { gedFit } from '../lib/scoreEngine.js';

// 한 번에 보여줄 대학 수 ('더 보기'로 증가)
const PAGE_SIZE = 20;

const GEOJEOM = new Set([
  '부산대학교', '경북대학교', '전남대학교', '충남대학교', '전북대학교',
  '강원대학교', '제주대학교', '충북대학교', '경상국립대학교', '국립강릉원주대학교',
]);

// 대학 탐색 = 점수와 무관한 둘러보기 (2026-09-17 동근님).
// 기본 가나다순, 체크박스 필터 6종. 같은 묶음 안은 '하나라도', 묶음끼리는 '모두' 맞아야 보인다.
// 점수로 본 합격 가능성은 '내 점수' 화면에서 본다.
const REGIONS = ['서울', '경기', '인천', '강원', '대전', '세종', '충북', '충남', '광주', '전북', '전남',
  '대구', '경북', '부산', '울산', '경남', '제주'];
const ESTAB = { '국립·공립': ['국립', '공립'], '사립': ['사립'], '특별법인': ['특별법법인'] };
// 키는 데이터의 admissionType 값 그대로, 라벨만 짧게
const TYPES = [
  ['학생부교과', '교과'], ['학생부종합', '종합'], ['논술', '논술'], ['실기', '실기'],
  ['수능위주', '수능'], ['일반(서류)', '일반(서류)'], ['특별전형', '특별'],
];
const TRI = [
  { key: 'none', label: '없는 전형 있음' },
  { key: 'has', label: '있는 전형 있음' },
  { key: 'unknown', label: '확인 필요' },
];

const GROUPS = [
  { key: 'region', title: '지역', options: REGIONS.map((r) => ({ key: r, label: r })) },
  { key: 'kind', title: '학교 종류', options: [{ key: '대학교', label: '4년제' }, { key: '전문대학', label: '전문대' }] },
  { key: 'estab', title: '설립', options: Object.keys(ESTAB).map((k) => ({ key: k, label: k })) },
  { key: 'type', title: '전형 (검정고시 지원 가능)', options: TYPES.map(([key, label]) => ({ key, label })) },
  { key: 'csat', title: '수능최저', options: TRI, note: '대학별로 확인된 값이 아직 적어요. 대부분 \'확인 필요\'예요.' },
  { key: 'interview', title: '면접', options: TRI, note: '대학별로 확인된 값이 아직 적어요. 대부분 \'확인 필요\'예요.' },
  { key: 'geojeom', title: '지방거점', options: [{ key: 'yes', label: '지방거점 국립대만' }] },
];
const EMPTY = Object.fromEntries(GROUPS.map((g) => [g.key, []]));

function triOf(facets) {
  return facets.length ? facets : ['unknown'];
}

function matches(s, sel) {
  const any = (picked, values) => picked.length === 0 || picked.some((p) => values.includes(p));
  return (
    any(sel.region, [s.region]) &&
    any(sel.kind, [s.kind]) &&
    any(sel.estab, Object.keys(ESTAB).filter((k) => ESTAB[k].includes(s.establishment))) &&
    any(sel.type, s.availableTypes) &&
    any(sel.csat, triOf(s.csatFacets)) &&
    any(sel.interview, triOf(s.interviewFacets)) &&
    any(sel.geojeom, GEOJEOM.has(s.name) ? ['yes'] : [])
  );
}

// 약칭(로고용 2글자)
function shortName(name) {
  const base = name.replace(/대학교$|대학$|학교$/, '');
  return base.slice(0, 2) || name.slice(0, 2);
}

export default function ExploreScreen({ goTo = () => {}, goBack = () => {}, canGoBack = false }) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE); // '더 보기'로 노출 개수 증가

  const all = useMemo(getExploreList, []);
  const isSearching = query.trim() !== '';
  const activeCount = Object.values(sel).reduce((n, v) => n + v.length, 0);

  function toggle(group, key) {
    setSel((cur) => {
      const on = cur[group].includes(key);
      return { ...cur, [group]: on ? cur[group].filter((k) => k !== key) : [...cur[group], key] };
    });
  }

  const list = useMemo(() => {
    const q = query.trim();
    const rows = all
      .filter((s) => (isSearching ? s.name.includes(q) : matches(s, sel)))
      .map((s) => ({
        ...s,
        status: s.bestGedEligible === '가능' ? 'ok' : 'cond',
        // 점수와 무관한 '지원 수월' 힌트
        fit: gedFit({ admissionType: s.bestType, gedEligible: s.bestGedEligible }, s.comparativeType),
      }));
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return rows;
  }, [all, query, sel, isSearching]);

  // 필터/검색이 바뀌면 노출 개수를 처음으로 되돌린다.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, sel]);

  const shown = list.slice(0, visible);
  const hasMore = list.length > visible;

  return (
    <div className="screen">
      <header className="topbar">
        <span className="topbar-left">
          {canGoBack && (
            <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
              <ArrowLeft size={22} />
            </button>
          )}
          <span className="page-title">대학 탐색</span>
        </span>
        {/* 지도 — 카카오맵 스위치가 꺼져 있으면 버튼도 숨긴다(빈 지도로 보내지 않기) */}
        {MAP_ENABLED && (
          <button className="topbar-textbtn" onClick={() => goTo('map')}>
            <MapIcon size={16} /> 지도
          </button>
        )}
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
          <div className="explore-toolbar">
            <button className={`xf-toggle ${activeCount ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              <SlidersHorizontal size={15} /> 필터{activeCount ? ` ${activeCount}` : ''}
            </button>
            <span className="explore-count">
              <b>{list.length}</b>개 대학 · 가나다순
            </span>
          </div>

          {open && (
            <div className="xf-panel">
              {GROUPS.map((g) => (
                <div key={g.key} className="xf-group">
                  <p className="xf-title">{g.title}</p>
                  <div className="xf-options">
                    {g.options.map((o) => {
                      const on = sel[g.key].includes(o.key);
                      return (
                        <button
                          key={o.key}
                          className={`xf-opt ${on ? 'on' : ''}`}
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => toggle(g.key, o.key)}
                        >
                          <span className="xf-box">{on && <Check size={12} strokeWidth={3} />}</span>
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  {g.note && <p className="xf-note">{g.note}</p>}
                </div>
              ))}
              <div className="xf-actions">
                <button className="xf-reset" onClick={() => setSel(EMPTY)} disabled={!activeCount}>
                  <RotateCcw size={14} /> 초기화
                </button>
                <button className="xf-done" onClick={() => setOpen(false)}>{list.length}개 대학 보기</button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="uni-list" style={{ marginTop: 12 }}>
        {shown.map((s) => (
          <button
            key={s.univId}
            className="uni-card"
            onClick={() => goTo('detail', { univ: s.name, univId: s.univId })}
          >
            <span className={`uni-logo uni-logo-${s.status}`}>{shortName(s.name)}</span>
            <span className="uni-body">
              <span className="uni-name-row">
                <span className="uni-name">{s.name}</span>
                <span className={`fit-tag fit-${s.fit?.level || 'ok'}`}>
                  <Sparkles size={11} /> {s.fit?.label || '지원 가능'}
                </span>
              </span>
              <span className="uni-sub">
                {s.region}
                {s.establishment ? ` · ${s.establishment}` : ''}
                {s.kind === '전문대학' ? ' · 전문대학' : ''}
                {s.eligibleCount > 0 ? ` · 검정고시 ${s.eligibleCount}전형` : ''}
                {/* 최신 학년도 자료면 굳이 안 밝힌다 — 다른 해 자료일 때만 알린다 */}
                {!s.is2027 ? ` · ${s.dataYear}학년도 기준` : ''}
              </span>
            </span>
            <ChevronRight size={18} className="uni-arrow" />
          </button>
        ))}
        {list.length === 0 && (
          <p className="empty-line">
            {isSearching ? `"${query.trim()}"에 해당하는 대학이 없어요.` : '조건에 맞는 대학이 없어요. 필터를 줄여 보세요.'}
          </p>
        )}
      </div>

      {hasMore && (
        <button
          className="explore-more-btn"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
        >
          더 보기 <span className="explore-more-count">{list.length - visible}개 남음</span>
        </button>
      )}

      <button className="explore-help-link" onClick={() => goTo('explore-help')}>
        <span className="explore-help-emoji" aria-hidden="true">💡</span>
        <span className="explore-help-text">
          <b>이 목록 읽는 법</b>
          <span>지원 수월 · 어느 해 자료인지 · 필터 기준</span>
        </span>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
