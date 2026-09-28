// localStorage 목(mock) 백엔드 저장소 — Supabase 키가 없을 때 쓰는 공유 데이터 계층.
// auth.js / community.js / youthVerify.js 가 함께 사용한다. 키 없이도 즉시 데모 가능.
//
// 시드: 인증 플로우 데모용 테스트 인증코드(DREAM-TEST·TEACHER-DEMO·MENTOR-DEMO)와 시연용 예시 글을 미리 넣어둔다.

const SEED_VERSION = 'v5'; // 버전 올리면 시드 재적용(사용자가 쓴 글·댓글은 남긴다)

const KEYS = {
  user: 'rb_comm_user',
  codes: 'rb_comm_codes',
  posts: 'rb_comm_posts',
  comments: 'rb_comm_comments',
  reactions: 'rb_comm_reactions',
  commentReactions: 'rb_comm_comment_reactions',  // P0: 댓글 공감(♥)
  reports: 'rb_comm_reports',     // P1: 신고(글/댓글)
  blocks: 'rb_comm_blocks',       // P1: 사용자 차단
  bookmarks: 'rb_comm_bookmarks', // P1: 스크랩(저장)
  seen: 'rb_comm_seen',           // P1: 내 글에 대해 마지막으로 본 댓글/공감 수(알림 뱃지 계산)
};

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 시크릿창 등 무시 */ }
  return value;
}

// 미리 박아둔 데모 인증코드 — 인증 배지 플로우를 키 없이 시연.
// role: 'youth'(학교밖 인증) | 'staff'(꿈드림 선생님) | 'mentor'(합격 멘토)
// ⚠️ 시연용 코드다. 실제 운영에서는 센터·운영자가 youthVerify.issueCode()로 발급한다.
const SEED_CODES = [
  { code: 'DREAM-TEST',   centerId: 'demo', issuedBy: '데모센터', role: 'youth',  used_by: null, used_at: null, created_at: 0 },
  { code: 'DREAM-DEMO',   centerId: 'demo', issuedBy: '데모센터', role: 'youth',  used_by: null, used_at: null, created_at: 0 },
  { code: 'TEACHER-DEMO', centerId: 'demo', issuedBy: '데모센터', role: 'staff',  used_by: null, used_at: null, created_at: 0 },
  { code: 'MENTOR-DEMO',  centerId: 'demo', issuedBy: '운영팀',   role: 'mentor', used_by: null, used_at: null, created_at: 0 },
];

// 시드 확인은 세션(모듈 수명)당 1회면 충분 — get* 호출마다 localStorage를 읽지 않도록 가드.
// 버전이 바뀌면 시드 글·댓글·코드를 새로 깔되, 사용자가 직접 쓴 글·댓글(id가 seed-로 시작하지 않는 것)은 남긴다.
let seeded = false;
function ensureSeed() {
  if (seeded) return;
  const ver = localStorage.getItem('rb_seed_ver');
  if (ver !== SEED_VERSION) {
    const mine = (list) => (Array.isArray(list) ? list : []).filter((x) => !String(x.id).startsWith('seed-'));
    const prevCodes = read(KEYS.codes, []);
    const usedByCode = new Map(prevCodes.map((c) => [c.code, c]));
    write(KEYS.codes, [
      ...SEED_CODES.map((c) => ({ ...c, used_by: usedByCode.get(c.code)?.used_by ?? null, used_at: usedByCode.get(c.code)?.used_at ?? null })),
      ...prevCodes.filter((c) => !SEED_CODES.some((sc) => sc.code === c.code)),
    ]);
    write(KEYS.posts, [...SEED_POSTS, ...mine(read(KEYS.posts, []))]);
    write(KEYS.comments, [...SEED_COMMENTS, ...mine(read(KEYS.comments, []))]);
    localStorage.setItem('rb_seed_ver', SEED_VERSION);
  }
  seeded = true;
}

const NOW = Date.now();
const H = 1000 * 60 * 60;

