// CommunityNotice — 게시판 목록 맨 위 '고정 공지' 카드.
//   · 일반 글과 구분되는 배경 + 📌 고정 뱃지.
//   · 펼침/접힘 토글(접으면 제목만), 닫기(이 세션 동안 숨김) 가능.
//   · 인증 배지 받는 법 + 활동 등급 안내(정직한 톤, 없는 기능은 '곧 제공').
//   백엔드 로직 없음 — 안내용 카드. 로그인/인증 여부는 props 로만 살짝 반영.
import { useState } from 'react';
import { Pin, ChevronDown, ChevronUp, X } from 'lucide-react';
import { PINNED_NOTICE } from '../lib/community.js';

export default function CommunityNotice({ verified = false }) {
  const [open, setOpen] = useState(true);
  const [closed, setClosed] = useState(false);
  if (closed) return null;

  return (
    <section className="cm-notice" aria-label="고정 공지">
      <div className="cm-notice-head">
        <span className="cm-notice-badge">
          <Pin size={12} aria-hidden="true" /> {PINNED_NOTICE.badge.replace('📌 ', '')}
        </span>
        <div className="cm-notice-head-actions">
          <button
            type="button"
            className="cm-notice-toggle"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <>접기 <ChevronUp size={14} /></> : <>펼치기 <ChevronDown size={14} /></>}
          </button>
          <button
            type="button"
            className="cm-notice-close"
            aria-label="공지 닫기"
            onClick={() => setClosed(true)}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <h3 className="cm-notice-title">{PINNED_NOTICE.title}</h3>

      {open && (
        <div className="cm-notice-body">
          {PINNED_NOTICE.sections.map((s) => (
            <div key={s.heading} className="cm-notice-section">
              <p className="cm-notice-section-head">
                <span aria-hidden="true">{s.icon}</span> {s.heading}
              </p>
              {s.lines.map((line, i) => (
                <p key={i} className="cm-notice-line">{line}</p>
              ))}
            </div>
          ))}
          {verified && (
            <p className="cm-notice-foot">현재 🎖️ 인증 배지를 받은 상태예요. 활동도 응원할게요!</p>
          )}
        </div>
      )}
    </section>
  );
}
