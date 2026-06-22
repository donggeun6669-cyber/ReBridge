// SupportScreen — '지원' 탭 본문.
//   1) 공통 지원: 대부분의 학교 밖 청소년이 공통으로 받을 수 있는 제도(상단 안내).
//   2) 꿈드림센터별 지원: 센터마다 다른 혜택을 지역·카테고리로 브라우징.
//   정직성 원칙: 정리된 데이터가 없는 센터는 없는 척하지 않고 자물쇠/문의 폴백.
//                지자체별로 다른 공통 지원은 "확인 필요"로 솔직하게 표기.
// props: goTo(screen, params), goBack()
import { useState, useMemo } from 'react';
import {
  MapPin, Phone, Map as MapIcon, Gift, Lock, ChevronDown,
  Wallet, HeartHandshake, Compass, Users, GraduationCap, ChevronRight,
  BookOpen, ShieldCheck, AlertCircle, Filter,
} from 'lucide-react';
import centersRaw from '../data/kkumdrim.json';
import { COMMON_SUPPORT } from '../data/commonSupport';
import { BENEFIT_CATEGORIES, getCenterBenefits, hasBenefits } from '../lib/benefits';
import '../styles.support.css';

// 카테고리/공통지원 icon 이름 → lucide 컴포넌트 매핑
const ICONS = {
  Wallet, HeartHandshake, Compass, Users, GraduationCap,
  Phone, BookOpen,
};

// 한 번에 보여줄 센터 수 (더보기 단위)
const PAGE_SIZE = 12;

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

