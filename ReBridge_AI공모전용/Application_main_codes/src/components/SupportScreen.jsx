// SupportScreen — '지원' 탭 본문.
//   꿈드림센터마다 다른 지원(교통비·식사·교재·심리상담·진로멘토링 등)을
//   "카테고리별로 브라우징"하게 만들어 학생이 자기 혜택을 알게 한다.
//   정직성 원칙: 정리된 데이터가 없는 센터는 없는 척하지 않고 자물쇠/문의 폴백.
// props: goTo(screen, params), goBack()
import { useState, useMemo } from 'react';
import {
  ArrowLeft, MapPin, Phone, Map as MapIcon, Gift, Lock,
  Wallet, HeartHandshake, Compass, Users, GraduationCap, ChevronRight,
} from 'lucide-react';
import centersRaw from '../data/kkumdrim.json';
import { BENEFIT_CATEGORIES, getCenterBenefits, hasBenefits } from '../lib/benefits';
import '../styles.support.css';

// 카테고리 icon 이름 → lucide 컴포넌트 매핑
const BENEFIT_ICONS = { Wallet, HeartHandshake, Compass, Users, GraduationCap };

// 지역(시도) 목록 — kkumdrim.json의 region 활용. 카운트 함께.
const REGIONS = [
  '전체', '서울', '경기', '인천', '부산', '대구', '광주', '대전',
  '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const regionCount = centersRaw.reduce((acc, c) => {
  acc[c.region] = (acc[c.region] || 0) + 1;
  return acc;
}, {});

// 카테고리별로 "정리된 정보가 있는" 센터 수 (전체 기준)
const categoryCountAll = BENEFIT_CATEGORIES.reduce((acc, cat) => {
  acc[cat.id] = centersRaw.filter(
    (c) => hasBenefits(c) && c.benefits.includes(cat.id)
  ).length;
  return acc;
}, {});

