import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import SyTop from './SyTop.jsx';
import './sy-d.css';
import { getUniversityDetail, getUniversityDetailByName } from '../lib/analysis.js';
import { getDocuments } from '../lib/documents.js';
import GUIDELINES from '../data/guidelines_2027.json';

// 제출서류 (시안 '제출서류.png') — 기존 DocumentsScreen + DocumentsChecklist 기능.
// params: { univId, univ, admissionName } — 대학 상세의 전형 행에서 온다.
// 체크 상태는 기존과 같은 저장소 키(rebridge_docs_<대학>_<전형>)에 둔다 → 예전 화면에서 체크한 것도 그대로 보인다.

// 서류 아래 한 줄(어디서 떼는지). 발급처는 기존 data/checklists.js 에 적힌 값만 쓴다.
const ISSUER = {
  'ged-pass': '나이스 · 교육청',
  'ged-score': '나이스',
  application: '지원 대학 원서접수',
  resident: '정부24',
  'ged-substitute': '지원 대학 양식',
};

// '주민등록초본 (요구하는 대학만)' → 제목 '주민등록초본', 설명에 '요구하는 대학만'
function splitLabel(item) {
  const m = item.label.match(/^(.*?)\s*\((.*)\)\s*$/);
  const title = m ? m[1] : item.label;
  const paren = m ? m[2] : null;
  const issuer = ISSUER[item.id];
  let sub;
  if (issuer && paren && item.id === 'resident') sub = `${issuer} · ${paren}`;
  else sub = issuer || paren || '전형별 확인';
  return { title, sub };
}

export default function SyDocuments({ goTo, goBack, params = {} }) {
  const { univId, univ: univName, admissionName } = params;

  const detail = useMemo(() => {
    if (univId) return getUniversityDetail(univId);
    if (univName) return getUniversityDetailByName(univName);
    return null;
  }, [univId, univName]);

  const adm = useMemo(() => {
    if (!detail) return null;
    const rows = detail.rows || [];
    if (admissionName) {
      const hit = rows.find((r) => r.admissionName === admissionName);
      if (hit) return { ...hit, univId: detail.univ.univId };
    }
    return rows[0] ? { ...rows[0], univId: detail.univ.univId } : null;
  }, [detail, admissionName]);

  // 대학·전형 없이 들어오면 검정고시생 공통 서류만 보여준다
  const data = getDocuments(adm || {});
  const storageKey = adm && adm.univId && adm.admissionName
    ? `rebridge_docs_${adm.univId}_${adm.admissionName}`
    : 'rebridge_docs_general';

  const [checked, setChecked] = useState({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      setChecked(saved && typeof saved === 'object' ? saved : {});
    } catch { setChecked({}); }
  }, [storageKey]);

  function toggle(id) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* 저장 실패는 무시 */ }
      return next;
    });
  }

  const items = data.eligible ? [...data.common, ...data.byType] : [];
  const done = items.filter((it) => checked[it.id]).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  // '모집요강에서 추가 서류 확인' — 모집요강 원본 PDF(수시 먼저) → 없으면 입학처 → 없으면 모집요강 보는 법
  const univ = detail?.univ;
  const guide = univ
    ? (GUIDELINES[univ.univId] || []).slice().sort((a, b) => (a.phase === '수시' ? 0 : 1) - (b.phase === '수시' ? 0 : 1))[0]
    : null;
  function openGuideline() {
    const url = guide?.url || univ?.admissionOfficeUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else goTo('guide', { topic: 'guideline' });
  }

  return (
    <div className="sy-screen sy-d sy-d-greenback">
      <SyTop title="제출서류" onBack={goBack} />

      <div className="sy-d-dochero">
        <div>
          <p className="sy-d-dochero-t">{done} / {items.length} 준비했어요</p>
          <p className="sy-d-dochero-s">대학마다 추가 서류가 있을 수 있어요.</p>
        </div>
        <span className="sy-d-pct">{pct}%</span>
      </div>

      <div className="sy-d-sechead sy-d-sechead-docs">
        <h3 className="sy-d-sec">기본 서류</h3>
        {/* 발급 방법 — '합격증명서와 성적증명서, 달라요?'(두 서류의 차이와 발급 방법) 안내로 */}
        <button type="button" className="sy-d-link" onClick={() => goTo('guide', { topic: 'docs' })}>발급 방법</button>
      </div>

      <div className="sy-d-card sy-d-doclist sy-d-shadow">
        {!data.eligible && (
          <p className="sy-d-docnote">{data.notes[0]}</p>
        )}
        {items.map((it, i) => {
          const on = !!checked[it.id];
          const { title, sub } = splitLabel(it);
          return (
            <div key={it.id}>
              <button type="button" className="sy-d-doc" role="checkbox" aria-checked={on} onClick={() => toggle(it.id)}>
                <span className={`sy-d-box${on ? ' on' : ''}`}><Check size={16} strokeWidth={2.4} /></span>
                <span className="sy-d-doc-text">
                  <span className="sy-d-doc-t">{title}</span>
                  <span className="sy-d-doc-s">{sub}</span>
                </span>
                <span className={`sy-d-state${on ? ' on' : ''}`}>{on ? '준비됨' : '준비 전'}</span>
              </button>
              {i === 0 && items.length > 1 && <hr className="sy-d-div sy-d-div-doc" />}
            </div>
          );
        })}
      </div>

      <button type="button" className="sy-btn sy-d-docbtn" onClick={openGuideline}>
        모집요강에서 추가 서류 확인
      </button>
    </div>
  );
}
