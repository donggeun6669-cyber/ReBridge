import { useState } from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import SyTop from './SyTop.jsx';
import { getCenter, shortName } from '../lib/centers.js';
import { getDemoRole, getThread, threadForCenter, sendFromStudent } from '../lib/messages.js';
import { getCachedUser } from '../lib/auth.js';
import { homeFallbackCenter } from './bUtil.js';
import ThreadScreen from '../components/ThreadScreen.jsx';
import './sy-b.css';

// 센터에 쪽지 보내기 (시안: 꿈드림센터 · 쪽지 작성.png)
//   학생이 센터에 '처음' 쪽지를 쓰는 화면만 시안에 있다. 저장은 기존 lib/messages.js 의
//   sendFromStudent 그대로 쓴다(시연 모드 — 이 기기에만 저장, 실제 센터로 전송되지 않음).
//
//   ⚠️ 시안에 없는 두 경우는 시안이 없는 화면 규칙대로 예전 화면(ThreadScreen)을 그대로 보여준다:
//     · 선생님 모드에서 학생 쪽지에 답장할 때(말풍선 대화 UI가 필요)
//     · 이미 주고받은 쪽지가 있는 센터라 '이어서' 볼 때(대화 내역이 필요)
//   'thread' 화면 id 는 이 파일 하나로 고정돼 있어(App.jsx), 그 두 경우를 여기서 갈라 준다.
//
//   ⚠️ 시안의 '연락처(선택)' 칸은 기존 messages.js 저장 형태(from/body/at)에 없는 필드라
//      메시지 본문 끝에 이어 붙여서 보낸다(새 저장 필드를 만들지 않기 위함 — 최종 보고에 적음).
export default function SyMessageWrite({ goTo = () => {}, goBack = () => {}, params = {} }) {
  const { centerId: paramCenterId, threadId, draft = '' } = params;
  const staff = getDemoRole() === 'staff';
  const existing = threadId ? getThread(threadId) : (paramCenterId ? threadForCenter(paramCenterId) : null);
  const useOldScreen = staff || (existing && existing.messages.length > 0);

  const centerId = paramCenterId || homeFallbackCenter()?.id;
  const center = getCenter(centerId);

  // 훅은 항상 같은 순서로 불러야 해서(Rules of Hooks) 아래 분기보다 먼저 선언한다.
  const [nickname, setNickname] = useState(() => getCachedUser()?.nickname || '');
  const [contact, setContact] = useState('');
  const [text, setText] = useState(draft);

  // 시안이 없는 두 경우 — 기존 화면으로.
  if (useOldScreen) {
    return <ThreadScreen goTo={goTo} goBack={goBack} centerId={paramCenterId} threadId={threadId} draft={draft} />;
  }

  function send() {
    const body = text.trim();
    if (!body || !center) return;
    const withContact = contact.trim() ? `${body}\n\n(연락처: ${contact.trim()})` : body;
    sendFromStudent({ centerId: center.id, centerName: shortName(center), nickname, body: withContact });
    goBack();
  }

  return (
    <div className="sy-screen">
      <SyTop title="센터에 쪽지 보내기" onBack={goBack} />
      <div className="sy-b-write-wrap">
        <p className="sy-b-write-sub">답변에 필요한 내용만 적어주세요. 연락처는 선택이에요.</p>

        <div className="sy-b-field">
          <label className="sy-b-field-label" htmlFor="sy-b-nick">별명</label>
          <input
            id="sy-b-nick"
            type="text"
            maxLength={12}
            placeholder="보라별"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>

        <div className="sy-b-field">
          <label className="sy-b-field-label" htmlFor="sy-b-contact">연락처 (선택)</label>
          <input
            id="sy-b-contact"
            type="text"
            placeholder="전화번호 또는 이메일"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>

        <div className="sy-b-field">
          <label className="sy-b-field-label" htmlFor="sy-b-body">메시지</label>
          <textarea
            id="sy-b-body"
            placeholder="궁금한 지원이나 방문 가능한 시간을 적어주세요."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <p className="sy-b-note"><ShieldCheck size={16} /> 보낸 내용은 센터 상담에만 사용해요.</p>

        <div className="sy-b-write-footer">
          <button type="button" className="sy-btn" disabled={!text.trim() || !center} onClick={send}>
            <Send size={17} /> 쪽지 보내기
          </button>
        </div>
      </div>
    </div>
  );
}