// ── 시연용 예시 글 (2026-09-18, 킨텍스 산학연 EXPO 시연) ─────────────────────
// · 전부 demo:true → 화면에 '시연용 예시' 표시가 붙는다. 실제 사용자·실제 센터의 글이 아니다.
// · 닉네임·센터 이름은 가상이다(○○구). 실존 센터 이름으로 후기를 지어내지 않는다.
// · 선생님·멘토 답변의 사실 관계는 앱 안내(data/gedGuide.js·glossary.js)에 있는 것만 썼다.
//   안내 문구를 바꾸면 여기 답변도 같이 확인할 것.
// · seed_likes: 시연용 공감 수(HOT 게시판·인기순 정렬이 보이도록). 실제 공감과 합산된다.
const A = (nick, role = null, center = null) => ({
  author_nickname: nick, author_role: role, author_verified: !!role, author_center: center,
});
const STAFF = A('해솔 선생님', 'staff', '○○구 꿈드림');
const STAFF2 = A('다온 선생님', 'staff', '△△시 꿈드림');
const MENTOR = A('윤슬 멘토', 'mentor');
const MENTOR2 = A('여름 멘토', 'mentor');

const SEED_POSTS = [
  // ── 질문 (qna) — 선생님·멘토 답변 ──
  { id: 'seed-q1', board: 'qna', tag: null, demo: true, seed_likes: 14, created_at: NOW - H * 3,
    title: '자퇴하고 바로 검정고시 볼 수 있어요?',
    body: '이번 달에 자퇴했는데 다음 검정고시에 바로 접수할 수 있는지 궁금해요.',
    ...A('봄비', 'youth', 'demo') },
  { id: 'seed-q2', board: 'qna', tag: null, demo: true, seed_likes: 21, created_at: NOW - H * 8,
    title: '한 과목 완전 망하면 다 떨어지는 거예요?',
    body: '수학이 너무 약해서요. 한 과목 점수가 낮으면 전체가 불합격인지 알고 싶어요.',
    ...A('한걸음') },
  { id: 'seed-q3', board: 'qna', tag: null, demo: true, seed_likes: 17, created_at: NOW - H * 20,
    title: '검정고시로도 수시 쓸 수 있나요?',
    body: '검정고시 보면 정시만 된다고 들었는데 수시도 가능한지 궁금합니다.',
    ...A('나침반') },
  { id: 'seed-q4', board: 'qna', tag: null, demo: true, seed_likes: 9, created_at: NOW - H * 30,
    title: '비교내신이 정확히 뭐예요?',
    body: '대학 요강에 비교내신이라는 말이 계속 나오는데 무슨 뜻인지 모르겠어요.',
    ...A('새싹') },
  { id: 'seed-q5', board: 'qna', tag: null, demo: true, seed_likes: 6, created_at: NOW - H * 44,
    title: '학종 쓰려면 자기소개서 써야 해요?',
    body: '학생부가 없는데 학생부종합전형은 어떻게 준비하는지 궁금해요.',
    ...A('리듬') },
  { id: 'seed-q6', board: 'qna', tag: null, demo: true, seed_likes: 2, created_at: NOW - H * 1,
    title: '면접 연습은 어디서 할 수 있을까요?',
    body: '혼자 하려니 막막해요. 같이 연습할 방법이 있을까요?',
    ...A('구름') },

  // ── 자유 (free) ──
  { id: 'seed-f1', board: 'free', tag: null, demo: true, seed_likes: 12, created_at: NOW - H * 2,
    title: '낮에 다들 뭐 하고 지내요?',
    body: '학교 안 다니니까 낮 시간이 너무 길게 느껴져요. 루틴을 만들고 싶은데 혼자서는 잘 안 되네요. 다들 하루를 어떻게 채우는지 궁금해요.',
    ...A('리듬') },
  { id: 'seed-f2', board: 'free', tag: null, demo: true, seed_likes: 4, created_at: NOW - H * 26,
    title: '오늘 처음 공부 계획표 끝까지 지켰어요',
    body: '별거 아닌데 괜히 뿌듯해서 올려요. 내일도 해볼게요!',
    ...A('빛나', 'youth', 'demo') },

  // ── 고민 (worry) — 익명 게시판 ──
  { id: 'seed-w1', board: 'worry', tag: null, demo: true, seed_likes: 18, created_at: NOW - H * 5,
    title: '가끔 너무 불안할 때',
    body: '남들 다 학교 다닐 때 나만 멈춰 있는 것 같아서 밤에 잠이 안 와요. 요즘은 내 속도대로 가는 거라고 생각하려고 해요. 다들 이런 마음 어떻게 다스리세요?',
    ...A('익명') },
  { id: 'seed-w2', board: 'worry', tag: null, demo: true, seed_likes: 7, created_at: NOW - H * 33,
    title: '부모님께 대학 얘기를 어떻게 꺼내야 할지',
    body: '검정고시 끝나면 대학 가고 싶은데, 집에서는 아직 그런 얘기를 한 적이 없어요.',
    ...A('익명') },

  // ── 정보 (info) — 태그: 검정고시 / 입시 ──
  { id: 'seed-i1', board: 'info', tag: 'ged', demo: true, seed_likes: 25, created_at: NOW - H * 12,
    title: '[정리] 떨어져도 60점 넘은 과목은 남아요',
    body: '평균 60점에 못 미쳐도 60점 이상 받은 과목은 과목합격으로 인정돼요. 다음 회차에 신청하면 그 과목은 안 봐도 되고 점수가 그대로 합산돼요. 단, 면제 신청은 접수할 때 해야 해요.',
    ...MENTOR2 },
  { id: 'seed-i2', board: 'info', tag: 'univ', demo: true, seed_likes: 11, created_at: NOW - H * 40,
    title: '수시 6장에 전문대는 안 들어가요',
    body: '수시는 한 사람이 최대 6장까지 쓸 수 있는데, 전문대(2·3년제)와 KAIST·UNIST 같은 과기원은 이 6장에 포함되지 않아서 따로 더 쓸 수 있어요.',
    ...MENTOR },

  // ── 합격 후기 (pass) ──
  { id: 'seed-p1', board: 'pass', tag: null, demo: true, seed_likes: 30, created_at: NOW - H * 6,
    title: '검정고시 합격했습니다!!',
    body: '6개월 준비해서 드디어 붙었어요. 꿈드림센터에 주 3회 나가면서 기출 문제를 반복했어요. 준비 중인 분들 화이팅!!',
    ...A('빛나', 'youth', 'demo') },
  { id: 'seed-p2', board: 'pass', tag: null, demo: true, seed_likes: 16, created_at: NOW - H * 60,
    title: '검정고시로 대학 간 선배예요, 궁금한 거 물어보세요',
    body: '저도 처음엔 검정고시로 대학 갈 수 있을지 몰랐어요. 질문 게시판에 남겨 주시면 아는 만큼 답할게요. 모르는 건 지어내지 않고 모른다고 할게요.',
    ...MENTOR },

  // ── 꿈드림 후기 (review) ──
  { id: 'seed-r1', board: 'review', tag: null, rating: 5, demo: true, seed_likes: 8, created_at: NOW - H * 12,
    title: '○○구 꿈드림센터 다녀온 후기',
    body: '처음엔 어색할 것 같아서 망설였는데 선생님들이 편하게 대해줘서 금방 적응했어요. 검정고시 공부도 같이 봐주고 상담도 꼼꼼하게 해줬어요.',
    ...A('초록별', 'youth', 'demo') },
  { id: 'seed-r2', board: 'review', tag: null, rating: 4, demo: true, seed_likes: 3, created_at: NOW - H * 38,
    title: '진로 상담이 생각보다 깊었어요',
    body: '"무슨 직업 가져라"가 아니라 내가 뭘 좋아하는지부터 같이 찾아줬어요. 예약이 좀 밀리는 편이라 일찍 신청하는 걸 추천해요.',
    ...A('새벽달', 'youth', 'demo') },

  // ── 2026-09-26 추가 (홈 게시판·HOT 목록이 에타처럼 차 보이도록) ──
  // 사실 관계는 CLAUDE.md 「이미 확인된 사실」(과목·합격 기준·결시·과목합격제)과
  // 여성가족부 「학교 밖 청소년 지원 안내서」(청소년생활기록부·원서 단체 접수·무상 급식)에 있는 것만 썼다.
  { id: 'seed-f3', board: 'free', tag: null, demo: true, seed_likes: 9, created_at: NOW - H * 0.4,
    title: '카페에서 공부하는 사람 있어요?',
    body: '집에서는 집중이 안 돼서 요즘 동네 카페 가요. 다들 어디서 공부하는지 궁금해요.',
    ...A('모래알') },
  { id: 'seed-f4', board: 'free', tag: null, demo: true, seed_likes: 15, created_at: NOW - H * 4,
    title: '꿈드림 점심 오늘 맛있었다',
    body: '센터에서 밥 주는 거 처음 알았을 때 진짜 놀랐어요ㅋㅋ 오늘은 제육이었음',
    ...A('초록별', 'youth', 'demo') },
  { id: 'seed-f5', board: 'free', tag: null, demo: true, seed_likes: 6, created_at: NOW - H * 14,
    title: '같이 아침 인증하실 분',
    body: '매일 9시 전에 일어나서 책상 앞에 앉는 거 인증해요. 혼자 하니까 자꾸 무너져서요.',
    ...A('해바라기') },
  { id: 'seed-w3', board: 'worry', tag: null, demo: true, seed_likes: 11, created_at: NOW - H * 1.5,
    title: '친구들이랑 연락이 점점 끊겨요',
    body: '학교 그만두고 나서 친구들이랑 대화할 게 없어졌어요. 새로 친구 만들 수 있을까요?',
    ...A('익명') },
  { id: 'seed-w4', board: 'worry', tag: null, demo: true, seed_likes: 5, created_at: NOW - H * 22,
    title: '검정고시 끝나고 뭘 해야 할지 모르겠어요',
    body: '합격은 했는데 그다음이 막막해요. 대학을 가야 할지 일을 해야 할지.',
    ...A('익명') },
  { id: 'seed-q7', board: 'qna', tag: null, demo: true, seed_likes: 13, created_at: NOW - H * 2.5,
    title: '고졸 검정고시 선택과목 뭐가 쉬워요?',
    body: '선택과목을 하나 골라야 한다는데 뭐가 있는지부터 모르겠어요.',
    ...A('파도') },
  { id: 'seed-q8', board: 'qna', tag: null, demo: true, seed_likes: 8, created_at: NOW - H * 16,
    title: '청소년생활기록부가 뭐예요?',
    body: '꿈드림에서 떼 준다고 들었는데 대학 갈 때 쓰는 건가요?',
    ...A('나무늘보') },
  { id: 'seed-i3', board: 'info', tag: 'ged', demo: true, seed_likes: 19, created_at: NOW - H * 9,
    title: '[주의] 접수한 과목 하나라도 안 보면 불합격이에요',
    body: '결시는 0점 처리가 아니라 그 회차 불합격이에요. "한 과목 버리고 평균으로 넘기기"는 안 돼요. 접수한 과목은 꼭 다 보세요.',
    ...MENTOR2 },
  { id: 'seed-i4', board: 'info', tag: 'ged', demo: true, seed_likes: 10, created_at: NOW - H * 28,
    title: '꿈드림에서 검정고시 원서 같이 접수해 줘요',
    body: '센터를 통해서 원서를 단체로 접수할 수 있어요. 처음이라 헷갈리면 다니는 센터 선생님께 물어보세요.',
    ...STAFF2 },
  { id: 'seed-p3', board: 'pass', tag: null, demo: true, seed_likes: 22, created_at: NOW - H * 18,
    title: '두 번째 도전에 붙었어요',
    body: '처음엔 두 과목이 모자랐는데 60점 넘은 과목은 남아 있어서 나머지만 다시 봤어요. 포기하지 마세요!',
    ...A('한걸음') },
  { id: 'seed-p4', board: 'pass', tag: null, demo: true, seed_likes: 12, created_at: NOW - H * 50,
    title: '전문대 합격 후기 (수시)',
    body: '비교내신 기준을 대학마다 찾아보는 게 제일 힘들었어요. 입학처에 전화해서 물어보니까 친절하게 알려 주더라고요.',
    ...A('새벽달', 'youth', 'demo') },
  { id: 'seed-r3', board: 'review', tag: null, rating: 5, demo: true, seed_likes: 7, created_at: NOW - H * 7,
    title: '△△시 꿈드림 멘토링 좋아요',
    body: '대학생 멘토 선생님이랑 일주일에 한 번 수학 봐요. 모르는 거 편하게 물어볼 수 있어서 좋아요.',
    ...A('구름') },
  { id: 'seed-r4', board: 'review', tag: null, rating: 4, demo: true, seed_likes: 4, created_at: NOW - H * 45,
    title: '처음 가기 전에 전화했더니 편했어요',
    body: '갑자기 찾아가기 무서워서 먼저 전화했는데, 언제 오면 되는지 다 알려 주셨어요. 망설이는 분들 전화 먼저 해 보세요.',
    ...A('봄비', 'youth', 'demo') },

  // ── 우리 센터 (center) — 인증한 사람만 보인다. 시연 인증코드 DREAM-TEST 의 센터('demo')와 같은 글 ──
  { id: 'seed-c1', board: 'center', tag: null, demo: true, seed_likes: 6, created_at: NOW - H * 3.5,
    title: '청소년생활기록부 신청 받아요',
    body: '올해 대학 수시를 준비하는 친구들은 선생님께 말해 주세요. 지원하는 대학 일정에 맞춰 같이 준비해요.',
    ...A('해솔 선생님', 'staff', 'demo') },
  { id: 'seed-c2', board: 'center', tag: null, demo: true, seed_likes: 3, created_at: NOW - H * 6,
    title: '수요일 오후 수학 같이 할 사람',
    body: '센터 학습실에서 기출 같이 풀어요. 저도 수학 약해요ㅎㅎ',
    ...A('초록별', 'youth', 'demo') },
  { id: 'seed-c3', board: 'center', tag: null, demo: true, seed_likes: 2, created_at: NOW - H * 30,
    title: '센터 와이파이 비번 바뀌었어요?',
    body: '어제부터 안 잡히는 것 같아서요.',
    ...A('빛나', 'youth', 'demo') },
];

