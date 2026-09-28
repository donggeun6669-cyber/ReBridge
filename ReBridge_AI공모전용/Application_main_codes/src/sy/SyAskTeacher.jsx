// 담임에게 물어보기 — 자주 묻는 질문 + 입시 용어(별칭 'glossary')를 한 컴포넌트로.
//   시안: 담임에게 물어보기.png (기본: 자주 묻는 질문 아코디언)
//   'glossary'(termId)로 들어오면 같은 화면이 용어 사전 목록을 보여준다(시안 없는 상태 — 최소 구현).
// 기능은 기존 lib/faq.js(searchFaq)·data/glossary.js·data/commonSupport.js를 그대로 쓴다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { searchFaq } from '../lib/faq.js';
import { getGlossary } from '../data/glossary.js';
import { COMMON_SUPPORT } from '../data/commonSupport.js';
import SyTop from './SyTop.jsx';
import './sy-f.css';

// 검색 결과(searchFaq)로 찾은 주제의 짧은 답변. src/components/GuideScreen.jsx의
// 확인된 안내문을 한 줄로 줄인 것 — 새로 지어낸 사실이 아니다.
const FAQ_ANSWERS = {
  types: '대학 입시는 크게 수시와 정시가 있어요. 학생부교과·학생부종합·논술은 보통 수시, 정시는 주로 수능 점수로 가는 길이에요.',
  susi: '검정고시생도 수시에 지원할 수 있어요. 다만 "재학 중인 학교의 추천"이 꼭 필요한 전형은 어려울 수 있어요.',
  compare: '검정고시생은 고등학교 내신 성적표가 없어서, 대학이 검정고시 점수를 "내신 등급처럼" 바꿔서 비교해요. 그게 비교내신이에요.',
  csat: '수시에 붙어도 수능에서 정해진 등급을 못 넘으면 최종 합격이 어려울 수 있어요. 이 조건이 수능 최저예요. 최저가 아예 없는 전형도 많아요.',
  susiJeongsi: '수시는 수능 전에 여러 대학에 먼저 지원하는 길이고, 정시는 수능을 본 뒤 그 점수로 지원하는 길이에요.',
  count: '4년제 일반대학은 수시 최대 6장이에요. 전문대학과 KAIST·UNIST 같은 과학기술원은 이 6장 제한에 포함되지 않아요.',
  apply: '검정고시생은 원서를 낼 때 "검정고시 합격증명서"를 제출해야 하는 경우가 많아요. 미리 준비해 두세요.',
  interview: '면접은 주로 학생부종합 전형에서 해요. 지원 동기나 제출한 서류 내용을 더 설명해 달라고 물어봐요.',
  grade: '수능 점수를 9개 등급으로 나눠요. 상위 4%가 1등급, 그다음 7%가 2등급 이런 식이에요.',
  guideline: '모집요강은 대학이 공식으로 발표한 안내문이에요. "검정고시", "동등 학력"이라는 단어부터 찾아보면 지원 가능 여부를 알 수 있어요.',
  docs: '합격증명서는 검정고시를 통과했다는 증명서이고, 성적증명서는 과목별 점수를 적은 서류예요. 대입에는 둘 다 필요한 경우가 많아요.',
  naice: '나이스(kged.go.kr)에서 신청하면 성적을 대학에 온라인으로 바로 보낼 수 있어요. 단, 2회차 합격자는 수시 기간에 막힐 수 있어요.',
  gedLimit: '검정고시 100점이어도 비교내신 환산 방식 때문에 서울 상위권 교과 전형은 합격선에 못 미칠 수 있어요.',
  essay: '논술 전형은 내신 반영이 작거나 없어서, 비교내신이 불리한 검정고시생에게 좋은 우회로가 될 수 있어요.',
};

const KKUMDRIM_SUMMARY = COMMON_SUPPORT.find((s) => s.id === 'kkumdrim-base')?.summary
  || '만 9~24세 학교 밖 청소년이면 누구나 무료로 이용할 수 있어요.';

