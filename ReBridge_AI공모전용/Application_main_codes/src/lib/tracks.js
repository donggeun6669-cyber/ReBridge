// 트랙(목표) 정의 — 학습/대입/일·진로. 각 트랙은 홈 안에서 상단 서브탭으로 펼쳐진다.
// 하단 글로벌 탭(홈·지원·커뮤니티·MY)은 트랙과 무관하게 항상 고정.
// 서브탭의 screen은 기존 화면 컴포넌트 키를 그대로 재사용한다(TrackShell이 매핑).

export const TRACKS = {
  study: {
    id: 'study',
    label: '학습',
    kicker: '검정고시 준비 중',
    subtabs: [
      { key: 'roadmap', label: '로드맵', screen: 'study-roadmap' },
      { key: 'plan',    label: '플래너', screen: 'study-planner' },
      { key: 'guide',   label: '과목가이드', screen: 'ged-guide' },
    ],
  },
  univ: {
    id: 'univ',
    label: '대입',
    kicker: '대입 준비 중',
    subtabs: [
      { key: 'roadmap', label: '로드맵', screen: 'roadmap' },
      { key: 'find',    label: '대학찾기', screen: 'univ-explore' },
      { key: 'score',   label: '내 점수', screen: 'results' },
    ],
  },
  job: {
    id: 'job',
    label: '일·진로',
    kicker: '진로 탐색 중',
    subtabs: [
      { key: 'roadmap', label: '로드맵', screen: 'job-roadmap' },
      { key: 'explore', label: '직업탐색', screen: 'job-explore' },
      { key: 'psych',   label: '심리검사', screen: 'job-psych' },
    ],
  },
};

export function getTrack(id) {
  return TRACKS[id] || null;
}