// "이 센터가 주는 것" 칩 블록 (정직성 폴백 포함)
function BenefitChips({ center, highlightId }) {
  const { categories, note, known } = getCenterBenefits(center);

  if (!known) {
    return (
      <div className="support-benefit-block">
        <div className="support-benefit-locked">
          <Lock size={13} />
          <span>
            아직 정리된 정보가 없어요 · <b>센터에 직접 문의</b>해 확인해 주세요.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="support-benefit-block">
      <div className="support-benefit-chips">
        {categories.map((cat) => {
          const Icon = BENEFIT_ICONS[cat.icon];
          return (
            <span
              key={cat.id}
              className={`support-benefit-chip${cat.id === highlightId ? ' hit' : ''}`}
              title={cat.desc}
            >
              {Icon && <Icon size={12} />} {cat.label}
            </span>
          );
        })}
      </div>
      {note && <p className="support-benefit-note">{note}</p>}
      <p className="support-benefit-disclaimer">※ 정확한 대상·금액은 센터에 확인이 필요해요.</p>
    </div>
  );
}

export default function SupportScreen({ goTo = () => {}, goBack = () => {} }) {
  const [region, setRegion] = useState('전체');
  const [activeCat, setActiveCat] = useState(null); // 선택된 카테고리 id (null = 전체)
  const [openId, setOpenId] = useState(null);        // 펼쳐진 센터 카드

  // 지역으로 1차 필터
  const inRegion = useMemo(
    () => (region === '전체' ? centersRaw : centersRaw.filter((c) => c.region === region)),
    [region]
  );

  // 현재 지역 기준, 각 카테고리에 정리된 정보가 있는 센터 수
  const catCountInRegion = useMemo(() => {
    const acc = {};
    BENEFIT_CATEGORIES.forEach((cat) => {
      acc[cat.id] = inRegion.filter(
        (c) => hasBenefits(c) && c.benefits.includes(cat.id)
      ).length;
    });
    return acc;
  }, [inRegion]);

  // 표시할 센터 목록
  //  - 카테고리 선택 시: 그 혜택을 주는(정리된) 센터만
  //  - 미선택 시: 지역 내 전체 (정리된 센터를 위로 정렬해 정직하게 노출)
  const list = useMemo(() => {
    if (activeCat) {
      return inRegion.filter((c) => hasBenefits(c) && c.benefits.includes(activeCat));
    }
    return [...inRegion].sort((a, b) => Number(hasBenefits(b)) - Number(hasBenefits(a)));
  }, [inRegion, activeCat]);

  const knownCount = useMemo(() => inRegion.filter(hasBenefits).length, [inRegion]);

  return (
    <div className="screen support-screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">지원</span>
        <span style={{ width: 22 }} />
      </header>

      {/* 인트로 */}
      <div className="support-intro">
        <h2 className="support-intro-title">내 주변에서 받을 수 있는 지원</h2>
        <p className="support-intro-sub">
          꿈드림센터마다 주는 지원이 달라요. 카테고리로 골라 내가 받을 수 있는 혜택을 찾아보세요.
        </p>
      </div>

      {/* 지역(시도) 선택 */}
      <div className="support-region-scroll">
        {REGIONS.map((r) => (
          <button
            key={r}
            className={`support-region-chip${region === r ? ' active' : ''}`}
            onClick={() => { setRegion(r); setOpenId(null); }}
          >
            {r}
            {r !== '전체' && regionCount[r] && (
              <span className="support-chip-cnt"> {regionCount[r]}</span>
            )}
          </button>
        ))}
      </div>

      {/* 카테고리 브라우징 */}
      <div className="support-cat-grid">
        {BENEFIT_CATEGORIES.map((cat) => {
          const Icon = BENEFIT_ICONS[cat.icon];
          const cnt = catCountInRegion[cat.id] ?? categoryCountAll[cat.id];
          return (
            <button
              key={cat.id}
              className={`support-cat-card${activeCat === cat.id ? ' active' : ''}`}
              onClick={() => {
                setActiveCat(activeCat === cat.id ? null : cat.id);
                setOpenId(null);
              }}
            >
              <span className="support-cat-ico">{Icon && <Icon size={18} />}</span>
              <span className="support-cat-label">{cat.label}</span>
              <span className="support-cat-cnt">{cnt > 0 ? `${cnt}곳` : '정보 모으는 중'}</span>
            </button>
          );
        })}
      </div>

      {/* 결과 헤더 */}
      <div className="support-result-head">
        {activeCat ? (
          <p className="support-result-count">
            {BENEFIT_CATEGORIES.find((c) => c.id === activeCat)?.label} 지원 ·{' '}
            <b>{list.length}곳</b>
          </p>
        ) : (
          <p className="support-result-count">
            {region === '전체' ? '전국' : region} <b>{inRegion.length}곳</b>
            <span className="support-result-sub"> · 혜택 정리됨 {knownCount}곳</span>
          </p>
        )}
        <button className="support-map-link" onClick={() => goTo('dreamdrive')}>
          <MapIcon size={14} /> 지도에서 보기
        </button>
      </div>

      {/* 센터 목록 */}
      <div className="support-list">
        {list.length === 0 && (
          <div className="support-empty">
            <Lock size={18} />
            <p>이 조건에 정리된 센터가 아직 없어요.</p>
            <p className="support-empty-sub">
              지역을 바꾸거나, 전국 공통 상담 <b>1388</b>로 문의해 보세요.
            </p>
          </div>
        )}

        {list.map((c) => {
          const known = hasBenefits(c);
          const open = openId === c.id;
          return (
            <div
              key={c.id}
              className={`support-card${open ? ' open' : ''}${known ? '' : ' locked'}`}
              onClick={() => setOpenId(open ? null : c.id)}
            >
              <div className="support-card-head">
                <div className="support-card-left">
                  <div className="support-card-name">
                    {!known && <Lock size={13} className="support-card-lock" />}
                    {c.name}
                  </div>
                  <div className="support-card-meta">
                    <MapPin size={11} /> {c.region} {c.district}
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="support-card-chev"
                  style={{ transform: open ? 'rotate(90deg)' : 'none' }}
                />
              </div>

              {/* 접힌 상태에서도 혜택 칩 미리보기 (정리된 센터) */}
              {!open && (
                known ? (
                  <BenefitChips center={c} highlightId={activeCat} />
                ) : (
                  <div className="support-benefit-block">
                    <div className="support-benefit-locked">
                      <Lock size={13} />
                      <span>아직 정리된 정보가 없어요 · <b>센터에 직접 문의</b></span>
                    </div>
                  </div>
                )
              )}

              {/* 펼친 상세 */}
              {open && (
                <div className="support-card-body">
                  {c.address && <p className="support-card-address">{c.address}</p>}
                  <div className="support-benefit-head">
                    <Gift size={13} /> 이 센터가 주는 것
                  </div>
                  <BenefitChips center={c} highlightId={activeCat} />
                  <div className="support-actions">
                    {c.phone && (
                      <a
                        className="support-action-btn call"
                        href={`tel:${c.phone}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone size={14} /> {c.phone}
                      </a>
                    )}
                    <button
                      className="support-action-btn map"
                      onClick={(e) => { e.stopPropagation(); goTo('dreamdrive'); }}
                    >
                      <MapIcon size={14} /> 지도에서 보기
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="support-footer-note">
        <p>📞 전국 공통 상담 전화: <b>1388</b> (24시간)</p>
        <p>만 9~24세 학교 밖 청소년이라면 누구나 무료로 이용할 수 있어요.</p>
        <p className="support-source">
          혜택 정보는 센터별로 계속 채워가고 있어요. 비어 있는 곳은 직접 문의가 가장 정확해요.
        </p>
      </div>
    </div>
  );
}
