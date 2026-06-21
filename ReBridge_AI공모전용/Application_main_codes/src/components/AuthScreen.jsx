// AuthScreen — 닉네임 가입/로그인 + '인증코드 입력'(꿈드림 배지).
//   · 로그인 전: 닉네임만으로 가입(실명 금지). 이메일/비번 없음 → 익명성 최우선.
//   · 로그인 후: 인증코드 입력 섹션이 열린다. 미인증도 활동 가능하되 배지만 없음.
// props: goBack()  — 작성/공감 흐름에서 '로그인 필요' 시 여기로 보냈다가 돌아간다.
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
import {
  getCachedUser, subscribe, refreshUser, signUp, signOut, applyVerifiedUser,
} from '../lib/auth.js';
import { redeemCode, isVerified } from '../lib/youthVerify.js';
import { BACKEND } from '../lib/supabaseClient.js';
import { VerifiedBadge } from './CommunityBadge.jsx';
import '../styles.community.css';

// 커뮤니티 화면들이 공유하는 인증 사용자 훅(동기 캐시로 즉시 렌더 + 백엔드 동기화 구독).
export function useAuthUser() {
  const [user, setUser] = useState(() => getCachedUser());
  useEffect(() => {
    const unsub = subscribe(setUser);
    refreshUser();
    return unsub;
  }, []);
  return user;
}

export default function AuthScreen({ goBack = () => {} }) {
  const user = useAuthUser();
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const onSignUp = useCallback(async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const res = await signUp(nickname);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setNickname('');
  }, [nickname]);

  const onRedeem = useCallback(async (e) => {
    e.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    const res = await redeemCode(code, user);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    applyVerifiedUser(res.user);   // 캐시 갱신 → 구독한 화면 배지 즉시 반영
    setCode('');
    setMsg('인증됐어요! 이제 글·댓글에 🎖️ 배지가 표시돼요.');
  }, [code, user]);

  return (
    <div className="screen cm-screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">커뮤니티 로그인</span>
      </header>

      {!user ? (
        <>
          <div className="cm-intro">
            <span className="cm-intro-kicker">로그인 없이도 모든 글을 읽을 수 있어요</span>
            <h2 className="cm-intro-title">닉네임만 정하면<br />글·댓글·공감을 쓸 수 있어요</h2>
            <p className="cm-intro-sub">실명·전화번호는 쓰지 마세요. 익명으로 활동해요.</p>
          </div>

          <form className="cm-form" onSubmit={onSignUp}>
            <label className="cm-label" htmlFor="cm-nick">닉네임</label>
            <input
              id="cm-nick"
              className="cm-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 봄바람, 새벽3시"
              maxLength={20}
              autoComplete="off"
            />
            {err && <p className="cm-err">{err}</p>}
            <button className="cm-btn primary" disabled={busy || !nickname.trim()}>
              {busy ? '시작하는 중…' : '닉네임으로 시작하기'}
            </button>
          </form>

          <p className="cm-note">
            <Sparkles size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            가입은 익명이에요. 이메일·비밀번호를 받지 않아요.
            {BACKEND === 'mock' && ' (지금은 데모 모드 — 이 기기에만 저장돼요.)'}
          </p>
        </>
      ) : (
        <>
          <div className="cm-me-card">
            <div className="cm-me-top">
              <span className="cm-me-nick">{user.nickname}</span>
              <VerifiedBadge user={user} />
            </div>
            <p className="cm-me-sub">
              {isVerified(user)
                ? `꿈드림 인증 완료${user.verifiedCenter ? ` · ${user.verifiedCenter}` : ''}`
                : '아직 미인증이에요. 활동은 가능하지만 배지는 없어요.'}
            </p>
            <button className="cm-btn ghost sm" onClick={() => signOut()}>
              <LogOut size={15} /> 로그아웃
            </button>
          </div>

          {!isVerified(user) && (
            <form className="cm-form cm-verify" onSubmit={onRedeem}>
              <div className="cm-verify-head">
                <ShieldCheck size={18} />
                <span>학교밖청소년 인증코드</span>
              </div>
              <p className="cm-verify-desc">
                꿈드림 센터에서 받은 인증코드를 입력하면 글·댓글에 🎖️ 배지가 붙어요.
                {BACKEND === 'mock' && (
                  <> 데모 코드: <b>DREAM-TEST</b></>
                )}
              </p>
              <input
                className="cm-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: DREAM-AB12"
                autoCapitalize="characters"
                autoComplete="off"
              />
              {err && <p className="cm-err">{err}</p>}
              {msg && <p className="cm-ok">{msg}</p>}
              <button className="cm-btn primary" disabled={busy || !code.trim()}>
                {busy ? '확인 중…' : '인증코드 확인'}
              </button>
            </form>
          )}

          {isVerified(user) && msg && <p className="cm-ok cm-ok-center">{msg}</p>}

          <button className="cm-btn ghost" onClick={goBack} style={{ marginTop: 18 }}>
            커뮤니티로 돌아가기
          </button>
        </>
      )}
    </div>
  );
}
