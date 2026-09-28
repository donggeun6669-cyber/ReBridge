import { useState } from 'react';
import { BookOpen, UserCheck, Building2, Mail, ChevronUp, ChevronDown } from 'lucide-react';
import SyTop from './SyTop.jsx';
import { getSupportDetail, homeFallbackCenter } from './bUtil.js';
import './sy-b.css';

// 지원 자세히 보기 (시안: 꿈드림센터 · 지원 상세 펼침.png)
//   꿈드림센터 홈의 '학습·검정고시 지원'에서 들어온다(params.supportId, 기본 'study').
//   '무엇을 받을 수 있나요?' 는 시안에서부터 펼쳐진 상태라 기본값을 열림으로 둔다.
//   맨 아래 '가까운 센터에 물어보기'는 기존 messages.js 저장 로직을 쓰는 쪽지 작성(thread)으로 이어진다.
export default function SySupportDetail({ goTo = () => {}, goBack = () => {}, params = {} }) {
  const d = getSupportDetail(params.supportId);
  const [open, setOpen] = useState(true);

  function askCenter() {
    const c = homeFallbackCenter();
    goTo('thread', { centerId: c?.id, draft: d.draft });
  }

  return (
    <div className="sy-screen">
      <SyTop title="지원 자세히 보기" onBack={goBack} />

      <span className="sy-b-tag"><BookOpen size={14} /> {d.tag}</span>
      <h1 className="sy-b-title">{d.title}</h1>
      <p className="sy-b-desc">{d.desc}</p>

      <div className="sy-b-info-card">
        <div className="sy-b-info-row">
          <span className="sy-b-info-ico"><UserCheck size={17} /></span>
          <span>
            <span className="sy-b-info-label">대상</span>
            <span className="sy-b-info-value" style={{ display: 'block' }}>{d.target}</span>
          </span>
        </div>
        <div className="sy-b-info-row">
          <span className="sy-b-info-ico"><Building2 size={17} /></span>
          <span>
            <span className="sy-b-info-label">신청처</span>
            <span className="sy-b-info-value" style={{ display: 'block' }}>{d.applyAt}</span>
          </span>
        </div>
        <div className="sy-b-info-row">
          <span className="sy-b-info-ico"><Mail size={17} /></span>
          <span>
            <span className="sy-b-info-label">비용</span>
            <span className="sy-b-info-value" style={{ display: 'block' }}>{d.cost}</span>
          </span>
        </div>
      </div>

      <div className="sy-b-accordion">
        <button type="button" className="sy-b-accordion-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          무엇을 받을 수 있나요?
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {open && (
          <div className="sy-b-accordion-body">
            {d.whatBody && <p>{d.whatBody}</p>}
            {d.bullets.length > 0 && (
              <ul className="sy-b-bullets">
                {d.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="sy-b-cta">
        <button type="button" className="sy-btn" onClick={askCenter}>가까운 센터에 물어보기</button>
      </div>
    </div>
  );
}
