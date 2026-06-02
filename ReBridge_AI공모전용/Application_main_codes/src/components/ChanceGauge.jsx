// 칸수式 합격 가능성 게이지 (5칸). admissionChance(ev) 결과를 받아 렌더.
// compact: 리스트 카드용 작은 버전. 기본: 상세 화면용.
export default function ChanceGauge({ chance, compact = false }) {
  if (!chance) return null;
  return (
    <div className={`gauge gauge-${chance.tone}${compact ? ' gauge-compact' : ''}`}>
      <div className="gauge-bars">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`gauge-bar ${n <= chance.level ? 'on' : ''}`} />
        ))}
      </div>
      <span className="gauge-label">{chance.label}</span>
    </div>
  );
}
