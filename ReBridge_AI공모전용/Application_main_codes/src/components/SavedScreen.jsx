import { useState } from 'react';
import { ArrowLeft, ChevronRight, Bookmark, X, Search } from 'lucide-react';
import { getBookmarks, removeBookmark } from '../lib/bookmarks.js';
import { getUniversityDetail } from '../lib/analysis.js';

function shortName(name) {
  const base = name.replace(/대학교$|대학$|학교$/, '');
  return base.slice(0, 2) || name.slice(0, 2);
}

export default function SavedScreen({ goTo = () => {}, goBack = () => {} }) {
  // 북마크 univId → 대학 상세. 데이터에 없는 id는 거른다. 최신 추가가 위로.
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
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">관심 대학</span>
      </header>

      {items.length === 0 ? (
        <div className="placeholder">
          <span className="saved-empty-ico">
            <Bookmark size={30} />
          </span>
          <h2>아직 담은 대학이 없어요</h2>
          <p>대학 상세 화면의 북마크 버튼을 누르면 여기에 모여요.</p>
          <button className="btn-outline" onClick={() => goTo('univ-explore')}>
            <Search size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
            대학 둘러보기
          </button>
        </div>
      ) : (
        <>
          <p className="explore-count" style={{ margin: '4px 2px 10px' }}>
            <b>{items.length}</b>개 담음
          </p>
          <div className="uni-list">
            {items.map((it) => (
              <button
                key={it.id}
                className="uni-card"
                onClick={() => goTo('detail', { univ: it.univ.name, univId: it.id })}
              >
                <span className="uni-logo uni-logo-ok">{shortName(it.univ.name)}</span>
                <span className="uni-body">
                  <span className="uni-name-row">
                    <span className="uni-name">{it.univ.name}</span>
                  </span>
                  <span className="uni-sub">
                    {it.univ.region}
                    {it.univ.establishment ? ` · ${it.univ.establishment}` : ''}
                    {it.univ.kind === '전문대학' ? ' · 전문대학' : ''}
                    {it.eligibleCount > 0 ? ` · 검정고시 ${it.eligibleCount}전형` : ''}
                  </span>
                </span>
                <span
                  className="icon-btn saved-remove"
                  role="button"
                  aria-label="관심 대학에서 빼기"
                  onClick={(e) => handleRemove(e, it.id)}
                >
                  <X size={16} />
                </span>
                <ChevronRight size={18} className="uni-arrow" />
              </button>
            ))}
          </div>
        </>
      )}

      <p className="note">관심 대학은 이 기기에만 저장돼요.</p>
    </div>
  );
}
