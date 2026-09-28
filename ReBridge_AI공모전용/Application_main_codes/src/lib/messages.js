// messages — 학생 ↔ 꿈드림 선생님 1:1 쪽지 (PRD v2 F5·F7) — 2026-09-26 시연판
//
// ⚠️ 시연 모드 전용. 서버에 보내지 않고 이 기기(localStorage)에만 저장한다.
//   실제 센터로 전송되지 않는다는 사실을 화면에 반드시 보여준다(쪽지 화면 상단 안내).
//   실제 운영으로 가려면 Supabase에 threads/messages 테이블 + RLS(학생 본인·해당 센터 실무자만)가 필요하다.
//
// 시연 흐름(한 기기에서):
//   ① 학생이 센터 상세 → '쪽지 보내기' → 글을 보낸다
//   ② MY → '선생님 모드로 보기'를 켠다 → 쪽지함에 학생 쪽지가 뜬다 → 답장
//   ③ 선생님 모드를 끄면 학생 쪽지함에 답장이 와 있다
//
// 저장 형태
//   threads: [{ id, centerId, centerName, nickname, createdAt, updatedAt,
//               messages: [{ id, from: 'student'|'staff', body, at }],
//               readByStudent, readByStaff }]

const KEY = 'rb_messages_v1';
const ROLE_KEY = 'rb_demo_role'; // 'student' | 'staff'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* 저장 공간 없음 — 무시 */ }
  emit();
}

const listeners = new Set();
function emit() { listeners.forEach((cb) => { try { cb(); } catch { /* noop */ } }); }
export function subscribeMessages(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function rid(p) { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }

// ── 시연용 역할 전환 ─────────────────────────────────────────────────────────
export function getDemoRole() {
  try { return localStorage.getItem(ROLE_KEY) === 'staff' ? 'staff' : 'student'; } catch { return 'student'; }
}
export function setDemoRole(role) {
  try { localStorage.setItem(ROLE_KEY, role === 'staff' ? 'staff' : 'student'); } catch { /* noop */ }
  emit();
}

// ── 조회 ────────────────────────────────────────────────────────────────────
export function listThreads() {
  return load().sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getThread(id) {
  return load().find((t) => t.id === id) || null;
}
export function threadForCenter(centerId) {
  return load().find((t) => t.centerId === centerId) || null;
}
// 지금 역할 기준으로 안 읽은 쪽지가 있는 대화 수
export function unreadCount(role = getDemoRole()) {
  return load().filter((t) => (role === 'staff' ? !t.readByStaff : !t.readByStudent)).length;
}

// ── 쓰기 ────────────────────────────────────────────────────────────────────
// 학생이 센터에 첫 쪽지를 보내거나 이어 쓴다. 반환: thread
export function sendFromStudent({ centerId, centerName, nickname, body }) {
  const text = String(body || '').trim();
  if (!text) return null;
  const list = load();
  const now = Date.now();
  let t = list.find((x) => x.centerId === centerId);
  if (!t) {
    t = {
      id: rid('th'), centerId, centerName,
      nickname: String(nickname || '').trim() || '익명',
      createdAt: now, updatedAt: now, messages: [],
      readByStudent: true, readByStaff: false,
    };
    list.push(t);
  }
  t.messages.push({ id: rid('m'), from: 'student', body: text, at: now });
  t.updatedAt = now;
  t.readByStudent = true;
  t.readByStaff = false;
  save(list);
  return t;
}

export function replyFromStaff(threadId, body) {
  const text = String(body || '').trim();
  if (!text) return null;
  const list = load();
  const t = list.find((x) => x.id === threadId);
  if (!t) return null;
  const now = Date.now();
  t.messages.push({ id: rid('m'), from: 'staff', body: text, at: now });
  t.updatedAt = now;
  t.readByStaff = true;
  t.readByStudent = false;
  save(list);
  return t;
}

export function markRead(threadId, role = getDemoRole()) {
  const list = load();
  const t = list.find((x) => x.id === threadId);
  if (!t) return;
  const field = role === 'staff' ? 'readByStaff' : 'readByStudent';
  if (t[field]) return;
  t[field] = true;
  save(list);
}

export function deleteThread(threadId) {
  save(load().filter((t) => t.id !== threadId));
}

// 첫 쪽지 부담을 줄이는 시작 문장. 누르면 입력칸에 들어가고, 고쳐 쓸 수 있다.
export const STARTERS = [
  '검정고시 준비를 도와받고 싶어요.',
  '센터에 한번 가 보고 싶은데, 어떻게 하면 되나요?',
  '지금 하고 있는 프로그램이 궁금해요.',
  '고민이 있는데 상담을 받을 수 있을까요?',
];

export function timeLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
