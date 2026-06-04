import { useState, useMemo } from 'react';
import { ArrowLeft, Phone, Globe, MapPin, ChevronRight, BookOpen, Briefcase, Heart, Users, Music } from 'lucide-react';
import centers from '../data/kkumdrim.json';

// 프로그램 → 아이콘 매핑
const PROG_ICON = {
  '검정고시 준비반': BookOpen,
  '직업훈련': Briefcase,
  '직업교육': Briefcase,
  '직업체험': Briefcase,
  '자립지원': Heart,
  '자립생활 지원': Heart,
  '심리상담': Heart,
  '심리·정서 지원': Heart,
  '심리·정서': Heart,
  '문화체험': Music,
  '문화활동': Music,
  '문화·예술': Music,
  '문화·여가': Music,
  '멘토링': Users,
};

const PROG_COLOR = {
  BookOpen:  { bg: 'var(--brand-tint)', color: 'var(--brand-deep)' },
  Briefcase: { bg: '#dcfce7',           color: '#15803d' },
  Heart:     { bg: '#ffe4e6',           color: '#be123c' },
  Music:     { bg: '#fef9c3',           color: '#a16207' },
  Users:     { bg: '#f0f9ff',           color: '#0369a1' },
};

function getIcon(prog) {
  for (const [k, Icon] of Object.entries(PROG_ICON)) {
    if (prog.includes(k.replace('...','')) || k.includes(prog.split(' ')[0])) return Icon;
  }
  return Users;
}

// 지역 목록 (순서 고정)
const REGIONS = ['전체', '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

// 지원 프로그램 통계
function buildStats(list) {
  const counts = {};
  for (const c of list) {
    for (const p of c.programs) {
      counts[p] = (counts[p] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
}

export default function DreamdriveScreen({ goTo = () => {}, goBack = () => {} }) {
  const [region, setRegion] = useState('전체');
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() =>
    region === '전체' ? centers : centers.filter((c) => c.region === region),
    [region]
  );

  const stats = useMemo(() => buildStats(filtered), [filtered]);

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">꿈드림센터 찾기</span>
      </header>

      {/* 소개 배너 */}
      <div className="kdream-hero">
        <div className="kdream-hero-emoji">🏫</div>
        <div>
          <div className="kdream-hero-title">학교 밖 청소년 지원센터</div>
          <div className="kdream-hero-sub">
            검정고시 준비부터 취업·자립까지<br />
            전국 꿈드림센터에서 무료로 지원받을 수 있어요.
          </div>
        </div>
      </div>

      {/* 지원 프로그램 현황 */}
      {stats.length > 0 && (
        <div className="kdream-section">
          <h3 className="kdream-section-title">
            {region === '전체' ? '전국' : region} 지원 프로그램 현황
          </h3>
          <div className="kdream-stats-grid">
            {stats.map(([prog, count]) => {
              const Icon = getIcon(prog);
              const style = PROG_COLOR[Icon.displayName || Icon.name] || PROG_COLOR.Users;
              return (
                <div key={prog} className="kdream-stat-card" style={{ background: style.bg }}>
                  <Icon size={18} color={style.color} />
                  <span className="kdream-stat-label" style={{ color: style.color }}>{prog}</span>
                  <span className="kdream-stat-count" style={{ color: style.color }}>{count}개소</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 지역 필터 */}
      <div className="kdream-region-scroll">
        {REGIONS.map((r) => (
          <button
            key={r}
            className={`fchip kdream-region-chip${region === r ? ' active' : ''}`}
            onClick={() => { setRegion(r); setExpanded(null); }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* 센터 목록 */}
      <div className="kdream-section">
        <p className="result-filtered-count">{filtered.length}개 센터</p>
        <div className="kdream-list">
          {filtered.map((c) => {
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className={`kdream-card${isOpen ? ' open' : ''}`}>
                {/* 헤더 — 클릭 시 열기/닫기 */}
                <button className="kdream-card-header" onClick={() => setExpanded(isOpen ? null : c.id)}>
                  <div className="kdream-card-left">
                    <div className="kdream-card-name">{c.name}</div>
                    <div className="kdream-card-meta">
                      <MapPin size={11} /> {c.region} {c.district}
                    </div>
                  </div>
                  <ChevronRight size={16} className={`kdream-chevron${isOpen ? ' open' : ''}`} />
                </button>

                {/* 펼쳐진 상세 */}
                {isOpen && (
                  <div className="kdream-card-body">
                    <p className="kdream-card-address">{c.address}</p>
                    {c.hours && (
                      <p className="kdream-card-hours">⏰ {c.hours}</p>
                    )}
                    {c.note && <p className="kdream-card-note">{c.note}</p>}

                    {/* 프로그램 칩들 */}
                    <div className="kdream-prog-chips">
                      {c.programs.map((prog) => {
                        const Icon = getIcon(prog);
                        return (
                          <span key={prog} className="kdream-prog-chip">
                            <Icon size={11} /> {prog}
                          </span>
                        );
                      })}
                    </div>

                    {/* 연락처 버튼 */}
                    <div className="kdream-actions">
                      <a className="kdream-action-btn call" href={`tel:${c.phone}`}>
                        <Phone size={14} /> {c.phone}
                      </a>
                      {c.website && (
                        <a
                          className="kdream-action-btn web"
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe size={14} /> 홈페이지
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 안내 footer */}
      <div className="kdream-footer-note">
        <p>📞 전국 공통 상담 전화: <b>1388</b> (24시간)</p>
        <p>꿈드림 서비스는 만 9~24세 학교 밖 청소년이라면 무료로 이용할 수 있어요.</p>
      </div>
    </div>
  );
}
