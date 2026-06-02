// logo.png 디자인(다리 + 웃는 별)을 그대로 두고, 배경색만 브랜드 그라데이션으로 변경
export default function LogoMark({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      className="logo-mark"
      role="img"
      aria-label="ReBridge 로고"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffae5d" />
          <stop offset="1" stopColor="#ff6f61" />
        </linearGradient>
      </defs>

      {/* 배경: 남색 → 브랜드 그라데이션 */}
      <rect x="8" y="8" width="80" height="80" rx="20" fill="url(#logoGrad)" />

      {/* 다리 (흰색 유지) */}
      <path
        d="M26 65V55C26 42.85 35.85 33 48 33C60.15 33 70 42.85 70 55V65"
        stroke="#FFFFFF"
        strokeWidth="8"
        strokeLinecap="square"
      />
      <path d="M26 62H70" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="square" />
      <path d="M39 39V62" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      <path d="M48 34V62" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      <path d="M57 39V62" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />

      {/* 웃는 별 (노란색 유지) */}
      <path
        d="M68.8 22.8L71.56 28.48L77.8 29.36L73.28 33.8L74.36 40L68.8 37.08L63.24 40L64.32 33.8L59.8 29.36L66.04 28.48L68.8 22.8Z"
        fill="#FFE08C"
        stroke="#E3B83C"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="66.2" cy="31.6" r="1.2" fill="#e8503f" />
      <circle cx="71.4" cy="31.6" r="1.2" fill="#e8503f" />
      <path
        d="M65.9 34.8C67.4 36.2 70.2 36.2 71.7 34.8"
        stroke="#e8503f"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