const C = (id, post, hoursAgo, body, author, parent = null) => ({
  id, post_id: post, parent_id: parent, body, created_at: NOW - H * hoursAgo, ...author,
});

const SEED_COMMENTS = [
  // 질문 답변 — 선생님·멘토
  C('seed-c-q1a', 'seed-q1', 2,
    '자퇴·제적한 경우에는 제적된 날부터 시험 공고일까지 6개월이 지나야 응시할 수 있어요. 공고일 기준이라 날짜 계산이 헷갈리면 접수 전에 거주지 시·도교육청에 꼭 확인해 보세요. 가까운 꿈드림센터에 오면 공부 계획도 같이 세워 드려요.',
    STAFF),
  C('seed-c-q1b', 'seed-q1', 1, '저도 같은 상황이었는데 6개월 기다리는 동안 미리 공부했어요!', A('초록별', 'youth', 'demo')),
  C('seed-c-q2a', 'seed-q2', 7,
    '검정고시는 과목별 과락이 없어요. 각 과목 100점 만점에 전 과목 평균 60점 이상이면 합격이에요. 다만 접수한 과목을 하나라도 결시하면 그 회차는 불합격이니, 약한 과목도 시험장에는 꼭 들어가세요.',
    STAFF2),
  C('seed-c-q2b', 'seed-q2', 6, '그리고 평균이 모자라도 60점 넘은 과목은 과목합격으로 남으니까 너무 걱정 마세요.', MENTOR2),
  C('seed-c-q3a', 'seed-q3', 18,
    '수시도 쓸 수 있어요. 교과전형은 검정고시 점수를 대학이 정한 방식(비교내신)으로 바꿔서 보고, 학생부종합전형은 학생부 대신 대학이 정한 대체서식을 내요. 다만 대학·전형마다 검정고시 지원 가능 여부가 달라서 모집요강을 꼭 확인해야 해요.',
    MENTOR),
  C('seed-c-q4a', 'seed-q4', 28,
    '검정고시생은 내신이 없어서, 대학이 검정고시 점수를 "내신 등급"으로 바꿔 계산해요. 이걸 비교내신이라고 해요. 대학마다 환산법이 달라서 같은 점수라도 대학별 등급이 다를 수 있어요.',
    MENTOR),
  C('seed-c-q5a', 'seed-q5', 40,
    '자기소개서는 2024학년도부터 폐지됐어요. 학생부종합전형은 검정고시생용 대체서식으로 대신하는데, 양식은 대학마다 달라서 지원할 대학 입학처에서 받아야 해요.',
    STAFF),
  C('seed-c-q6a', 'seed-q6', 0.5, '저도 궁금해요. 같이 연습할 사람 있으면 좋겠어요.', A('봄바람')),

  // 다른 게시판 댓글
  C('seed-c-f1a', 'seed-f1', 1, '오전엔 꿈드림 가서 공부하고 오후엔 운동하는 루틴 만들었어요. 나가는 곳이 생기니까 훨씬 나아요.', A('초록별', 'youth', 'demo')),
  C('seed-c-w1a', 'seed-w1', 4, '저도 그런 불안함 알아요. 천천히 가도 괜찮아요 :)', A('익명')),
  C('seed-c-w1b', 'seed-w1', 3, '불안이 오래 가면 혼자 참지 말고 꿈드림 상담도 이용해 보세요. 이야기만 나눠도 가벼워질 때가 있어요.', STAFF),
  C('seed-c-p1a', 'seed-p1', 5, '축하해요!!! 저도 다음 회차 목표예요.', A('한걸음')),
  C('seed-c-r1a', 'seed-r1', 10, '합격 축하드려요! 저도 용기가 생기네요.', A('준비생')),
  C('seed-c-q7a', 'seed-q7', 2,
    '고졸 선택과목은 도덕·기술가정·체육·음악·미술 중에 하나를 골라요. 어떤 게 쉬운지는 사람마다 달라서, 기출을 한 번씩 풀어 보고 고르는 걸 추천해요.',
    MENTOR),
  C('seed-c-q8a', 'seed-q8', 15,
    '꿈드림센터에서 활동한 내용을 적은 공식 서류예요. 일부 대학 수시(학생부종합)에서 학교생활기록부 대신 낼 수 있어요. 지원할 수 있는 대학은 해마다 달라서, 그해 모집요강과 센터에 꼭 확인해요.',
    STAFF),
  C('seed-c-f4a', 'seed-f4', 3, '우리 센터는 도시락 나와요 부럽다', A('모래알')),
  C('seed-c-f4b', 'seed-f4', 2, '센터마다 방식이 다르대요!', A('해바라기')),
  C('seed-c-w3a', 'seed-w3', 1, '꿈드림 동아리 들어가 보세요. 저는 거기서 친구 생겼어요.', A('익명')),
  C('seed-c-w3b', 'seed-w3', 1,
    '센터에 또래랑 같이 하는 동아리·캠프 프로그램이 있어요. 편할 때 한번 놀러 와요.',
    STAFF2),
  C('seed-c-p3a', 'seed-p3', 17, '축하해요!! 저도 과목합격 남은 거 믿고 다시 해볼게요', A('파도')),
  C('seed-c-c2a', 'seed-c2', 5, '저 갈래요!', A('빛나', 'youth', 'demo')),
];

