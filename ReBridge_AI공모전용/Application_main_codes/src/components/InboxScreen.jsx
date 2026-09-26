import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { getDemoRole, listThreads, subscribeMessages, timeLabel } from '../lib/messages.js';
import '../styles.v3.css';

// 쪽지함 (PRD v2 F5·F7 — 2026-09-26 시연판)
//   학생: 내가 쪽지를 보낸 센터 목록 · 선생님 모드: 학생들이 보낸 쪽지 목록
//   시연판이라 선생님 모드에서는 이 기기의 모든 쪽지가 보인다.
//   실제 운영에서는 '자기 센터로 온 쪽지만' 보이게 서버(RLS)가 막아야 한다 — PRD 7장 실무자 권한.

export default function InboxScreen({ goTo = () => {}, goBack = () => {} }) {
  const staff = getDemoRole() === 'staff';
  const [threads, setThreads] = useState(() => listThreads());
  useEffect(() => subscribeMessages(() => setThreads(listThreads())), []);

  return (
    <div className="screen v3-screen">
      <header className="v3-top">
        <button className="v3-icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="v3-top-title">{staff ? '받은 쪽지 · 선생님 모드' : '쪽지함'}</span>
      </header>

      <div className="v3-list" style={{ marginTop: 6 }}>
        {threads.length === 0 && (
          <div className="v3-empty">
            {staff ? (
              <><b>아직 온 쪽지가 없어요</b>학생 쪽에서 센터에 쪽지를 보내면 여기에 떠요.</>
            ) : (
              <><b>아직 보낸 쪽지가 없어요</b>꿈드림 탭에서 센터를 고르고 ‘쪽지로 물어보기’를 누르면 돼요.</>
            )}
          </div>
        )}
        {threads.map((t) => {
          const last = t.messages[t.messages.length - 1];
          const unread = staff ? !t.readByStaff : !t.readByStudent;
          const waiting = last?.from === 'student';
          return (
            <button
              key={t.id}
              type="button"
              className="v3-row"
              onClick={() => goTo('thread', staff ? { threadId: t.id } : { centerId: t.centerId })}
            >
              <span className="v3-row-main">
                <span className="v3-row-title">
                  {staff ? `${t.nickname} 학생` : t.centerName}
                  {staff && <span className="v3-row-sub" style={{ display: 'inline', marginLeft: 6 }}>→ {t.centerName}</span>}
                </span>
                <span className="v3-row-sub clamp">
                  {last ? `${last.from === 'staff' ? '선생님: ' : ''}${last.body}` : ''}
                </span>
              </span>
              <span className="v3-row-end" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span>{last ? timeLabel(last.at) : ''}</span>
                {unread ? (
                  <span className="v3-tag green">새 쪽지</span>
                ) : staff && waiting ? (
                  <span className="v3-tag warn">답장 전</span>
                ) : (
                  <ChevronRight size={16} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
