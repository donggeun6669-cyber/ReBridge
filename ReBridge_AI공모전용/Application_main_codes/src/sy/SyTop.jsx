import { ChevronLeft } from 'lucide-react';

// 서연 UI 상단 — 〈 뒤로 + 제목 (+ 오른쪽 글자 버튼)
// onBack 이 없으면 탭 첫 화면처럼 제목만 보인다.
export default function SyTop({ title, onBack, action, onAction, actionTone }) {
  return (
    <header className="sy-top">
      {onBack && (
        <button type="button" className="sy-top-back" aria-label="뒤로" onClick={onBack}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      )}
      <h1 className={`sy-top-title${onBack ? '' : ' root'}`}>{title}</h1>
      {action && (
        <button type="button" className={`sy-top-action${actionTone === 'orange' ? ' orange' : ''}`} onClick={onAction}>
          {action}
        </button>
      )}
    </header>
  );
}
