// 검고담임(Gumgo Mentor) 로고 마크 — 말풍선 + 체크 (브랜드 초록/파랑)
export default function LogoMark({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      className="logo-mark"
      role="img"
      aria-label="검고담임 로고"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2E8BD0" />
          <stop offset="1" stopColor="#36B85A" />
        </linearGradient>
      </defs>

      {/* 배경: 파랑 → 초록 그라데이션 라운드 사각형 */}
      <rect x="8" y="8" width="80" height="80" rx="22" fill="url(#logoGrad)" />

      {/* 말풍선 (흰색) */}
      <path
        d="M30 26h36a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H46l-12 11v-11h-4a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10Z"
        fill="#FFFFFF"
      />

      {/* 체크 (초록) */}
      <path
        d="M37 45.5 L45 53.5 L61 36.5"
        stroke="#36B85A"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
