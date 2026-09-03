// 칸수式 합격 가능성 게이지 (5칸). admissionChance(ev) 결과를 받아 렌더.
// compact:   리스트 카드용 작은 버전. 기본: 상세 화면용.
// estimated: 대학 공식 환산표가 없어 표준 추정표(conversionMethod === 'standard')로
//            계산한 경우. 같은 게이지라도 근거가 약하므로 연하게 + '추정' 라벨을 붙인다.
//            기본값 false — 프롭을 안 넘기는 기존 호출부는 그대로 진한 색으로 동작한다.
export default function ChanceGauge({ chance, compact = false, estimated = false }) {
  if (!chance) return null;
  return (
    <div
      className={`gauge gauge-${chance.tone}${compact ? ' gauge-compact' : ''}${estimated ? ' gauge-estimated' : ''}`}
      title={
        estimated
          ? '이 대학은 검정고시 환산표를 공개하지 않아, 공개된 다른 대학 표의 중앙값으로 추정한 값이에요.'
          : '대학이 공개한 검정고시 환산표로 계산한 값이에요.'
      }
    >
      {/* 추정이면 막대를 연하게 — 공식 환산표 기반과 한눈에 구분되게 */}
      <div className="gauge-bars" style={estimated ? { opacity: 0.45 } : undefined}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`gauge-bar ${n <= chance.level ? 'on' : ''}`} />
        ))}
      </div>
      <span
        className="gauge-label"
        style={estimated ? { opacity: 0.68, fontWeight: 700 } : undefined}
      >
        {chance.label}
      </span>
      {estimated && (
        <span
          style={{
            fontSize: compact ? 10 : 10.5,
            fontWeight: 700,
            color: '#6B7280',
            background: '#F3F4F6',
            border: '1px solid #E5E7EB',
            borderRadius: 6,
            padding: '1px 4px',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          추정
        </span>
      )}
    </div>
  );
}
