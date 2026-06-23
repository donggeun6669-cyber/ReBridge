import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Search, BookOpen, ShieldQuestion, ChevronRight, Sparkles,
} from 'lucide-react';
import { getGlossary } from '../data/glossary.js';
import { getActiveTrack } from '../lib/persona.js';

// 용어 풀이 사전 화면 — 트랙(입시/취업)에 맞는 용어를 검색하며 펼쳐 본다.
// 입시(univ/study)는 더 깊은 FAQ(GuideScreen)로도 이어진다.
export default function GlossaryScreen({ track: trackProp, params = {}, goTo = () => {}, goBack = () => {} }) {
  const track = trackProp || params.track || getActiveTrack() || 'univ';
  const glossary = getGlossary(track);
  const isAdmission = glossary.key === 'admission';

  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const termRef = useRef(null);

  // 검색에서 직접 진입 시 해당 용어 자동 오픈 + 스크롤
  useEffect(() => {
    if (params.termId) {
      setOpenId(params.termId);
      setTimeout(() => {
        termRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [params.termId]);

  const terms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return glossary.terms;
    return glossary.terms.filter((t) => {
      const hay = `${t.term} ${t.short} ${t.detail || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, glossary]);

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">용어 풀이</span>
      </header>

      <section className="guide-hero">
        <span className="guide-hero-icon ico-brand">
          <BookOpen size={28} />
        </span>
        <h1>{glossary.title}</h1>
        <p>{glossary.subtitle}</p>
      </section>

      <div className="search-bar">
        <Search size={18} color="var(--text-sub)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="궁금한 용어를 검색해요 (예: 수능최저 / 내일배움카드)"
          aria-label="용어 검색"
        />
      </div>

      <div className="gloss-list">
        {terms.length === 0 ? (
          <p className="empty-line">검색에 맞는 용어가 없어요. 다른 단어로 찾아보세요.</p>
        ) : (
          terms.map((t) => {
            const open = openId === t.term;
            const isTarget = params.termId === t.term;
            return (
              <button
                key={t.term}
                ref={isTarget ? termRef : null}
                className={`gloss-item${open ? ' is-open' : ''}${isTarget ? ' highlight' : ''}`}
                onClick={() => setOpenId(open ? null : t.term)}
              >
                <div className="gloss-item-head">
                  <span className="gloss-term">{t.term}</span>
                  {t.check && (
                    <span className="gloss-check-tag">
                      <ShieldQuestion size={12} /> 확인 필요
                    </span>
                  )}
                  <ChevronRight
                    size={16}
                    className="gloss-arrow"
                    style={{ transform: open ? 'rotate(90deg)' : 'none' }}
                  />
                </div>
                <p className="gloss-short">{t.short}</p>
                {open && t.detail && <p className="gloss-detail">{t.detail}</p>}
                {open && t.check && (
                  <p className="gloss-detail gloss-detail-warn">
                    학교 밖 청소년·검정고시생에게 적용이 다를 수 있어요. 정확한 건
                    {glossary.key === 'career' ? ' 고용센터(1350)나 관련 기관에' : ' 모집요강·교육청에'} 직접 확인하세요.
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* 입시 트랙은 더 깊은 FAQ(전형 설명 등)로 연결 */}
      {isAdmission && (
        <button className="btn-outline" style={{ marginTop: 16 }} onClick={() => goTo('guide', { topic: 'types' })}>
          전형·서류 자세히 보기 (자주 하는 질문)
        </button>
      )}

      <p className="note" style={{ marginTop: 18 }}>
        <Sparkles size={12} /> 사람이 직접 정리한 쉬운 설명이에요(AI가 지어내지 않아요).
        제도·기준은 바뀔 수 있으니 중요한 건 꼭 공식 안내로 확인해요.
      </p>
    </div>
  );
}
