// CommunityActionSheet — 글/댓글 더보기(⋯) 액션 시트 + 신고 사유 선택.
//   화면 내 모달(별도 라우트 없음). 신고/차단/스크랩을 한 곳에서 처리.
// props:
//   target: { type:'post'|'comment', id, authorId, authorNickname, bookmarked? }
//   isMe: 내 글/댓글인지(신고/차단 숨김)
//   onClose(), onBookmarkToggle()(글만), onBlocked(), onReported()
import { useState, useCallback } from 'react';
import { Bookmark, Flag, UserX } from 'lucide-react';
import { REPORT_REASONS, reportContent, blockUser } from '../lib/community.js';

export default function CommunityActionSheet({
  target, isMe = false, onClose = () => {},
  onBookmarkToggle = null, onBlocked = () => {}, onReported = () => {},
}) {
  const [mode, setMode] = useState('menu');     // 'menu' | 'report'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submitReport = useCallback(async () => {
    if (!reason || busy) return;
    setBusy(true);
    const res = await reportContent({ target: target.type, targetId: target.id, reason });
    setBusy(false);
    if (res.ok) { onReported(res.already ? '이미 신고한 콘텐츠예요.' : '신고가 접수됐어요. 검토할게요.'); onClose(); }
  }, [reason, busy, target, onReported, onClose]);

  const doBlock = useCallback(async () => {
    if (!target.authorId) return;
    if (!window.confirm(`${target.authorNickname || '이 사용자'}님을 차단할까요? 이 사람의 글·댓글이 숨겨져요.`)) return;
    const res = await blockUser(target.authorId);
    if (res.ok) { onBlocked(); onClose(); }
  }, [target, onBlocked, onClose]);

  return (
    <div className="cm-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="cm-sheet" onClick={(e) => e.stopPropagation()}>
        {mode === 'menu' ? (
          <>
            <div className="cm-sheet-title">{target.type === 'post' ? '글' : '댓글'} 메뉴</div>

            {target.type === 'post' && onBookmarkToggle && (
              <button className="cm-sheet-item" onClick={() => { onBookmarkToggle(); onClose(); }}>
                <Bookmark size={19} fill={target.bookmarked ? 'currentColor' : 'none'} />
                {target.bookmarked ? '스크랩 취소' : '스크랩하기'}
              </button>
            )}

            {!isMe && (
              <>
                <button className="cm-sheet-item" onClick={() => setMode('report')}>
                  <Flag size={19} /> 신고하기
                </button>
                <button className="cm-sheet-item danger" onClick={doBlock}>
                  <UserX size={19} /> 이 사용자 차단
                </button>
              </>
            )}

            <button className="cm-sheet-cancel" onClick={onClose}>닫기</button>
          </>
        ) : (
          <>
            <div className="cm-sheet-title">신고 사유를 선택해 주세요</div>
            <div className="cm-reason-list">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  className={`cm-reason ${reason === r.id ? 'sel' : ''}`}
                  onClick={() => setReason(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button className="cm-btn primary" disabled={!reason || busy} onClick={submitReport}>
              {busy ? '접수 중…' : '신고 접수'}
            </button>
            <button className="cm-sheet-cancel" onClick={onClose}>취소</button>
          </>
        )}
      </div>
    </div>
  );
}
