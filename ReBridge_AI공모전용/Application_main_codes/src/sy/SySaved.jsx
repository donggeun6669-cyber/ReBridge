// 관심 대학 — 시안: 관심 대학 · 빈 화면.png (담은 대학이 있을 때 시안은 없음 → 빈 화면 카드
// 스타일 + 기존 SavedScreen의 목록 구조로 최소 구현, 보고 항목에 남김)
import { useState } from 'react';
import { Heart, X, ChevronRight } from 'lucide-react';
import { getBookmarks, removeBookmark } from '../lib/bookmarks.js';
import { getUniversityDetail } from '../lib/analysis.js';
import SyTop from './SyTop.jsx';
import './sy-f.css';

export default function SySaved({ goTo = () => {}, goBack = () => {} }) {
  const [ids, setIds] = useState(() => getBookmarks().slice().reverse());

  const items = ids
    .map((id) => {
      const d = getUniversityDetail(id);
      return d ? { id, univ: d.univ, eligibleCount: d.eligibleCount } : null;
    })
    .filter(Boolean);

  function handleRemove(e, id) {
    e.stopPropagation();
    removeBookmark(id);
    setIds((prev) => prev.filter((x) => x !== id));
  }

  return (
    <div className="sy-screen sy-f-screen">
      <SyTop title="관심 대학" onBack={goBack} />

      {items.length === 0 ? (
        <div className="sy-f-sv-empty">
          <span className="sy-f-sv-empty-ico"><Heart size={34} /></span>
          <h2 className="sy-f-sv-empty-title">아직 담은 대학이 없어요</h2>
          <p className="sy-f-sv-empty-sub">비교하고 싶은 대학을 관심 목록에 담아봐요.</p>
          <button type="button" className="sy-btn sy-f-sv-empty-btn" onClick={() => goTo('univ-explore')}>
            대학 담으러 가기
          </button>
        </div>
      ) : (
        <>
          <p className="sy-f-sv-count"><b>{items.length}</b>개 담음</p>
          <div className="sy-f-sv-list">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                className="sy-f-sv-card"
                onClick={() => goTo('detail', { univ: it.univ.name, univId: it.id })}
              >
                <span className="sy-f-sv-body">
                  <span className="sy-f-sv-name">{it.univ.name}</span>
                  <span className="sy-f-sv-sub">
                    {it.univ.region}
                    {it.univ.establishment ? ` · ${it.univ.establishment}` : ''}
                    {it.univ.kind === '전문대학' ? ' · 전문대학' : ''}
                    {it.eligibleCount > 0 ? ` · 검정고시 ${it.eligibleCount}전형` : ''}
                  </span>
                </span>
                <span
                  className="sy-f-sv-remove"
                  role="button"
                  aria-label="관심 대학에서 빼기"
                  onClick={(e) => handleRemove(e, it.id)}
                >
                  <X size={16} />
                </span>
                <ChevronRight size={18} className="sy-f-sv-arrow" />
              </button>
            ))}
          </div>
          <p className="sy-f-note">관심 대학은 이 기기에만 저장돼요.</p>
        </>
      )}
    </div>
  );
}