// ── 공통 지원 카드 ────────────────────────────────────────────────────
function CommonSupportCard({ item, open, onToggle }) {
  const Icon = ICONS[item.icon];
  const isCheck = item.status === 'check';
  return (
    <div className={`support-common-card${open ? ' open' : ''}`} onClick={onToggle}>
      <div className="support-common-head">
        <span className="support-common-ico">{Icon && <Icon size={16} />}</span>
        <div className="support-common-text">
          <div className="support-common-title">
            {item.title}
            <span className={`support-common-badge${isCheck ? ' check' : ' ok'}`}>
              {isCheck ? <AlertCircle size={11} /> : <ShieldCheck size={11} />}
              {isCheck ? '확인 필요' : '공통'}
            </span>
          </div>
          <p className="support-common-summary">{item.summary}</p>
        </div>
        <ChevronDown
          size={16}
          className="support-common-chev"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </div>
      {open && (
        <div className="support-common-body">
          <p className="support-common-detail">{item.detail}</p>
          {item.action?.tel && (
            <a
              className="support-action-btn call"
              href={`tel:${item.action.tel}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Phone size={14} /> {item.action.label}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

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
          const Icon = ICONS[cat.icon];
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
  const [activeCat, setActiveCat] = useState(null);  // 선택된 카테고리 id (null = 전체)
  const [knownOnly, setKnownOnly] = useState(false);  // '혜택 정리된 센터만' 토글
  const [openId, setOpenId] = useState(null);         // 펼쳐진 센터 카드
  const [openCommon, setOpenCommon] = useState(null); // 펼쳐진 공통지원 카드
  const [visible, setVisible] = useState(PAGE_SIZE);  // 페이지네이션(더보기)

  // 필터/지역 바뀌면 페이지·열린 카드 초기화
  function resetView(extra) {
    setOpenId(null);
    setVisible(PAGE_SIZE);
    extra?.();
  }

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
  //  - '혜택 정리된 센터만' 토글 시: 정리된 센터만
  //  - 그 외: 지역 내 전체 (정리된 센터를 위로 정렬해 정직하게 노출)
  const list = useMemo(() => {
    if (activeCat) {
      return inRegion.filter((c) => hasBenefits(c) && c.benefits.includes(activeCat));
    }
    if (knownOnly) {
      return inRegion.filter(hasBenefits);
    }
    return [...inRegion].sort((a, b) => Number(hasBenefits(b)) - Number(hasBenefits(a)));
  }, [inRegion, activeCat, knownOnly]);

  const knownCount = useMemo(() => inRegion.filter(hasBenefits).length, [inRegion]);
  const shown = list.slice(0, visible);
  const hasMore = visible < list.length;

  return (
    <div className="screen support-screen">
      <header className="topbar">
        <span className="page-title">지원</span>
      </header>

      {/* 인트로 */}
      <div className="support-intro">
        <h2 className="support-intro-title">내가 받을 수 있는 지원</h2>
        <p className="support-intro-sub">
          누구나 받을 수 있는 공통 지원부터, 내 주변 꿈드림센터의 혜택까지 한 곳에서 찾아보세요.
        </p>
      </div>

      {/* ── 공통 지원 섹션 ── */}
      <section className="support-section">
        <div className="support-section-head">
          <h3 className="support-section-title">
            <ShieldCheck size={15} /> 공통 지원
          </h3>
          <span className="support-section-sub">대부분 받을 수 있어요</span>
        </div>
        <div className="support-common-list">
          {COMMON_SUPPORT.map((item) => (
            <CommonSupportCard
              key={item.id}
              item={item}
              open={openCommon === item.id}
              onToggle={() => setOpenCommon(openCommon === item.id ? null : item.id)}
            />
          ))}
        </div>
        <p className="support-common-honest">
          <AlertCircle size={12} /> ‘확인 필요’ 표시는 지자체·센터·시기별로 달라요. 거주지 센터 확인이 가장 정확해요.
        </p>
      </section>

      {/* ── 센터별 지원 섹션 ── */}
      <section className="support-section">
        <div className="support-section-head">
          <h3 className="support-section-title">
            <Gift size={15} /> 우리 동네 센터 지원
          </h3>
          <span className="support-section-sub">센터마다 달라요</span>
        </div>

        {/* 지역(시도) 선택 */}
        <div className="support-region-scroll">
          {REGIONS.map((r) => (
            <button
              key={r}
              className={`support-region-chip${region === r ? ' active' : ''}`}
              onClick={() => resetView(() => setRegion(r))}
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
            const Icon = ICONS[cat.icon];
            const cnt = catCountInRegion[cat.id] ?? categoryCountAll[cat.id];
            return (
              <button
                key={cat.id}
                className={`support-cat-card${activeCat === cat.id ? ' active' : ''}`}
                onClick={() => resetView(() => setActiveCat(activeCat === cat.id ? null : cat.id))}
              >
                <span className="support-cat-ico">{Icon && <Icon size={18} />}</span>
                <span className="support-cat-label">{cat.label}</span>
                <span className="support-cat-cnt">{cnt > 0 ? `${cnt}곳` : '정보 모으는 중'}</span>
              </button>
            );
          })}
        </div>

        {/* '혜택 정리된 센터만' 토글 (카테고리 선택 중이면 비활성 — 이미 정리된 센터만 나옴) */}
        <button
          className={`support-known-toggle${knownOnly ? ' on' : ''}${activeCat ? ' disabled' : ''}`}
          disabled={!!activeCat}
          onClick={() => resetView(() => setKnownOnly((v) => !v))}
        >
          <Filter size={13} />
          혜택 정리된 센터만 보기
          <span className="support-known-state">{activeCat || knownOnly ? 'ON' : 'OFF'}</span>
        </button>

        {/* 결과 헤더 */}
        <div className="support-result-head">
          {activeCat ? (
            <p className="support-result-count">
              {BENEFIT_CATEGORIES.find((c) => c.id === activeCat)?.label} 지원 ·{' '}
              <b>{list.length}곳</b>
            </p>
          ) : (
            <p className="support-result-count">
              {region === '전체' ? '전국' : region} <b>{list.length}곳</b>
              {!knownOnly && (
                <span className="support-result-sub"> · 혜택 정리됨 {knownCount}곳</span>
              )}
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

          {shown.map((c) => {
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

        {/* 더보기 / 페이지 안내 */}
        {list.length > 0 && (
          <div className="support-pager">
            {hasMore ? (
              <button
                className="support-more-btn"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              >
                더보기 ({shown.length}/{list.length})
                <ChevronDown size={16} />
              </button>
            ) : (
              list.length > PAGE_SIZE && (
                <p className="support-pager-end">{list.length}곳 모두 표시했어요</p>
              )
            )}
          </div>
        )}
      </section>

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
