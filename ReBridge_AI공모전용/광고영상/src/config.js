// ───────────────────────────────────────────────────────────────
// 검고담임 광고 — 바꿔도 되는 값은 전부 여기 있다.
//
// · 문구: 각 장면의 copy (배열 한 칸 = 화면의 한 줄)
// · 장면 길이: start / end (초). 장면 안의 움직임은 길이에 맞춰 같이 늘고 준다.
//   장면끼리 겹치거나 비지 않게, 앞 장면의 end = 다음 장면의 start 로 둔다.
// · 화면: 앱 화면 이미지는 tools/capture-screens.mjs 로 다시 찍는다(assets/screens).
//
// 2026-09-28 새 버전: 서연 UI(초록·종이색·하단 탭 5개)로 바뀐 앱에 맞췄다.
//   장면 길이·큰 움직임의 시각은 예전 판(2026-09-20)과 같다 → 소리(audio-cues.json)를 그대로 맞춰 쓴다.
// ───────────────────────────────────────────────────────────────
window.AD_CONFIG = {
  width: 1920,
  height: 1080,
  fps: 30, // MP4로 내보낼 때 초당 프레임

  // 마지막 장면의 QR이 가리키는 주소 — 배포된 앱(시연 URL)
  demoUrl: 'https://gumgomentor.vercel.app',
  demoUrlLabel: 'gumgomentor.vercel.app',

  scenes: [
    { id: 'problem', label: '문제 제시', start: 0, end: 6,
      copy: ['검정고시 다음,', '대학은 어떻게 준비하지?'] },
    { id: 'intro', label: '검고담임 등장', start: 6, end: 12,
      copy: ['다음 단계가 보이도록.'] },
    { id: 'roadmap', label: '대입 네 걸음', start: 12, end: 23,
      copy: ['지금 내게 필요한 준비를,', '순서대로.'] },
    { id: 'score', label: '대학·전형 찾기', start: 23, end: 34,
      copy: ['조건으로 대학을 찾고,', '지원할 수 있는 전형까지.'] },
    { id: 'prepare', label: '서류와 도움', start: 34, end: 43,
      copy: ['서류는 빠짐없이,', '도움은 가까이에서.'] },
    { id: 'brand', label: '브랜드 마무리', start: 43, end: 50,
      copy: ['검정고시에서 대학까지.', '검고담임.'] },
  ],

  // 첫 장면에 흩어져 있는 종이 카드 — 홈 화면 '대입까지 네 걸음' 막대의 이름으로 들어간다
  //   step: 0 정보 준비 · 1 대학 찾기 · 2 원서 준비 · 3 결과 확인
  words: [
    { text: '대학', step: 1 },
    { text: '점수', step: 0 },
    { text: '원서', step: 2 },
    { text: '서류', step: 2 },
  ],

  // 공간의 정거장 — 앱 홈의 네 걸음(sy/aUtil.js steps)과 같은 이름·설명.
  // state 는 찍은 홈 화면 상태(정보 준비 완료 · 대학 찾기 지금 여기)와 같다.
  stations: [
    { icon: 'clipboard', title: '정보 준비', sub: '학년·지역 입력 완료', state: 'done' },
    { icon: 'search', title: '대학 찾기', sub: '학교와 전형을 비교해요', state: 'current' },
    { icon: 'file', title: '원서 준비', sub: '원서와 서류 준비', state: 'next' },
    { icon: 'flag', title: '결과 확인', sub: '발표 일정 확인', state: 'next' },
  ],

  labels: {
    realScreen: '실제 앱 화면',
    example: '시연용 예시 글',
    msgDemo: '쪽지는 시연 기능 · 예시 문장',
    done: '완료',
    current: '지금 여기',
    cta: '검고담임 둘러보기',
    qrHint: '휴대폰 카메라로 QR을 비춰 보세요',
  },
};
