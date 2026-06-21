// 작성자 줄에 붙는 표식 모음.
//   · VerifiedBadge: 꿈드림 인증 사용자에게만 🎖️ (미인증은 아무것도 안 그림 — 차별 아닌 신뢰 표식).
//   · AuthorLine: 닉네임 + (인증 시) 배지 한 줄.
import { getBadge } from '../lib/youthVerify.js';

export function VerifiedBadge({ user, author }) {
  // user 형태({verified}) 또는 author 형태({verified}) 둘 다 허용.
  const verified = user ? getBadge(user) : (author?.verified ? { emoji: '🎖️', label: '학교밖 인증' } : null);
  if (!verified) return null;
  return (
    <span className="cm-badge" title="꿈드림에서 인증한 학교밖청소년">
      <span className="cm-badge-emoji" aria-hidden="true">{verified.emoji}</span>
      <span className="cm-badge-label">인증</span>
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
