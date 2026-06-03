// 검색형 FAQ — 미리 사람이 정리한 가이드 주제를 키워드로 매칭(생성 없음 → 환각 0).
// topic은 GuideScreen의 가이드 키와 동일. 검색 결과 카드를 누르면 그 가이드로 이동.

export const FAQ_TOPICS = [
  { topic: 'types', title: '전형이 뭐예요?', desc: '학종·교과·논술을 한 번에 정리했어요',
    keywords: ['전형', '종류', '학생부종합', '학종', '교과', '논술', '수시', '뭐가 있어', '무슨 전형'] },
  { topic: 'susi', title: '검정고시도 수시 돼요?', desc: '어떤 전형이 가능한지 알려드려요',
    keywords: ['검정고시', '수시', '지원', '가능', '자격', '돼', '되나', '넣을 수', '학교 밖'] },
  { topic: 'compare', title: '비교내신이 뭐예요?', desc: '검정고시 점수가 내신처럼 바뀌는 법',
    keywords: ['비교내신', '내신', '환산', '등급', '점수 반영', '환산표'] },
  { topic: 'csat', title: '수능 최저가 뭐예요?', desc: '수시에 붙어도 필요한 수능 조건이에요',
    keywords: ['수능', '최저', '수능최저', '최저학력', '조건', '충족', '등급 맞춰'] },
  { topic: 'susiJeongsi', title: '수시랑 정시, 뭐가 달라요?', desc: '두 가지 길의 차이를 쉽게 정리했어요',
    keywords: ['수시', '정시', '차이', '달라', '뭐가 다른', '가나다', '군'] },
  { topic: 'count', title: '수시는 몇 개까지 쓸 수 있어요?', desc: '지원 가능한 횟수를 알려드려요',
    keywords: ['수시', '몇 개', '6장', '여섯', '횟수', '몇 군데', '몇 곳', '납치'] },
  { topic: 'apply', title: '원서는 언제, 어떻게 넣어요?', desc: '접수 시기와 방법을 알려드려요',
    keywords: ['원서', '접수', '언제', '어떻게', '일정', '유웨이', '진학사', '넣어', '신청'] },
  { topic: 'interview', title: '면접에서는 뭘 물어봐요?', desc: '면접이 어떻게 진행되는지 미리 봐요',
    keywords: ['면접', '질문', '뭘 물어', '준비', '구술', '말하기'] },
  { topic: 'grade', title: '수능 등급은 어떻게 매겨요?', desc: '등급·백분위가 뭔지 쉽게 설명해요',
    keywords: ['수능', '등급', '백분위', '표준점수', '어떻게 매겨', '등급컷'] },
  { topic: 'guideline', title: '모집요강은 어떻게 봐요?', desc: '어디부터 볼지 알려드려요',
    keywords: ['모집요강', '요강', '어디서', '보는 법', '확인', '입학처'] },
];

// 자유 질문 → 가장 맞는 FAQ 주제 정렬(키워드/부분일치 점수). 생성 없음.
export function searchFaq(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  // 1글자 토큰(안·돼·도 등 조사·잡음)은 제외해 매칭 정확도를 높임.
  const terms = q.split(/\s+/).filter((t) => t.length >= 2);
  if (terms.length === 0) return [];
  return FAQ_TOPICS.map((t) => {
    const hay = `${t.title} ${t.desc} ${t.keywords.join(' ')}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (hay.includes(term)) score += 2;
    }
    if (t.keywords.some((k) => q.includes(k.toLowerCase()))) score += 3;
    return { ...t, score };
  })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score);
}
