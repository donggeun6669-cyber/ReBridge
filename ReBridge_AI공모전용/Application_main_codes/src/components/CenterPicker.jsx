import { useMemo, useState } from 'react';
import { Search, X, ArrowLeft, Check } from 'lucide-react';
import { REGIONS, filterCenters, shortName, centerMark } from '../lib/centers.js';
import { getHomeRegion, getMyCenterId, setMyCenterId } from '../lib/persona.js';
import '../styles.v3.css';

// 다니는 꿈드림센터 고르기 (2026-09-26 — 이미 꿈드림을 다니는 아이를 위한 '우리 센터' 홈의 입구)
//   시작 질문(OnboardingScreen)과 '내 센터 고르기' 화면(MyCenterPickScreen)이 같이 쓴다.

export function CenterPicker({ region: regionInit, selectedId, onPick }) {
  const [region, setRegion] = useState(regionInit && REGIONS.includes(regionInit) ? regionInit : '서울');
  const [query, setQuery] = useState('');
  const list = useMemo(() => filterCenters({ region: query.trim() ? null : region, query }), [region, query]);

  return (
    <div>
      <label className="v3-search">
        <Search size={17} aria-hidden="true" />
        <input type="search" placeholder="구 이름이나 센터 이름" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button type="button" className="v3-icon-btn" style={{ width: 28, height: 28 }} aria-label="지우기" onClick={() => setQuery('')}>
            <X size={15} />
          </button>
        )}
      </label>
      {!query.trim() && (
        <div className="v3-chips" style={{ marginTop: 10 }}>
          {REGIONS.map((r) => (
            <button key={r} type="button" className={`v3-chip${region === r ? ' on' : ''}`} onClick={() => setRegion(r)}>{r}</button>
          ))}
        </div>
      )}
      <div className="v3-list" style={{ marginTop: 12 }}>
        {list.length === 0 && <div className="v3-empty"><b>찾는 센터가 없어요</b>다른 이름으로 찾아보세요.</div>}
        {list.map((c) => (
          <button key={c.id} type="button" className="v3-row" onClick={() => onPick(c)}>
            <span className="v3-cav" aria-hidden="true">{centerMark(c)}</span>
            <span className="v3-row-main">
              <span className="v3-row-title">{shortName(c)}</span>
              <span className="v3-row-sub clamp">{c.address}</span>
            </span>
            {selectedId === c.id && <Check size={18} color="var(--v3-green)" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// MY·홈에서 여는 '내 센터 고르기' 화면
export default function MyCenterPickScreen({ goTo = () => {}, goBack = () => {} }) {
  const current = getMyCenterId();
  return (
    <div className="screen v3-screen">
      <header className="v3-top">
        <button className="v3-icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="v3-top-title">다니는 꿈드림센터</span>
      </header>
      <div className="v3-pad" style={{ paddingBottom: 12 }}>
        <h1 className="v3-h1" style={{ fontSize: 22 }}>어느 꿈드림에<br />다니고 있어요?</h1>
        <p className="v3-lead" style={{ fontSize: 14 }}>고르면 홈이 ‘우리 센터’ 화면으로 바뀌어요. 이 기기에만 저장돼요.</p>
      </div>
      <CenterPicker
        region={getHomeRegion()}
        selectedId={current}
        onPick={(c) => { setMyCenterId(c.id); goTo('home'); }}
      />
      {current && (
        <div style={{ padding: '14px 16px 0' }}>
          <button type="button" className="v3-btn ghost block" onClick={() => { setMyCenterId(null); goTo('home'); }}>
            지금은 다니지 않아요
          </button>
        </div>
      )}
    </div>
  );
}
