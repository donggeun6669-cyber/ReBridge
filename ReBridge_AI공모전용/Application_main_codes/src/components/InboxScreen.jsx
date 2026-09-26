import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Mail } from 'lucide-react';
import { getDemoRole, listThreads, subscribeMessages, timeLabel } from '../lib/messages.js';
import { getCenter, centerMark } from '../lib/centers.js';
import '../styles.v3.css';

// 꿈드림 쪽지함 (PRD v2 F5·F7 — 2026-09-26 시연판, 2차: '꿈드림과 이어진다'는 느낌)
//   학생: 센터별 대화 — 센터 표식 + 상태(답장 왔어요 / 선생님 확인 기다리는 중)
//   선생님 모드: 학생들이 보낸 쪽지. 시연판이라 이 기기의 모든 쪽지가 보인다.
//   실제 운영에서는 '자기 센터로 온 쪽지만' 보이게 서버(RLS)가 막아야 한다 — PRD 7장 실무자 권한.

export default function InboxScreen({ goTo = () => {}, goBack = () => {} }) {
  const staff = getDemoRole() === 'staff';
  const [threads, setThreads] = useState(() => listThreads());
  useEffect(() => subscribeMessages(() => setThreads(listThreads())), []);

  const waitingCount = threads.filter((t) => t.messages.at(-1)?.from === 'student').length;

  return (
    <div className="screen v3-screen">
      <header className="v3-top">
        <button className="v3-icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="v3-top-title">{staff ? '받은 쪽지' : '꿈드림 쪽지'}</span>
      </header>

      <div className="v3-pad" style={{ paddingTop: 2 }}>
        {staff ? (
          <>
            <p className="v3-eyebrow">선생님 모드 · 시연 센터</p>
            <h1 className="v3-h1" style={{ fontSize: 22 }}>
              {waitingCount > 0 ? <>답장을 기다리는 학생이<br /><span className="v3-mark">{waitingCount}명</span> 있어요</> : '모든 쪽지에 답했어요'}
            </h1>
          </>
        ) : (
          <>
            <p className="v3-eyebrow">꿈드림 선생님과 주고받은 쪽지</p>
            <h1 className="v3-h1" style={{ fontSize: 22 }}>궁금한 건 센터 선생님께<br />편하게 물어봐요</h1>
          </>
        )}
      </div>

      {threads.length === 0 ? (
        <div className="v3-card" style={{ marginTop: 10 }}>
          {staff ? (
            <div className="v3-empty"><b>아직 온 쪽지가 없어요</b>학생이 센터에 쪽지를 보내면 여기에 떠요.</div>
          ) : (
            <>
              <ol className="v3-steps">
                <li>가까운 꿈드림 고르기<span>꿈드림 탭에서 사는 곳 근처 센터를 찾아요.</span></li>
                <li>‘쪽지 보내기’ 누르기<span>이름 대신 부를 이름만 있으면 돼요.</span></li>
                <li>선생님 답장 받기<span>답장이 오면 여기와 꿈드림 탭에 표시돼요.</span></li>
              </ol>
              <div style={{ padding: '0 18px 18px' }}>
                <button type="button" className="v3-btn block" onClick={() => goTo('centers')}>
                  <Mail size={16} /> 가까운 꿈드림 찾기
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="v3-list" style={{ marginTop: 10 }}>
          {threads.map((t) => {
            const last = t.messages[t.messages.length - 1];
            const unread = staff ? !t.readByStaff : !t.readByStudent;
            const waiting = last?.from === 'student';
            const center = getCenter(t.centerId);
            return (
              <button
                key={t.id}
                type="button"
                className="v3-row"
                onClick={() => goTo('thread', staff ? { threadId: t.id } : { centerId: t.centerId })}
              >
                {staff
                  ? <span className="v3-cav student" aria-hidden="true">{t.nickname.slice(0, 2)}</span>
                  : <span className="v3-cav" aria-hidden="true">{centerMark(center)}</span>}
                <span className="v3-row-main">
                  <span className="v3-row-title">
                    {staff ? `${t.nickname} 학생` : t.centerName}
                  </span>
                  {staff && <span className="v3-row-sub">{t.centerName}로 온 쪽지</span>}
                  <span className="v3-row-sub clamp">
                    {last ? `${staff
                      ? (last.from === 'staff' ? '나: ' : '')
                      : (last.from === 'staff' ? '선생님: ' : '나: ')}${last.body}` : ''}
                  </span>
                  <span style={{ display: 'block', marginTop: 6 }}>
                    {staff ? (
                      waiting ? <span className="v3-tag warn">답장 전</span> : <span className="v3-tag">답장함</span>
                    ) : (
                      waiting ? <span className="v3-tag">선생님 확인 기다리는 중</span> : <span className="v3-tag green">답장 왔어요</span>
                    )}
                  </span>
                </span>
                <span className="v3-row-end" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span>{last ? timeLabel(last.at) : ''}</span>
                  {unread ? <span className="v3-dot" style={{ position: 'static' }}>N</span> : <ChevronRight size={16} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