export const mockStore = {
  // ── 세션 ──
  getUser() { return read(KEYS.user, null); },
  setUser(u) { return write(KEYS.user, u); },
  clearUser() { try { localStorage.removeItem(KEYS.user); } catch { /* noop */ } },

  // ── 인증코드 ──
  getCodes() { ensureSeed(); return read(KEYS.codes, []); },
  setCodes(list) { return write(KEYS.codes, list); },

  // ── 게시글/댓글/공감 ──
  getPosts() { ensureSeed(); return read(KEYS.posts, []); },
  setPosts(list) { return write(KEYS.posts, list); },
  getComments() { ensureSeed(); return read(KEYS.comments, []); },
  setComments(list) { return write(KEYS.comments, list); },
  getReactions() { return read(KEYS.reactions, []); },
  setReactions(list) { return write(KEYS.reactions, list); },
  getCommentReactions() { return read(KEYS.commentReactions, []); },
  setCommentReactions(list) { return write(KEYS.commentReactions, list); },

  // ── P1: 신고/차단/스크랩/알림 ──
  getReports() { return read(KEYS.reports, []); },
  setReports(list) { return write(KEYS.reports, list); },
  getBlocks() { return read(KEYS.blocks, []); },         // [{ blocker_id, blocked_id, created_at }]
  setBlocks(list) { return write(KEYS.blocks, list); },
  getBookmarks() { return read(KEYS.bookmarks, []); },   // [{ user_id, post_id, created_at }]
  setBookmarks(list) { return write(KEYS.bookmarks, list); },
  getSeen() { return read(KEYS.seen, {}); },             // { [postId]: { c: 본댓글수, r: 본공감수 } }
  setSeen(map) { return write(KEYS.seen, map); },
};

// 간단한 랜덤 id(목 전용). crypto 있으면 사용.
export function rid(prefix = 'm') {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
