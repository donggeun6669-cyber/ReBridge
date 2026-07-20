import { useMemo, useState } from 'react';
import {
  ArrowLeft, Search, ChevronRight, Sparkles, ExternalLink, MessageCircleHeart, Compass,
} from 'lucide-react';
import { searchFaq, FAQ_TOPICS } from '../lib/faq.js';
import { buildRoadmap } from '../lib/roadmap.js';
import { loadProfile } from '../lib/persona.js';

// 멘토 Q&A 접수용 구글폼 URL. 폼을 만들면 여기에 주소를 넣으면 바로 활성화돼요.
// (비어 있으면 "준비 중" 안내가 뜨고, 검색형 FAQ는 그대로 동작합니다.)
const MENTOR_FORM_URL = '';

export default function HelpScreen({ goTo = () => {}, goBack = () => {} }) {
  const [query, setQuery] = useState('');
  const [mentorNote, setMentorNote] = useState(false);

  const profile = useMemo(loadProfile, []);
  const nudge = useMemo(() => {
    try {
      return profile ? buildRoadmap(profile).nextStage : null;
    } catch {
      return null;
    }
  }, [profile]);

  const isSearching = query.trim() !== '';
  const results = useMemo(() => (isSearching ? searchFaq(query) : FAQ_TOPICS), [query, isSearching]);

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
        궁금한 걸 검색해보고, 답이 없으면 진짜 사람(멘토)에게 바로 물어볼 수 있어요.
      </div>

      {/* ③ 능동 안내 — 점수/일정 기반 '지금 할 일' */}
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

      {/* ① 검색형 FAQ */}
      <div className="search-bar">
        <Search size={18} color="var(--text-sub)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="무엇이 궁금해요? (예: 수능 안 봐도 돼요?)"
          aria-label="질문 검색"
        />
      </div>

      <div className="help-results">
        {results.length > 0 ? (
          results.map((t) => (
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
          ))
        ) : (
          <p className="empty-line">딱 맞는 답을 못 찾았어요. 아래에서 멘토에게 직접 물어보세요.</p>
        )}
      </div>

      {/* ② 사람 멘토 비동기 Q&A */}
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
        <Sparkles size={12} /> 검색 결과는 <b>사람이 미리 정리한 안내</b>예요(AI가 지어내지 않아요).
        정확한 내용은 모집요강에서 확인해요.
      </p>
    </div>
  );
}
