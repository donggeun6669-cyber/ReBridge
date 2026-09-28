import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Navigation } from 'lucide-react';
import SyTop from './SyTop.jsx';
import { loadProfile } from '../lib/persona.js';
import { aRoadmap, checklistItems, loadChecked, saveChecked } from './aUtil.js';
import './sy-a.css';

// 나의 대입 로드맵 — 서연 UI 시안 「나의 대입 로드맵 · 처음 상태」 / 「… · 진행 상태」(2026-09-28)
//   학년·사는 지역이 없으면 처음 상태(내 정보부터 + 네 걸음), 있으면 진행 상태(지금 단계 + 챙길 서류).
//   'checklist'(예전 서류 체크리스트) 로 열리면 챙길 서류를 전부 펼치고 그 자리로 내려간다.
//   서류 체크는 ChecklistSection 과 같은 저장소(localStorage rebridge_checklist)를 쓴다.

const DOCS_PREVIEW = 3;

export default function SyRoadmap({ goTo = () => {}, goBack = () => {}, screen }) {
  const profile = useMemo(() => loadProfile(), []);
  const rm = useMemo(() => aRoadmap(profile), [profile]);
  const first = !rm.infoDone;
  const focusDocs = screen === 'checklist';
  const docsRef = useRef(null);

  const items = useMemo(() => checklistItems(profile), [profile]);
  const [checked, setChecked] = useState(() => loadChecked());
  const [showAll, setShowAll] = useState(focusDocs);

  useEffect(() => {
    if (!focusDocs) return undefined;
    const t = setTimeout(() => docsRef.current?.scrollIntoView({ block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [focusDocs]);

  function toggle(id) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveChecked(next);
      return next;
    });
  }

  const editInfo = () => goTo('onboarding', { step: 'grade' });
  const stepGo = {
    info: editInfo,
    univ: () => goTo('univ-explore'),
    apply: () => docsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    result: null,
  };

  // 진행 상태에서는 지금 단계의 다음 칸까지만 보인다(시안)
  const curIdx = rm.steps.findIndex((s) => s.status === 'current');
  const steps = first ? rm.steps : rm.steps.slice(0, curIdx + 2);

  const shown = showAll ? items : items.slice(0, DOCS_PREVIEW);
  const doneRows = shown.filter((it) => checked[it.id]);
  const todoRows = shown.filter((it) => !checked[it.id]);

  return (
    <div className="sy-screen sy-a-rm">
      <SyTop title="나의 대입 로드맵" onBack={goBack} />

      {first ? (
        <section className="sy-a-rm-hero">
          <span className="sy-a-pill green soft"><Navigation size={13} strokeWidth={2.2} /> 지금 첫 단계예요</span>
          <h2 className="sy-a-rm-hero-title">내 정보부터 알려주세요</h2>
          <p className="sy-a-rm-hero-sub">입력한 내용으로 필요한 순서를 맞춰드려요.</p>
          <button type="button" className="sy-btn sy-a-rm-hero-btn" onClick={editInfo}>내 정보 입력하기</button>
        </section>
      ) : (
        <section className="sy-a-rm-hero on">
          <div className="sy-a-rm-hero-head">
            <span className="sy-a-pill dark"><Navigation size={13} strokeWidth={2.2} /> 지금 여기</span>
            <span className="sy-a-rm-place">{rm.place}</span>
          </div>
          <h2 className="sy-a-rm-hero-title">
            {rm.bookmarkCount > 0 ? '지원할 대학을 정리해요' : '대학을 알아볼 때예요'}
          </h2>
          <p className="sy-a-rm-hero-sub">
            {rm.bookmarkCount > 0 ? '모집요강이 나오면 일정과 서류를 확인해요.' : '조건에 맞는 학교와 전형을 비교해요.'}
          </p>
        </section>
      )}

      {first && <h2 className="sy-a-sec">대입까지 네 걸음</h2>}

      <ol className={`sy-card sy-a-tl${first ? '' : ' gap'}`}>
        {steps.map((s, i) => {
          const go = stepGo[s.id];
          const last = i === steps.length - 1;
          return (
            <li key={s.id} className={`sy-a-tl-step is-${s.status}${last ? ' last' : ''}`}>
              <button type="button" className="sy-a-tl-btn" onClick={go || undefined} disabled={!go}
                aria-current={s.status === 'current' ? 'step' : undefined}>
                <span className="sy-a-tl-dot" aria-hidden="true">
                  {s.status === 'done' && <Check size={15} strokeWidth={3} />}
                  {s.status === 'current' && <Navigation size={13} strokeWidth={2.4} />}
                  {s.status === 'next' && <i />}
                </span>
                <span className="sy-a-tl-text">
                  <b>{s.title}</b>
                  <span>{s.sub}</span>
                </span>
                {s.badge && <span className={`sy-a-badge ${s.badge.tone}`}>{s.badge.text}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {(!first || focusDocs) && (
        <section ref={docsRef} className="sy-a-docs">
          <div className="sy-a-docs-head">
            <h2 className="sy-a-sec">챙길 서류</h2>
            {items.length > DOCS_PREVIEW && (
              <button type="button" className="sy-a-more" onClick={() => setShowAll(!showAll)}>
                {showAll ? '접기' : '전체 보기'}
              </button>
            )}
          </div>
          <div className="sy-card sy-a-docs-card">
            {doneRows.map((it) => <DocRow key={it.id} item={it} on onToggle={toggle} />)}
            {doneRows.length > 0 && todoRows.length > 0 && <hr className="sy-a-docs-hr" />}
            {todoRows.map((it) => <DocRow key={it.id} item={it} onToggle={toggle} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function DocRow({ item, on = false, onToggle }) {
  return (
    <button type="button" className={`sy-a-doc${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onToggle(item.id)}>
      <span className="sy-a-doc-box" aria-hidden="true"><Check size={14} strokeWidth={2.6} /></span>
      <span className="sy-a-doc-title">{item.title}</span>
      <span className="sy-a-doc-state">{on ? '준비됨' : '확인 전'}</span>
    </button>
  );
}
