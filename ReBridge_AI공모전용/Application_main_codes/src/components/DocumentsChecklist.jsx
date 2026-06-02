import { useEffect, useState } from 'react';
import { FileCheck2, Info, CheckCircle2, Circle, ShieldQuestion } from 'lucide-react';
import { getDocuments } from '../lib/documents.js';
import '../styles.documents.css';

// 임베드용 제출서류 체크리스트
// props: { adm }  (admissions 행 1개)
export default function DocumentsChecklist({ adm }) {
  const data = getDocuments(adm || {});
  const storageKey =
    adm && adm.univId && adm.admissionName
      ? `rebridge_docs_${adm.univId}_${adm.admissionName}`
      : null;

  const [checked, setChecked] = useState({});

  // localStorage 복원(선택 기능, 실패해도 무시)
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved === 'object') setChecked(saved);
    } catch {
      /* noop */
    }
  }, [storageKey]);

  function toggle(id) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* noop */
        }
      }
      return next;
    });
  }

  // 지원 불가 전형
  if (!data.eligible) {
    return (
      <div className="doc-card">
        <div className="doc-head">
          <FileCheck2 size={18} />
          <span className="doc-title">제출서류</span>
        </div>
        <div className="doc-note doc-note-warn">
          <Info size={14} /> {data.notes[0]}
        </div>
      </div>
    );
  }

  const allItems = [
    ...data.common.map((d) => ({ ...d, group: '공통' })),
    ...data.byType.map((d) => ({ ...d, group: '전형' })),
  ];

  return (
    <div className="doc-card">
      <div className="doc-head">
        <FileCheck2 size={18} />
        <span className="doc-title">검정고시생 제출서류</span>
      </div>

      <ul className="doc-list">
        {allItems.map((item) => {
          const on = !!checked[item.id];
          return (
            <li
              key={item.id}
              className={`doc-item${on ? ' is-checked' : ''}`}
              onClick={() => toggle(item.id)}
              role="checkbox"
              aria-checked={on}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(item.id);
                }
              }}
            >
              <span className="doc-check">
                {on ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </span>
              <span className="doc-label">
                {item.label}
                {item.required ? (
                  <span className="doc-tag doc-tag-req">필수</span>
                ) : (
                  <span className="doc-tag doc-tag-opt">해당 시</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {data.notes.length > 0 && (
        <div className="doc-notes">
          {data.notes.map((n, i) => (
            <div className="doc-note" key={i}>
              <Info size={14} /> {n}
            </div>
          ))}
        </div>
      )}

      {data.confidence === 'check' && (
        <div className="doc-badge">
          <ShieldQuestion size={14} />
          학교별 상세 서류는 모집요강에서 꼭 확인하세요
        </div>
      )}
    </div>
  );
}