// 시안에 그대로 있는 기본 질문 5개. 답변은 위 FAQ_ANSWERS·공통 지원 데이터에서 그대로 가져온다.
const DEFAULT_QUESTIONS = [
  { q: '검정고시생도 수시 지원이 가능한가요?', a: FAQ_ANSWERS.susi },
  { q: '비교내신이 무엇인가요?', a: FAQ_ANSWERS.compare },
  { q: '꿈드림센터는 누구나 이용할 수 있나요?', a: KKUMDRIM_SUMMARY },
  { q: '수능을 보지 않아도 대학에 갈 수 있나요?', a: '네, 갈 수 있어요. 수시 중에는 수능 최저학력기준이 없는 전형도 많아서 수능을 안 봐도 지원할 수 있어요.' },
  { q: '원서 접수 전에 무엇을 준비하나요?', a: FAQ_ANSWERS.apply },
];

export default function SyAskTeacher({ goBack = () => {}, params = {}, screen }) {
  // v1은 대입 트랙만이라 용어집도 입시(univ) 것 하나.
  const glossary = useMemo(() => getGlossary('univ'), []);
  const isGlossaryMode = screen === 'glossary';
  const termId = params?.termId || null;

  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState(isGlossaryMode ? null : 0);
  const rowRefs = useRef({});

  // 'glossary'로 들어오며 termId가 있으면 그 용어를 펼치고 스크롤한다(예전 HelpScreen과 같은 동작).
  useEffect(() => {
    if (!isGlossaryMode || !termId) return;
    const idx = glossary.terms.findIndex((t) => t.term === termId);
    if (idx < 0) return;
    setOpenIdx(idx);
    const timer = setTimeout(() => {
      rowRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlossaryMode, termId]);

  const q = query.trim();

  const faqList = useMemo(() => {
    if (!q) return DEFAULT_QUESTIONS;
    return searchFaq(q).map((f) => ({ q: f.title, a: FAQ_ANSWERS[f.topic] || f.desc }));
  }, [q]);

  const termList = useMemo(() => {
    if (!q) return glossary.terms;
    const lq = q.toLowerCase();
    return glossary.terms.filter((t) => `${t.term} ${t.short} ${t.detail || ''}`.toLowerCase().includes(lq));
  }, [q, glossary]);

  const list = isGlossaryMode ? termList : faqList;
  const nothing = !!q && list.length === 0;

  function onSearch(v) {
    setQuery(v);
    setOpenIdx(0);
  }

  return (
    <div className="sy-screen sy-f-screen">
      <SyTop title="담임에게 물어보기" onBack={goBack} />

      <h1 className="sy-f-h1">
        {isGlossaryMode ? '입시 용어를 확인해요' : '자주 묻는 질문부터 확인해요'}
      </h1>
      <p className="sy-f-sub">
        {isGlossaryMode ? '용어를 누르면 뜻이 펼쳐져요.' : '질문을 누르면 짧은 답변이 펼쳐져요.'}
      </p>

      <div className="sy-f-search">
        <Search size={18} className="sy-f-search-ico" />
        <input
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="궁금한 말을 찾아봐요"
          aria-label="질문·용어 검색"
        />
      </div>

      {nothing && <p className="sy-f-empty">찾는 내용이 없어요. 다른 말로 검색해 보세요.</p>}

      {list.length > 0 && (
        <div className="sy-f-card">
          {list.map((item, i) => {
            const open = openIdx === i;
            const title = isGlossaryMode ? item.term : item.q;
            const body = isGlossaryMode
              ? `${item.short}${item.detail ? ` ${item.detail}` : ''}`
              : item.a;
            return (
              <div
                key={title}
                className={`sy-f-row${open ? ' open' : ''}`}
                ref={(el) => { rowRefs.current[i] = el; }}
              >
                <button
                  type="button"
                  className="sy-f-row-head"
                  aria-expanded={open}
                  onClick={() => setOpenIdx(open ? null : i)}
                >
                  {!isGlossaryMode && <span className="sy-f-q-badge">Q</span>}
                  <span className="sy-f-row-title">{title}</span>
                  <ChevronDown size={18} className="sy-f-chev" />
                </button>
                {open && <p className="sy-f-row-body">{body}</p>}
              </div>
            );
          })}
        </div>
      )}

      <p className="sy-f-note">
        {isGlossaryMode
          ? '학교 밖 청소년·검정고시생에게 적용이 다를 수 있는 제도는 직접 한 번 더 확인해요.'
          : '답변은 일반적인 안내예요. 대학의 최신 모집요강을 함께 확인해요.'}
      </p>
    </div>
  );
}
