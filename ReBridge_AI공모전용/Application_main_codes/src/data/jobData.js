// 취업·자격증 트랙 데이터 — 데이터 미러링 없이 '안내 + 공식 연결'만.
// (정확한 자격·일정·금액은 각 공식 기관에서 확인. 앱은 길 안내자 역할.)

// ── 고용정책 카테고리 (정보탐색 상단) ──
export const JOB_CATEGORIES = [
  {
    key: 'prep', icon: 'Briefcase', color: 'brand',
    title: '취업 준비', desc: '어떻게 시작할지 막막해요',
    links: [
      { label: '워크넷 직업·진로', url: 'https://www.work.go.kr', host: '직업정보 · 진로 상담' },
      { label: '온라인청년센터', url: 'https://www.youthcenter.go.kr', host: '청년 정책 한눈에' },
    ],
  },
  {
    key: 'find', icon: 'Search', color: 'green',
    title: '일자리 찾기', desc: '내게 맞는 일자리를 찾고 싶어요',
    links: [
      { label: '워크넷 채용정보', url: 'https://www.work.go.kr', host: '전국 채용 공고' },
      { label: '고용24', url: 'https://www.work24.go.kr', host: '정부 취업지원 통합' },
    ],
  },
  {
    key: 'train', icon: 'GraduationCap', color: 'gold',
    title: '교육·훈련', desc: '기술 배우거나 자격증을 따고 싶어요',
    links: [
      { label: '내일배움카드(고용24)', url: 'https://www.work24.go.kr', host: '훈련비 국비 지원' },
      { label: '한국폴리텍대학', url: 'https://www.kopo.ac.kr', host: '기술 학위·비학위 과정' },
    ],
  },
  {
    key: 'cert', icon: 'BadgeCheck', color: 'brand',
    title: '자격증', desc: '국가기술자격에 도전하고 싶어요',
    links: [
      { label: '큐넷(Q-Net)', url: 'https://www.q-net.or.kr', host: '종목 · 일정 · 접수' },
    ],
  },
  {
    key: 'money', icon: 'Coins', color: 'green',
    title: '지원금·수당', desc: '준비하는 동안 지원받고 싶어요',
    links: [
      { label: '국민취업지원제도', url: 'https://www.work24.go.kr', host: '구직촉진수당' },
      { label: '온라인청년센터', url: 'https://www.youthcenter.go.kr', host: '청년 지원 정책' },
    ],
  },
  {
    key: 'mind', icon: 'HeartHandshake', color: 'coral',
    title: '마음 건강', desc: '지치고 막막할 때 도움받고 싶어요',
    links: [
      { label: '청소년상담 1388', tel: '1388', host: '24시간 무료 상담' },
    ],
  },
];

// ── 청년 지원 프로그램 리스트 (정보탐색 하단) ──
export const JOB_PROGRAMS = [
  { title: '청년도전지원사업', tags: ['청년', '지원금'], badge: '추천',
    desc: '구직 자신감을 잃은 청년에게 맞춤 프로그램과 참여수당을 줘요.',
    url: 'https://www.youthcenter.go.kr' },
  { title: '국민취업지원제도', tags: ['지원금', '취업'],
    desc: '구직활동을 하면 구직촉진수당과 취업지원 서비스를 받아요.',
    url: 'https://www.work24.go.kr' },
  { title: '내일배움카드', tags: ['훈련'],
    desc: '직업훈련 비용을 국비로 지원받아 기술을 배워요. (일부 자부담 있을 수 있어요)',
    url: 'https://www.work24.go.kr' },
  { title: '직업심리검사', tags: ['진단', '무료'],
    desc: '내 흥미·적성을 검사해 맞는 직업 분야를 추천받아요. 워크넷에서 무료예요.',
    url: 'https://www.work.go.kr' },
  { title: '청년일자리도약장려금', tags: ['취업'],
    desc: '취업이 어려운 청년을 채용한 기업을 지원해 일자리를 늘려요.',
    url: 'https://www.work24.go.kr' },
  { title: '국가기술자격 기능사', tags: ['자격증'],
    desc: '학력 제한 없이 도전할 수 있는 기능사로 취업의 첫 무기를 만들어요.',
    url: 'https://www.q-net.or.kr' },
];

// ── 취업 프로필 질문 ──
export const JOB_QUESTIONS = [
  {
    key: 'interest', title: '관심 있는 분야가 있어요?',
    hint: '정하지 않았어도 괜찮아요.',
    options: ['IT·디자인', '서비스·요식', '제조·기술', '사무·행정', '아직 몰라요'],
  },
  {
    key: 'startWith', title: '어떻게 시작하고 싶어요?',
    hint: '길에 따라 안내가 달라져요.',
    options: ['바로 취업할래요', '자격증 먼저', '직업훈련 먼저', '고민 중이에요'],
  },
  {
    key: 'hasCert', title: '가진 자격증이 있어요?',
    hint: '없어도 괜찮아요. 기능사부터 시작할 수 있어요.',
    options: ['있어요', '없어요'],
  },
  {
    key: 'workType', title: '어떤 형태로 일하고 싶어요?',
    hint: '나중에 바꿀 수 있어요.',
    options: ['정규직', '아르바이트·단기', '상관없어요'],
  },
];

// ── 준비 로드맵 단계 ──
export const JOB_ROADMAP = [
  { id: 'explore', icon: 'Compass', title: '내 관심·적성 알아보기',
    todo: '직업심리검사로 어떤 일이 맞는지 먼저 파악해요.',
    cta: { label: '취업 유형 알아보기', screen: 'job-questions' } },
  { id: 'skill', icon: 'GraduationCap', title: '역량 쌓기 (자격증·훈련)',
    todo: '내일배움카드로 훈련받거나 기능사 자격에 도전해요.',
    cta: { label: '교육·훈련 보기', screen: 'job-explore' } },
  { id: 'find', icon: 'Search', title: '일자리 찾기',
    todo: '워크넷·고용24에서 내게 맞는 채용을 찾아요.',
    cta: { label: '일자리 정보 보기', screen: 'job-explore' } },
  { id: 'apply', icon: 'FileText', title: '지원·면접 준비',
    todo: '이력서를 정리하고 면접에서 할 말을 미리 연습해요.', cta: null },
  { id: 'work', icon: 'Sparkles', title: '취업·적응',
    todo: '근로계약서를 꼭 확인하고, 힘들면 1388에 도움을 청해요.', cta: null },
];
