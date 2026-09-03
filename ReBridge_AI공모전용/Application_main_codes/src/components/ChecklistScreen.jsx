import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Circle,
  ExternalLink, ChevronRight, Info, FileText,
} from 'lucide-react';
import { getActiveTrack } from '../lib/persona.js';
import { buildChecklist, CHECKLIST_META } from '../data/checklists.js';
import { currentYear } from '../data/meta.js';

const STORAGE_KEY   = 'rebridge_profile';
const CHECK_KEY     = 'rebridge_checklist';
const CURRENT_YEAR  = currentYear();

/* ─────────────────────────────────────────────
   화면 컴포넌트 — 트랙(학습/입시/취업)별로 다른 목록
───────────────────────────────────────────── */
export default function ChecklistScreen({ goTo = () => {}, goBack = () => {} }) {
  const profile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
  }, []);

  const track = useMemo(() => getActiveTrack(), []);
  const meta = CHECKLIST_META[track] || CHECKLIST_META.null;
  const items = useMemo(() => buildChecklist(track, profile), [track, profile]);

  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHECK_KEY)) || {}; } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(checked)); } catch { /* 무시 */ }
  }, [checked]);

  function toggle(id) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const doneCount = items.filter((i) => checked[i.id]).length;

  // 카테고리 그룹핑
  const categories = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    });
    return map;
  }, [items]);

  const round       = profile?.examRound || '';
  const year        = profile?.examYear  || '';
  // 2회차 나이스 경고는 대입(univ/미정) 트랙에서만 의미가 있어요.
  const isCritical  = track !== 'job' && track !== 'study'
    && round === '2회차' && year === String(CURRENT_YEAR);

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">서류 체크리스트</span>
      </header>

      <div className="intro-line">{meta.title}</div>
      <div className="intro-sub">
        {meta.sub}
        {!profile && track !== 'job' && track !== 'study' && (
          <> 정보를 입력하면 내 상황에 꼭 맞는 목록을 만들어드려요.</>
        )}
      </div>

      {/* 진행 바 */}
      <div className="cl-progress-wrap">
        <div className="cl-progress-bar">
          <div
            className="cl-progress-fill"
            style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
          />
        </div>
        <span className="cl-progress-text">{doneCount} / {items.length} 완료</span>
      </div>

      {/* 2회차 경고 */}
      {isCritical && (
        <div className="cl-alert critical">
          <AlertTriangle size={16} />
          <div>
            <b>{CURRENT_YEAR}년 2회차 합격자 — 나이스 온라인 연동 불가!</b>
            <p>수시 서류를 나이스로 전송하면 안 돼요. 성적증명서 실물 원본을 등기우편으로 직접 제출해야 해요.</p>
          </div>
        </div>
      )}

      {!profile && track !== 'job' && track !== 'study' && (
        <button className="cl-goto-profile" onClick={() => goTo('profile')}>
          <FileText size={16} />
          내 정보 입력하면 맞춤 목록을 만들어드려요
          <ChevronRight size={16} />
        </button>
      )}

      {/* 카테고리별 체크리스트 */}
      {[...categories.entries()].map(([cat, catItems]) => (
        <div className="cl-section" key={cat}>
          <div className="cl-section-label">{cat}</div>
          {catItems.map((item) => (
            <div
              key={item.id}
              className={`cl-item ${checked[item.id] ? 'done' : ''}`}
              onClick={() => toggle(item.id)}
            >
              <button
                className="cl-check"
                aria-label={checked[item.id] ? '완료 취소' : '완료 표시'}
                onClick={(e) => { e.stopPropagation(); toggle(item.id); }}
              >
                {checked[item.id]
                  ? <CheckCircle2 size={22} className="cl-check-on" />
                  : <Circle size={22} className="cl-check-off" />}
              </button>
              <div className="cl-item-body">
                <div className="cl-item-title-row">
                  <span className="cl-item-title">{item.title}</span>
                  {item.badge && (
                    <span className={`cl-badge cl-badge-${item.badgeColor || 'brand'}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.condition && (
                  <span className="cl-condition">{item.condition}</span>
                )}
                <div className="cl-item-meta">
                  <span>발급처: {item.issuer}</span>
                  {item.days && <span>· {item.days}</span>}
                </div>
                {item.warn && (
                  <div className={`cl-warn cl-warn-${item.warnLevel || 'info'}`}>
                    {(item.warnLevel === 'critical' || item.warnLevel === 'caution') && (
                      <AlertTriangle size={12} />
                    )}
                    {item.warnLevel === 'info' && <Info size={12} />}
                    <span>{item.warn}</span>
                  </div>
                )}
                <div className="cl-item-actions">
                  {item.url && (
                    <a
                      className="cl-link"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      바로가기 <ExternalLink size={12} />
                    </a>
                  )}
                  {item.guideKey === 'forms' && (
                    <button
                      className="cl-link"
                      onClick={(e) => { e.stopPropagation(); goTo('forms-guide'); }}
                    >
                      대체서식 안내 <ChevronRight size={12} />
                    </button>
                  )}
                  {item.guideKey === 'glossary-job' && (
                    <button
                      className="cl-link"
                      onClick={(e) => { e.stopPropagation(); goTo('glossary', { track: 'job' }); }}
                    >
                      취업 용어 보기 <ChevronRight size={12} />
                    </button>
                  )}
                  {item.guideKey === 'glossary-study' && (
                    <button
                      className="cl-link"
                      onClick={(e) => { e.stopPropagation(); goTo('glossary', { track: 'study' }); }}
                    >
                      용어 보기 <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="cl-footer">
        <p className="note">
          <Info size={12} /> {track === 'job'
            ? '회사·직무마다 요구 서류가 달라요. 지원 공고를 꼭 확인하세요.'
            : track === 'study'
            ? '준비물·접수 방법은 시·도교육청 공고를 꼭 확인하세요.'
            : '서류 요구사항은 대학·전형마다 달라요. 지원 전 반드시 해당 대학 모집요강 원문을 확인하세요.'}
        </p>
        {track === 'job' ? (
          <button className="btn-outline" onClick={() => goTo('glossary', { track: 'job' })}>
            진로·취업 용어 풀이 보기
          </button>
        ) : track === 'study' ? (
          <button className="btn-outline" onClick={() => goTo('glossary', { track: 'study' })}>
            입시 용어 풀이 보기
          </button>
        ) : (
          <button className="btn-outline" onClick={() => goTo('guide', { topic: 'docs' })}>
            합격증명서 vs 성적증명서 차이 알아보기
          </button>
        )}
      </div>
    </div>
  );
}
