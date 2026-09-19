// ───────────────────────────────────────────────────────────────
// 검고담임 광고 — 바꿔도 되는 값은 전부 여기 있다.
//
// · 문구: 각 장면의 copy (배열 한 칸 = 화면의 한 줄)
// · 장면 길이: start / end (초). 장면 안의 움직임은 길이에 맞춰 같이 늘고 준다.
//   장면끼리 겹치거나 비지 않게, 앞 장면의 end = 다음 장면의 start 로 둔다.
// · 화면: 앱 화면 이미지는 tools/capture-screens.mjs 로 다시 찍는다(assets/screens).
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
    { id: 'roadmap', label: '로드맵', start: 12, end: 23,
      copy: ['지금 내게 필요한 준비를,', '순서대로.'] },
    { id: 'score', label: '점수와 대학 탐색', start: 23, end: 34,
      copy: ['내 점수의 반영 방식부터,', '대학별 지원 조건까지.'] },
    { id: 'prepare', label: '준비와 도움', start: 34, end: 43,
      copy: ['일정과 서류를 챙기고,', '필요한 도움을 찾도록.'] },
    { id: 'brand', label: '브랜드 마무리', start: 43, end: 50,
      copy: ['검정고시에서 대학까지.', '검고담임.'] },
  ],

  // 첫 장면에 흩어져 있는 종이 카드 — 폰 안 로드맵 단계 이름으로 들어간다
  //   step: 0 검정고시 · 1 내 점수 · 2 대학 찾기 · 3 원서·서류
  words: [
    { text: '대학', step: 2 },
    { text: '점수', step: 1 },
    { text: '원서', step: 3 },
    { text: '서류', step: 3 },
  ],

  // 로드맵 공간의 정거장 — 앱 로드맵 화면(RoadmapScreen)의 단계 이름·설명과 같다.
  // state 도 캡처한 홈 화면 상태(검정고시 완료 · 내 점수 지금 여기)와 같게 둔다.
  stations: [
    { icon: 'step-ged', title: '검정고시', sub: '일정·응시 조건', state: 'done' },
    { icon: 'step-score', title: '내 점수', sub: '대학별 환산 결과', state: 'current' },
    { icon: 'step-univ', title: '대학 찾기', sub: '지역·전형으로 찾기', state: 'next' },
    { icon: 'step-apply', title: '원서·서류', sub: '일정과 챙길 서류', state: 'next' },
  ],

  labels: {
    realScreen: '실제 앱 화면',
    example: '예시 점수',
    done: '완료',
    current: '지금 여기',
    dream: '꿈드림센터 · 지원 혜택',
    help: '담임에게 물어보기',
    cta: '검고담임 둘러보기',
    qrHint: '휴대폰 카메라로 QR을 비춰 보세요',
  },
};
