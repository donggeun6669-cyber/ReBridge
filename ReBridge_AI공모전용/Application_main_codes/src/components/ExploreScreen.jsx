import { useState } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';

const GEOJEOM = new Set([
  '부산대학교', '경북대학교', '전남대학교', '충남대학교', '전북대학교',
  '강원대학교', '제주대학교', '충북대학교', '경상국립대학교', '국립강릉원주대학교',
]);

// rank: 낮을수록 상위 (1 = 가장 높은 랭킹)
const SCHOOLS = [
  { short: '서울', name: '서울대학교',         region: '서울', kind: '대학교',   sub: '학생부종합 · 면접 있음',            status: 'ok',   rank: 1  },
  { short: '연세', name: '연세대학교',         region: '서울', kind: '대학교',   sub: '학생부종합 · 수능최저 있음',        status: 'ok',   rank: 2  },
  { short: '고려', name: '고려대학교',         region: '서울', kind: '대학교',   sub: '학생부종합 · 수능최저 있음',        status: 'ok',   rank: 3  },
  { short: '한양', name: '한양대학교',         region: '서울', kind: '대학교',   sub: '학생부종합 · 수능최저 없음',        status: 'ok',   rank: 4  },
  { short: '시립', name: '서울시립대학교',     region: '서울', kind: '대학교',   sub: '학생부종합 · 면접 있음',            status: 'ok',   rank: 5  },
  { short: '국민', name: '국민대학교',         region: '서울', kind: '대학교',   sub: '논술전형 · 검정고시 유리',          status: 'ok',   rank: 6  },
  { short: '아주', name: '아주대학교',         region: '경기', kind: '대학교',   sub: '논술전형 · 수능최저 있음',          status: 'ok',   rank: 7  },
  { short: '인하', name: '인하대학교',         region: '인천', kind: '대학교',   sub: '논술전형 · 교과 30% 반영',         status: 'ok',   rank: 8  },
  { short: '부산', name: '부산대학교',         region: '부산', kind: '대학교',   sub: '학생부종합 · 거점국립대',           status: 'ok',   rank: 9  },
  { short: '경북', name: '경북대학교',         region: '대구', kind: '대학교',   sub: '논술전형 · 교과 30% 반영',         status: 'ok',   rank: 10 },
  { short: '인제', name: '인제대학교',         region: '경남', kind: '대학교',   sub: '학생부종합 · 수능최저 없음',        status: 'ok',   rank: 11 },
  { short: '가천', name: '가천대학교',         region: '경기', kind: '대학교',   sub: '기회균형 · 검정고시 조건 확인',     status: 'cond', rank: 12 },
  { short: '충남', name: '충남대학교',         region: '대전', kind: '대학교',   sub: '학생부교과 · 비교내신 환산 필요',   status: 'cond', rank: 13 },
  { short: '인강', name: '인천재능대학교',     region: '인천', kind: '전문대학', sub: '수시 일반전형 · 면접 있음',         status: 'ok',   rank: 14 },
  { short: '경과', name: '경기과학기술대학교', region: '경기', kind: '전문대학', sub: '수시 일반전형 · 면접 있음',         status: 'ok',   rank: 15 },
];

const FILTERS = ['전체', '서울', '수도권', '지방거점', '기타', '전문대학'];

// 지원가능→조건부→불가, 같은 그룹 내 rank 오름차순
const STATUS_ORDER = { ok: 0, cond: 1, no: 2 };
const STATUS_LABEL = { ok: '지원 가능', cond: '조건부', no: '지원 어려움' };
// 뱃지 대신 아이콘 색으로 상태 표현
const STATUS_BADGE_COLOR = { ok: 'ok', cond: 'cond', no: 'no' };

function matchFilter(s, filter) {
  if (filter === '전체')     return true;
  if (filter === '전문대학') return s.kind === '전문대학';
  if (filter === '서울')     return s.region === '서울' && s.kind === '대학교';
  if (filter === '수도권')   return ['경기', '인천'].includes(s.region) && s.kind === '대학교';
  if (filter === '지방거점') return GEOJEOM.has(s.name) && s.kind === '대학교';
  if (filter === '기타')     return !['서울', '경기', '인천'].includes(s.region) && !GEOJEOM.has(s.name) && s.kind === '대학교';
  return true;
}

export default function ExploreScreen({ goTo = () => {} }) {
  const [query, setQuery]   = useState('');
  const [filter, setFilter] = useState('전체');

  const isSearching = query.trim() !== '';

  const list = SCHOOLS
    .filter((s) =>
      isSearching ? s.name.includes(query.trim()) : matchFilter(s, filter)
    )
    .sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2);
      if (statusDiff !== 0) return statusDiff;
      return (a.rank ?? 99) - (b.rank ?? 99);
    });

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">대학 탐색</span>
      </header>

      {!isSearching && (
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
      )}

      <div className="search-bar" style={{ marginTop: isSearching ? 8 : 6 }}>
        <Search size={18} color="var(--text-sub)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="대학 이름으로 검색해요"
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

      <div className="uni-list" style={{ marginTop: 10 }}>
        {list.map((s) => (
          <button key={s.name} className="uni-card" onClick={() => goTo('detail', { univ: s.name })}>
            <span className={`uni-logo uni-logo-${s.status}`}>{s.short}</span>
            <span className="uni-body">
              <span className="uni-name">{s.name}</span>
              <span className="uni-sub">{s.sub}</span>
            </span>
            <span className={`badge ${STATUS_BADGE_COLOR[s.status]}`}>
              {STATUS_LABEL[s.status]}
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
        지금은 예시 대학 몇 곳만 보여드려요.
        <br />
        곧 전국 대학으로 넓혀갈 거예요.
      </p>
    </div>
  );
}
