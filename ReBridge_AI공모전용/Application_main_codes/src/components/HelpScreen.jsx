import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Search, ChevronRight, Sparkles, ExternalLink, MessageCircleHeart, Compass,
  ShieldQuestion, X, BookOpen,
} from 'lucide-react';
import { searchFaq, FAQ_TOPICS } from '../lib/faq.js';
import { buildRoadmap } from '../lib/roadmap.js';
import { loadProfile, getActiveTrack, V1_UNIV_ONLY } from '../lib/persona.js';
import { getGlossary } from '../data/glossary.js';

// 멘토 Q&A 접수용 구글폼 URL. 폼을 만들면 여기에 주소를 넣으면 바로 활성화돼요.
// (비어 있으면 "준비 중" 안내가 뜨고, 검색형 FAQ는 그대로 동작합니다.)
const MENTOR_FORM_URL = '';

// 담임에게 물어보기 — 2026-09-17 동근님: '입시 용어'(용어 풀이 화면)와 Q&A를 한 화면으로 합쳤다.
//   검색창 하나로 질문과 용어를 같이 찾는다.
//   ① 자주 묻는 질문 → 누르면 자세한 안내(GuideScreen)
//   ② 입시 용어     → 그 자리에서 펼쳐 읽는다
//   ③ 답이 없으면 멘토에게
// 예전 'glossary' 링크(검색 결과·로드맵의 용어)는 termId로 들어와 그 용어를 펼친다.
export default function HelpScreen({ goTo = () => {}, goBack = () => {}, termId = null }) {
  const [query, setQuery] = useState('');
  const [mentorNote, setMentorNote] = useState(false);
  const [openTerm, setOpenTerm] = useState(termId);
  const termRef = useRef(null);

  const profile = useMemo(loadProfile, []);
  const nudge = useMemo(() => {
    try {
      return profile ? buildRoadmap(profile).nextStage : null;
    } catch {
      return null;
    }
  }, [profile]);

  // v1은 대입 용어만. (v2 트랙에서는 그 트랙의 용어집)
  const glossary = useMemo(
    () => getGlossary(V1_UNIV_ONLY ? 'univ' : (getActiveTrack() || 'univ')),
    []
  );

  useEffect(() => {
    if (!termId) return;
    setOpenTerm(termId);
    const t = setTimeout(() => termRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    return () => clearTimeout(t);
  }, [termId]);

  const q = query.trim();
  const faqs = useMemo(() => (q ? searchFaq(q) : FAQ_TOPICS), [q]);
  const terms = useMemo(() => {
    if (!q) return glossary.terms;
    const lq = q.toLowerCase();
    return glossary.terms.filter((t) => `${t.term} ${t.short} ${t.detail || ''}`.toLowerCase().includes(lq));
  }, [q, glossary]);
  const nothing = q && faqs.length === 0 && terms.length === 0;

  function askMentor() {
    if (MENTOR_FORM_URL) {
      window.open(MENTOR_FORM_URL, '_blank', 'noopener,noreferrer');
    } else {
      setMentorNote(true);
    }
  }

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">담임에게 물어보기</span>
      </header>

      <div className="intro-line">막히는 거, 같이 풀어요</div>
      <div className="intro-sub">
        궁금한 질문이나 모르는 입시 용어를 검색해 보세요. 답이 없으면 멘토에게 바로 물어볼 수 있어요.
      </div>

      {/* 능동 안내 — 점수/일정 기반 '지금 할 일' */}
      {nudge && (
        <button className="help-nudge" onClick={() => goTo('roadmap')}>
          <span className="help-nudge-ico"><Compass size={18} /></span>
          <span className="help-nudge-body">
            <span className="help-nudge-kicker">지금 너에게</span>
            <span className="help-nudge-title">{nudge.title}</span>
            <span className="help-nudge-todo">{nudge.todo}</span>
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      {/* 검정고시 안내(일정·과목·합격 기준) — 홈 검색을 없애며 입구가 사라져 여기로 옮겼다(2026-09-17) */}
      <button className="help-faq-card help-ged-card" onClick={() => goTo('ged-guide')}>
        <span className="help-ged-ico"><BookOpen size={18} /></span>
        <span className="help-faq-body">
          <span className="help-faq-title">검정고시 안내</span>
          <span className="help-faq-desc">시험 일정 · 과목 · 합격 기준 · 응시 자격</span>
        </span>
        <ChevronRight size={18} className="help-arrow" />
      </button>

      <div className="search-bar">
        <Search size={18} color="var(--text-sub)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="질문이나 용어 검색 (예: 수능 안 봐도 돼요? / 비교내신)"
          aria-label="질문·용어 검색"
        />
        {query && (
          <button className="icon-btn" aria-label="지우기" onClick={() => setQuery('')} style={{ width: 28, height: 28 }}>
            <X size={15} />
          </button>
        )}
      </div>

      {nothing && (
        <p className="empty-line">딱 맞는 답을 못 찾았어요. 아래에서 멘토에게 직접 물어보세요.</p>
      )}

      {/* ① 자주 묻는 질문 */}
      {faqs.length > 0 && (
        <>
          <p className="help-sec-title">자주 묻는 질문 <span>{faqs.length}</span></p>
          <div className="help-results">
            {faqs.map((t) => (
              <button
                key={t.topic}
                className="help-faq-card"
                onClick={() => goTo('guide', { topic: t.topic })}
              >
                <span className="help-faq-body">
                  <span className="help-faq-title">{t.title}</span>
                  <span className="help-faq-desc">{t.desc}</span>
                </span>
                <ChevronRight size={18} className="help-arrow" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* ② 입시 용어 — 그 자리에서 펼친다 */}
      {terms.length > 0 && (
        <>
          <p className="help-sec-title">{glossary.key === 'career' ? '진로·취업 용어' : '입시 용어'} <span>{terms.length}</span></p>
          <div className="gloss-list">
            {terms.map((t) => {
              const open = openTerm === t.term;
              const isTarget = termId === t.term;
              return (
                <button
                  key={t.term}
                  ref={isTarget ? termRef : null}
                  className={`gloss-item${open ? ' is-open' : ''}${isTarget ? ' highlight' : ''}`}
                  onClick={() => setOpenTerm(open ? null : t.term)}
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
                  {/* 2026-09 서연님: short와 detail을 두 덩어리로 보여주면 같은 설명이
                      두 번 시작하는 것처럼 읽혔다. 펼치면 한 문단으로 잇는다. */}
                  <p className="gloss-short">
                    {open && t.detail ? `${t.short} ${t.detail}` : t.short}
                  </p>
                  {open && t.check && (
                    <p className="gloss-detail-warn">
                      학교 밖 청소년·검정고시생에게 적용이 다를 수 있어요. 정확한 건
                      {glossary.key === 'career' ? ' 고용센터(1350)나 관련 기관에' : ' 모집요강·교육청에'} 직접 확인하세요.
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ③ 사람 멘토 비동기 Q&A */}
      <div className="mentor-card">
        <span className="mentor-ico"><MessageCircleHeart size={20} /></span>
        <div className="mentor-body">
          <span className="mentor-title">원하는 답이 없나요?</span>
          <p className="mentor-desc">
            검정고시로 대학 간 <b>선배·멘토</b>가 직접 답해드려요.
            <br />
            <b>모르면 지어내지 않고, 진짜 사람에게 연결</b>해드릴게요.
          </p>
          <button className="mentor-cta" onClick={askMentor}>
            멘토에게 직접 물어보기 <ExternalLink size={15} />
          </button>
          {mentorNote && (
            <p className="mentor-note">
              멘토 연결 창구를 준비하고 있어요. 곧 여기서 바로 질문할 수 있게 열릴 거예요!
            </p>
          )}
        </div>
      </div>

      <p className="note">
        <Sparkles size={12} /> 질문과 용어 설명은 <b>사람이 미리 정리한 안내</b>예요(AI가 지어내지 않아요).
        제도·기준은 바뀔 수 있으니 중요한 건 모집요강·공식 안내로 확인해요.
      </p>
    </div>
  );
}
