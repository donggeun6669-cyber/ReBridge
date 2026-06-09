import { GraduationCap, Compass, ArrowRight } from 'lucide-react';

// 두 모드(학습 홈 ↔ 대학 탐색)를 오가는 하단 전환 버튼.
// current='study'  → 지금 학습 홈 → "대학 탐색하기"로 보냄
// current='explore'→ 지금 대학 탐색 → "학습 홈 들어가기"로 보냄
const CONFIG = {
  study: {
    target: 'home',
    icon: Compass,
    title: '대학 탐색하기',
    sub: '원하는 대학의 점수를 알고 싶어요',
    tone: 'explore',
  },
  explore: {
    target: 'ged-guide',
    icon: GraduationCap,
    title: '학습 홈 들어가기',
    sub: '검정고시 준비가 필요해요',
    tone: 'study',
  },
};

export default function ModeSwitch({ current, goTo = () => {} }) {
  const c = CONFIG[current];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <button className={`mode-switch ms-${c.tone}`} onClick={() => goTo(c.target)}>
      <span className="mode-switch-ico"><Icon size={20} /></span>
      <span className="mode-switch-body">
        <span className="mode-switch-title">{c.title}</span>
        <span className="mode-switch-sub">{c.sub}</span>
      </span>
      <span className="mode-switch-arrow"><ArrowRight size={20} /></span>
    </button>
  );
}
