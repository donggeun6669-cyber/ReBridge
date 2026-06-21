// 취업·자격증 트랙 데이터.
// 원칙: 설명은 '앱 안에서' 끝까지 해주고, 진짜 '신청/접수'만 공식 사이트로 보낸다.
// (정확한 자격·일정·금액은 해마다·지역마다 달라질 수 있어, 상세 화면에서 '확인 안내'를 함께 둔다.)

// ── 고용정책 카테고리 (정보탐색 상단 — 공식 포털 빠른 연결) ──
export const JOB_CATEGORIES = [
  {
    key: 'find', icon: 'Search', color: 'green',
    title: '일자리 찾기', desc: '내게 맞는 채용을 찾고 싶어요',
    links: [
      { label: '워크넷 채용정보', url: 'https://www.work.go.kr', host: '전국 채용 공고 검색' },
      { label: '고용24', url: 'https://www.work24.go.kr', host: '정부 취업지원 통합' },
    ],
  },
  {
    key: 'train', icon: 'GraduationCap', color: 'gold',
    title: '교육·훈련', desc: '기술 배우거나 자격증을 따고 싶어요',
    links: [
      { label: 'HRD-Net 훈련과정 검색', url: 'https://www.hrd.go.kr', host: '국비 훈련과정 검색' },
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
    key: 'mind', icon: 'HeartHandshake', color: 'coral',
    title: '마음 건강', desc: '지치고 막막할 때 도움받고 싶어요',
    links: [
      { label: '청소년상담 1388', tel: '1388', host: '24시간 무료 상담' },
    ],
  },
];

// ── 청년 지원 프로그램·정책 (앱 안에서 설명 → 신청만 외부) ──
// 각 항목:
//   id          상세 화면 식별자
//   tags/badge  카드 라벨
//   desc        카드 한 줄 요약
//   summary     상세 첫 문단(이게 뭔지)
//   who[]       이런 분께 맞아요
//   benefit[]   이런 걸 받아요/배워요
//   steps[]     신청은 이렇게
//   cautions    알아두기(한 단락)
//   applyLabel  하단 버튼 문구
//   applyUrl    '신청/접수' 외부 링크(이 한 곳만 외부)
//   match       맞춤 추천용 메타
//     startWith[]  시작 방식이 이거면 가점
//     fields[]     관심 분야가 이거면 가점 ('any'면 분야 무관)
//     noCert       자격증 없는 사람에게 가점
//     undecided    아직 진로 미정인 사람에게 가점
export const JOB_PROGRAMS = [
  {
    id: 'youth-challenge',
    title: '청년도전지원사업',
    tags: ['청년', '참여수당'], badge: '추천',
    plain: '쉽게 말하면 — 막막한 청년 손잡고 같이 준비해주고, 참여하면 용돈(수당)도 줘요.',
    desc: '같이 준비해 주고, 참여하면 용돈(수당)도 줘요.',
    summary:
      '한동안 일·구직에서 멀어졌거나 자신감을 잃은 청년이, 다시 시작할 수 있게 1:1 상담과 맞춤 프로그램을 제공하는 사업이에요. 참여하면 참여수당도 받을 수 있어요.',
    who: [
      '뭐부터 해야 할지 막막한 청년',
      '한동안 쉬어서 다시 시작이 두려운 경우',
      '혼자보다 같이 챙겨줄 사람이 필요한 경우',
    ],
    benefit: [
      '나에게 맞는 상담과 프로그램에 참여해요',
      '참여하면 용돈(수당)을 받아요 (금액은 지역·해마다 달라요)',
      '끝나면 다음 단계(취업 지원)로 이어줘요',
    ],
    steps: [
      '온라인청년센터에서 우리 지역 운영기관(청년센터 등)을 확인해요.',
      '운영기관에 상담을 신청하고 참여 가능 여부를 확인해요.',
      '맞춤 프로그램에 참여하고, 이수 후 수당·다음 단계를 안내받아요.',
    ],
    cautions:
      '학교 밖 청소년·검정고시 응시자도 참여 대상이 되는 경우가 많지만, 지역마다 운영기관·모집 일정·수당 금액이 달라요. 대상 나이(보통 18~34세)와 세부 요건은 신청 전 온라인청년센터나 관할 기관에 "나도 참여할 수 있는지" 꼭 확인하세요.',
    applyLabel: '온라인청년센터에서 신청처 찾기',
    applyUrl: 'https://www.youthcenter.go.kr',
    match: { startWith: ['아직 고민 중'], fields: ['any'], undecided: true },
  },
  {
    id: 'national-employment',
    title: '국민취업지원제도',
    tags: ['취업지원', '구직촉진수당'],
    plain: '쉽게 말하면 — 취업 도와주는 1:1 코치 + 조건 되면 매달 지원금.',
    desc: '취업을 도와주고, 조건이 되면 매달 지원금도 줘요.',
    summary:
      '취업을 원하는 사람에게 "어떻게 취업할지" 계획을 같이 세워주고, 직업훈련·일경험을 연계해 주는 제도예요. 소득·재산 요건을 충족하면 구직촉진수당도 받을 수 있어요.',
    who: [
      '바로 취업하고 싶지만 혼자는 막막한 경우',
      '준비하는 동안 약간의 생활비가 필요한 경우',
      '기술 배우기·일 경험까지 이어서 하고 싶은 경우',
    ],
    benefit: [
      '담당 코치가 1:1로 취업을 도와줘요',
      '기술 배우기·일 경험으로 이어줘요',
      '조건이 되면 준비하는 동안 매달 지원금을 받아요',
    ],
    steps: [
      '고용24에서 온라인으로 신청하거나 가까운 고용센터를 방문해요.',
      '내가 어느 유형(I·II)에 맞는지 확인받아요. (간단히 — I유형은 생활 지원금까지, II유형은 취업 도움 중심이에요.)',
      '취업 계획을 세우고, 구직활동·프로그램에 참여해요.',
    ],
    cautions:
      '받는 지원은 유형(I·II)에 따라 달라요. 생활 지원금(구직촉진수당)은 소득·재산·나이 요건을 다 채워야 받을 수 있어요. 학교 밖 청소년·검정고시 응시자도 신청 가능한지, 최신 기준·금액과 함께 고용24나 고용센터(1350)에서 꼭 확인하세요.',
    applyLabel: '고용24에서 신청하기',
    applyUrl: 'https://www.work24.go.kr',
    match: { startWith: ['바로 취업할래요'], fields: ['any'] },
  },
  {
    id: 'tomorrow-card',
    title: '국비 직업훈련 (내일배움카드)',
    tags: ['직업훈련', '국비지원'],
    needsCheck: true,
    plain: '쉽게 말하면 — 나라가 학원비(훈련비)를 대줘서 기술을 배우는 제도예요. 카드 이름이 "내일배움카드"고요.',
    desc: '나라가 학원비(훈련비)를 대줘요. 학교 밖 청소년은 되는지 먼저 확인해요.',
    summary:
      '직업훈련을 받고 싶은 사람에게 훈련비를 나라가 지원해 주는 제도예요(카드 이름이 "내일배움카드"). 카드를 발급받으면 정해진 한도 안에서 HRD-Net에 등록된 다양한 과정을 들을 수 있어요. 다만 발급 대상에 나이·상황 요건이 있어서, 학교 밖 청소년·미성년자는 바로 되는지 확인이 필요해요.',
    who: [
      '실무 기술을 빨리 배워서 일하고 싶은 경우',
      'IT·디자인·정비·요리 등 배우고 싶은 분야가 있는 경우',
      '훈련비 부담 때문에 시작을 망설이던 경우',
    ],
    benefit: [
      '정해진 만큼 학원비(훈련비)를 대줘요 (일부는 내 돈이 들 수 있어요)',
      '수천 개 과정 중에서 골라 배울 수 있어요',
      '다 배우면 자격·취업으로 이어가기 좋아요',
    ],
    steps: [
      '먼저 고용센터나 꿈드림센터에 "내가 발급 대상인지" 물어봐요. (학교 밖 청소년은 이 확인이 가장 중요해요.)',
      '대상이 되면 고용24 또는 HRD-Net에서 카드 발급을 신청해요.',
      '훈련 상담을 받고 들을 과정을 정해, 수강하고 수료해요.',
    ],
    cautions:
      '학교 밖 청소년·미성년자에게 바로 적용되는지는 상황마다 달라요. 된다고 단정하지 말고, 신청 전에 가까운 고용센터(1350)나 꿈드림센터에 "나도 발급 대상인지" 꼭 확인하세요. 과정마다 지원율·본인 부담도 다릅니다.',
    applyLabel: '고용24에서 자격·발급 확인하기',
    applyUrl: 'https://www.work24.go.kr',
    match: { startWith: ['기술 먼저 배우기'], fields: ['IT·디자인', '제조·기술', '서비스·요식'] },
  },
  {
    id: 'voca-psych-test',
    title: '직업심리검사',
    tags: ['진단', '무료'],
    plain: '쉽게 말하면 — 나한테 뭐가 맞나 알려주는 무료 검사.',
    desc: '나한테 뭐가 맞는지 알려주는 무료 검사예요.',
    summary:
      '내가 어떤 일에 흥미가 있고 무엇을 잘하는지 검사로 알아보는 거예요. 워크넷에서 무료로 할 수 있고, 결과지로 어울리는 직업·분야를 추천받아요. 진로가 막막할 때 첫 단계로 좋아요.',
    who: [
      '아직 관심 분야를 못 정한 경우',
      '내가 뭘 좋아하고 잘하는지부터 알고 싶은 경우',
      '진로 상담을 받기 전에 나를 먼저 파악하고 싶은 경우',
    ],
    benefit: [
      '청소년용·성인용 등 여러 검사 무료 제공',
      '흥미·적성 기반 추천 직업/분야 결과지',
      '결과를 들고 상담으로 이어가기 좋음',
    ],
    steps: [
      '워크넷에 접속해 직업심리검사 메뉴를 열어요.',
      '나에게 맞는 검사를 골라 온라인으로 응시해요.',
      '결과지를 확인하고, 필요하면 상담을 신청해요.',
    ],
    cautions:
      '검사 결과는 "정답"이 아니라 참고 자료예요. 여러 검사와 상담을 함께 보면 더 정확하게 방향을 잡을 수 있어요.',
    applyLabel: '워크넷에서 검사하기',
    applyUrl: 'https://www.work.go.kr',
    match: { startWith: ['아직 고민 중'], fields: ['any'], undecided: true },
  },
  {
    id: 'technician-cert',
    title: '국가기술자격 기능사',
    tags: ['자격증'],
    plain: '쉽게 말하면 — 학력 없이 딸 수 있는 첫 국가자격증.',
    desc: '학력 없이 딸 수 있는 첫 국가자격증이에요.',
    summary:
      '국가기술자격 중 "기능사"는 학력·나이 제한이 거의 없어서 학교 밖 청소년·청년도 바로 도전할 수 있어요. 제과·미용·전기·정보처리 등 종목이 다양하고, 합격하면 취업의 첫 무기가 돼요.',
    who: [
      '손에 잡히는 자격증으로 취업을 노리는 경우',
      '학력 요건 없이 시작할 수 있는 자격을 찾는 경우',
      '훈련·아르바이트와 병행해 스펙을 쌓고 싶은 경우',
    ],
    benefit: [
      '학력·나이 제한이 거의 없어 시작하기 쉬워요',
      '제과제빵·미용·전기·컴퓨터 등 종류가 많아요',
      '붙으면 나라가 인정하는 자격증 — 취업에 바로 써요',
    ],
    steps: [
      '큐넷에서 관심 종목의 응시자격·시험일정을 확인해요.',
      '원서를 접수하고 필기시험을 준비해요.',
      '필기 합격 후 실기까지 통과하면 자격 취득!',
    ],
    cautions:
      '"기능사"는 학력·나이 제한이 거의 없어 학교 밖 청소년·검정고시 응시자도 바로 도전할 수 있어요. 다만 "기사·산업기사"는 학력·경력 요건이 있으니, 처음엔 "기능사"부터 시작하세요. 종목별 일정·응시료는 큐넷에서 확인하세요.',
    applyLabel: '큐넷에서 접수하기',
    applyUrl: 'https://www.q-net.or.kr',
    match: { startWith: ['자격증 먼저'], fields: ['제조·기술', 'IT·디자인'], noCert: true },
  },
  {
    id: 'youth-leap',
    title: '청년일자리도약장려금',
    tags: ['취업'],
    plain: '쉽게 말하면 — 청년 뽑는 회사에 정부가 돈을 줘서, 그런 회사가 더 잘 뽑아요.',
    desc: '청년 뽑는 회사에 정부가 돈을 줘서, 잘 뽑게 해요.',
    summary:
      '취업이 어려운 청년을 정규직으로 채용한 기업에 정부가 지원금을 주는 제도예요. 구직자 입장에서는, 이 제도로 채용하는 기업의 공고를 노리면 취업 문이 더 넓어질 수 있어요.',
    who: [
      '바로 정규직 취업을 목표로 하는 청년',
      '경력이 적어 채용 문턱이 높게 느껴지는 경우',
    ],
    benefit: [
      '청년을 채용한 기업에 인건비 일부 지원 → 채용 여력 ↑',
      '관련 공고가 고용24·워크넷에 함께 올라오는 경우가 많음',
    ],
    steps: [
      '고용24에서 청년 대상 채용 공고를 검색해요.',
      '지원 자격(나이·취업 상태 등)을 확인하고 지원해요.',
      '채용 절차는 일반 채용과 동일하게 진행돼요.',
    ],
    cautions:
      '이건 기업에 주는 지원이라, 청년이 직접 신청하는 수당은 아니에요. 대상·요건은 해마다 바뀌니 고용24에서 최신 공고·기준을 확인하세요.',
    applyLabel: '고용24에서 공고 보기',
    applyUrl: 'https://www.work24.go.kr',
    match: { startWith: ['바로 취업할래요'], fields: ['any'] },
  },
];

// id로 단일 프로그램 찾기
export function getProgram(id) {
  return JOB_PROGRAMS.find((p) => p.id === id) || null;
}

// ── 맞춤 추천 ──
// jobProfile(질문 답변)에 따라 프로그램에 점수를 매겨 정렬한다.
// "우다다 다 보여주기" 대신, 상황에 맞는 것부터 위로 올린다.
export function scoreProgram(p, jobProfile) {
  if (!jobProfile) return 0;
  const m = p.match || {};
  let score = 0;
  if (m.startWith && jobProfile.startWith && m.startWith.includes(jobProfile.startWith)) score += 3;
  if (jobProfile.interest && jobProfile.interest !== '아직 몰라요') {
    if (m.fields && (m.fields.includes('any') || m.fields.includes(jobProfile.interest))) score += 2;
  }
  if (m.noCert && jobProfile.hasCert === '없어요') score += 2;
  if (m.undecided && (jobProfile.interest === '아직 몰라요' || jobProfile.startWith === '아직 고민 중')) score += 1;
  return score;
}

// 정직성 정렬 보정 — 자격이 불확실한(needsCheck) 제도는 점수가 같을 때 뒤로 보낸다.
// "학교 밖에 확실히 맞는 것"을 앞에, "확인 필요한 것"을 뒤에 두기 위함.
function tiebreak(a, b) {
  if (b.s !== a.s) return b.s - a.s;
  const ca = a.p.needsCheck ? 1 : 0;
  const cb = b.p.needsCheck ? 1 : 0;
  return ca - cb; // needsCheck 아닌 게 먼저
}

// 추천 우선 정렬 결과 { recommended: [...최대 3], rest: [...나머지] }
export function matchPrograms(jobProfile) {
  const ranked = JOB_PROGRAMS
    .map((p, i) => ({ p, s: jobProfile ? scoreProgram(p, jobProfile) : 0, i }))
    .sort((a, b) => tiebreak(a, b) || a.i - b.i);
  const matched = ranked.filter((r) => r.s > 0).map((r) => r.p);
  const recommended = (matched.length ? matched : ranked.map((r) => r.p)).slice(0, 3);
  const recIds = new Set(recommended.map((p) => p.id));
  const rest = JOB_PROGRAMS.filter((p) => !recIds.has(p.id));
  return { recommended, rest };
}

// 추천 이유 한 줄 (홈/탐색 상단 안내용)
export function matchReason(jobProfile) {
  if (!jobProfile) return null;
  const parts = [];
  if (jobProfile.interest && jobProfile.interest !== '아직 몰라요') parts.push(jobProfile.interest);
  if (jobProfile.startWith && jobProfile.startWith !== '아직 고민 중') parts.push(jobProfile.startWith);
  if (!parts.length) return '아직 고민 중이라면, 방향 잡기부터 같이 해요.';
  return `${parts.join(' · ')}에 맞춰 골랐어요.`;
}

// ── 취업 프로필 질문 ──
export const JOB_QUESTIONS = [
  {
    key: 'interest', title: '하고 싶은 일이 있어요?',
    hint: '아직 없어도 괜찮아요.',
    options: ['IT·디자인', '서비스·요식', '제조·기술', '사무·행정', '아직 몰라요'],
  },
  {
    key: 'startWith', title: '어떻게 시작할까요?',
    hint: '고른 길에 맞춰 알려드려요.',
    options: ['바로 취업할래요', '자격증 먼저', '기술 먼저 배우기', '아직 고민 중'],
  },
  {
    key: 'hasCert', title: '자격증이 있어요?',
    hint: '없어도 괜찮아요. 처음부터 같이 따요.',
    options: ['있어요', '없어요'],
  },
  {
    key: 'workType', title: '어떻게 일하고 싶어요?',
    hint: '나중에 바꿔도 돼요.',
    options: ['정규직', '알바·단기', '상관없어요'],
  },
];

// ── 준비 로드맵 단계 ──
// 원칙: 단계 제목·todo에는 행정용어(내일배움카드 등)를 쓰지 않는다.
//   "기술 배우기" 처럼 쉬운 말로 풀고, 정확한 제도 이름은 상세 화면에서.
export const JOB_ROADMAP = [
  { id: 'explore', icon: 'Compass', title: '1. 나 알아보기',
    todo: '무료 검사로 나한테 맞는 일을 찾아봐요.',
    cta: { label: '무료 검사 해보기', screen: 'job-detail', params: { id: 'voca-psych-test' } } },
  { id: 'skill', icon: 'GraduationCap', title: '2. 기술·자격 쌓기',
    todo: '학력 없이 딸 수 있는 자격증에 도전하거나, 나라가 학원비를 대주는 곳에서 기술을 배워요.',
    cta: { label: '학력 없이 따는 자격증 보기', screen: 'job-detail', params: { id: 'technician-cert' } } },
  { id: 'find', icon: 'Search', title: '3. 일자리 찾기',
    todo: '워크넷·고용24에서 일자리를 찾아요. 혼자 힘들면 도와주는 제도도 있어요.',
    cta: { label: '취업 도와주는 곳 보기', screen: 'job-detail', params: { id: 'national-employment' } } },
  { id: 'apply', icon: 'FileText', title: '4. 지원·면접 준비',
    todo: '이력서를 쓰고, 면접에서 할 말을 미리 연습해요.', cta: null },
  { id: 'work', icon: 'Sparkles', title: '5. 첫 출근·적응',
    todo: '일을 시작하면 근로계약서를 꼭 챙겨요. 힘들면 1388에 전화해요.', cta: null },
];
