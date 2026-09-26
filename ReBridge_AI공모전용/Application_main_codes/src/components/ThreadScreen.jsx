import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Info, Phone, MapPin, Check } from 'lucide-react';
import { getCenter, shortName, centerMark } from '../lib/centers.js';
import {
  getDemoRole, getThread, threadForCenter, sendFromStudent, replyFromStaff, markRead,
  subscribeMessages, STARTERS, timeLabel,
} from '../lib/messages.js';
import { getCachedUser } from '../lib/auth.js';
import '../styles.v3.css';

// 1:1 쪽지 대화 (PRD v2 F5 학생 · F7 실무자 — 2026-09-26 시연판)
//   학생: params.centerId 로 들어온다. 첫 쪽지 전이면 시작 문장을 보여준다.
//   선생님 모드: params.threadId 로 들어온다(쪽지함에서). 말풍선의 '나'가 선생님 쪽으로 바뀐다.
//   ⚠️ 시연 모드 — 실제 센터로 보내지 않는다. 화면 맨 위에 늘 적어 둔다.

export default function ThreadScreen({ goTo = () => {}, goBack = () => {}, centerId, threadId }) {
  const role = getDemoRole();
  const staff = role === 'staff';
  const [thread, setThread] = useState(() => (threadId ? getThread(threadId) : threadForCenter(centerId)));
  const [text, setText] = useState('');
  const [nickname, setNickname] = useState(() => getCachedUser()?.nickname || '');
  const endRef = useRef(null);
  const center = getCenter(thread?.centerId || centerId);

  useEffect(() => subscribeMessages(() => {
    setThread(threadId ? getThread(threadId) : threadForCenter(centerId));
  }), [threadId, centerId]);

  useEffect(() => {
    if (thread) markRead(thread.id, role);
  }, [thread?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  function send() {
    const body = text.trim();
    if (!body || (staff && !thread) || (!staff && !center)) return;
    const next = staff
      ? replyFromStaff(thread.id, body)
      : sendFromStudent({ centerId: center.id, centerName: shortName(center), nickname, body });
    if (next) { setThread({ ...next }); setText(''); }
  }

  const title = staff ? '받은 쪽지' : '꿈드림 쪽지';
  const messages = thread?.messages || [];
  let lastDay = '';

  return (
    <div className="screen v3-screen" style={{ paddingBottom: 0 }}>
      <header className="v3-top">
        <button className="v3-icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="v3-top-title">{title}</span>
      </header>

      {/* 누구와 이야기하는지 늘 위에 (2026-09-26 2차 — '꿈드림과 이어진다'는 느낌) */}
      {staff ? (
        <div className="v3-thread-head">
          <span className="v3-cav student" aria-hidden="true">{(thread?.nickname || '학').slice(0, 2)}</span>
          <span className="v3-thread-head-main">
            <span className="v3-thread-head-name">{thread?.nickname || '학생'} 학생</span>
            <span className="v3-thread-head-sub">{shortName(center)}로 온 쪽지 · 이름·연락처는 받지 않아요</span>
          </span>
        </div>
      ) : center && (
        <div className="v3-thread-head">
          <span className="v3-cav" aria-hidden="true">{centerMark(center)}</span>
          <span className="v3-thread-head-main">
            <span className="v3-thread-head-name">{shortName(center)}</span>
            <span className="v3-thread-head-sub">꿈드림 선생님이 읽고 답해요</span>
          </span>
          <span className="v3-thread-head-acts">
            <a className="v3-icon-btn" href={`tel:${center.phone}`} aria-label="센터에 전화"><Phone size={17} /></a>
            <button type="button" className="v3-icon-btn" aria-label="센터 정보" onClick={() => goTo('center', { centerId: center.id })}><MapPin size={17} /></button>
          </span>
        </div>
      )}

      <p className="v3-note" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', margin: '10px 20px 0' }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>시연 화면이라 쪽지는 이 기기에만 저장되고 실제 센터로 보내지지 않아요.
          {!staff && ' MY에서 선생님 모드를 켜면 답장을 써 볼 수 있어요.'}</span>
      </p>

      <div className="v3-chat">
        {messages.length === 0 && !staff && (
          <div style={{ padding: '14px 4px 4px' }}>
            <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>{shortName(center)} 선생님께 첫 쪽지</p>
            <p className="v3-lead" style={{ fontSize: 14.5 }}>
              “가 봐도 돼요?” 한 줄이면 충분해요. 선생님이 읽고 이 쪽지함으로 답장해 줘요.
            </p>
            <label className="v3-label" htmlFor="nick" style={{ marginTop: 16 }}>불러 줄 이름 (선택)</label>
            <input
              id="nick"
              className="v3-input"
              maxLength={12}
              placeholder="예: 하늘"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <p className="v3-note" style={{ margin: '6px 0 0' }}>실명이나 전화번호는 적지 않아도 돼요.</p>
          </div>
        )}

        {messages.map((m) => {
          const day = new Date(m.at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = staff ? m.from === 'staff' : m.from === 'student';
          const who = m.from === 'staff'
            ? <>{shortName(center)} 선생님<span className="v3-staff-chip">꿈드림 선생님</span></>
            : `${thread.nickname || '학생'} 학생`;
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && <span className="v3-chat-day">{day}</span>}
              <div className={`v3-bubble-wrap ${mine ? 'me' : 'them'}`}>
                {!mine && <span className="v3-bubble-who">{who}</span>}
                <div className="v3-bubble">{m.body}</div>
                <span className="v3-bubble-time">{timeLabel(m.at)}</span>
              </div>
            </div>
          );
        })}

        {messages.length > 0 && !staff && (() => {
          // 전달 상태: 보냄 → 선생님 확인 → 답장. 시연판이라 '확인'은 답장이 왔을 때만 켠다(읽음 표시를 지어내지 않는다).
          const replied = messages.some((m) => m.from === 'staff');
          const waiting = messages[messages.length - 1].from === 'student';
          return (
            <>
              <div className="v3-track" aria-label="쪽지 전달 상태">
                <i className="on"><Check size={12} /> {shortName(center)}로 보냄</i>
                <span className={`bar${replied ? ' on' : ''}`} />
                <i className={replied ? 'on' : ''}>선생님 확인</i>
                <span className={`bar${replied ? ' on' : ''}`} />
                <i className={replied ? 'on' : ''}>답장</i>
              </div>
              {waiting && (
                <p className="v3-note" style={{ margin: '8px 4px 0', textAlign: 'center' }}>
                  선생님이 확인하면 여기로 답장이 와요. 급한 일은 전화가 더 빨라요.
                </p>
              )}
            </>
          );
        })()}
        <div ref={endRef} />
      </div>

      {messages.length === 0 && !staff && (
        <div className="v3-starters">
          {STARTERS.map((s) => (
            <button key={s} type="button" className="v3-starter" onClick={() => setText(s)}>{s}</button>
          ))}
        </div>
      )}

      <div className="v3-composer">
        <textarea
          rows={1}
          placeholder={staff ? '답장 쓰기' : '쪽지 쓰기'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={staff ? '답장 내용' : '쪽지 내용'}
        />
        <button type="button" className="v3-send" aria-label="보내기" disabled={!text.trim()} onClick={send}>
          <Send size={19} />
        </button>
      </div>
    </div>
  );
}
