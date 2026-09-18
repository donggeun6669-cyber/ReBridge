// 작성자 줄에 붙는 표식 모음.
//   · VerifiedBadge: 인증된 사람에게만 배지 (미인증은 아무것도 안 그림 — 차별 아닌 신뢰 표식).
//     🎖️ 학교밖 인증 · 🧑‍🏫 꿈드림 선생님 · 🎓 합격 멘토 (2026-09-18 — 선생님·멘토 추가)
//   · AuthorLine: 닉네임 + 배지 한 줄.
import { getBadge, BADGES } from '../lib/youthVerify.js';

export function VerifiedBadge({ user, author }) {
  // user 형태 또는 author 형태({ role, verified }) 둘 다 허용.
  const b = user
    ? getBadge(user)
    : (author?.role && BADGES[author.role]) ? { ...BADGES[author.role], role: author.role }
      : author?.verified ? { ...BADGES.youth, role: 'youth' } : null;
  if (!b) return null;
  return (
    <span className={`cm-badge role-${b.role}`} title={b.label}>
      <span className="cm-badge-emoji" aria-hidden="true">{b.emoji}</span>
      <span className="cm-badge-label">{b.short}</span>
    </span>
  );
}

export function AuthorLine({ author, when }) {
  return (
    <span className="cm-author">
      <span className="cm-author-nick">{author?.nickname || '익명'}</span>
      <VerifiedBadge author={author} />
      {when && <span className="cm-author-when">· {when}</span>}
    </span>
  );
}
