// SupportScreen — '지원' 탭 본문.
//   1) 공통 지원: 대부분의 학교 밖 청소년이 공통으로 받을 수 있는 제도(상단 안내).
//   2) 꿈드림센터별 지원: 센터마다 다른 혜택을 지역·카테고리로 브라우징.
//   정직성 원칙: 정리된 데이터가 없는 센터는 없는 척하지 않고 자물쇠/문의 폴백.
//                지자체별로 다른 공통 지원은 "확인 필요"로 솔직하게 표기.
// props: goTo(screen, params), goBack()
import { useState, useMemo, useEffect } from 'react';
import {
  MapPin, Phone, Map as MapIcon, Gift, Lock, ChevronDown,
  Wallet, HeartHandshake, Compass, Users, GraduationCap, ChevronRight,
  BookOpen, ShieldCheck, AlertCircle, Activity, MessageCircle,
} from 'lucide-react';
import centersRaw from '../data/kkumdrim.json';
import { COMMON_SUPPORT } from '../data/commonSupport';
import { getCenterBenefits } from '../lib/benefits';
import { V1_UNIV_ONLY } from '../lib/persona.js';
import '../styles.support.css';

// 카테고리/공통지원 icon 이름 → lucide 컴포넌트 매핑
const ICONS = {
  Wallet, HeartHandshake, Compass, Users, GraduationCap,
  Phone, BookOpen, Activity,
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

export default function SupportScreen({ goTo = () => {}, goBack = () => {}, params = {} }) {
  const [region, setRegion] = useState(() => localStorage.getItem('spt-region') || '전체');
  const [openId, setOpenId] = useState(null);
  const [openCommon, setOpenCommon] = useState(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // 검색 결과에서 직접 진입 시 해당 공통지원 항목 자동 오픈
  useEffect(() => {
    if (params.supportId) setOpenCommon(params.supportId);
  }, [params.supportId]);

  // 지역 변경 + localStorage 저장
  const saveRegion = (r) => {
    localStorage.setItem('spt-region', r);
    resetView(() => setRegion(r));
  };

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

  const list = useMemo(() => inRegion, [inRegion]);
  const shown = list.slice(0, visible);
  const hasMore = visible < list.length;

  return (
    <div className="screen support-screen">
      <header className="topbar">
        <span className="page-title">지원 혜택</span>
      </header>

      {/* 공통지원 칩 슬라이더 — 항상 상단 표시 */}
      <div className="spt-comm-bar">
        <span className="spt-comm-bar-label"><ShieldCheck size={12} /> 공통 지원</span>
        <div className="spt-comm-chips">
          {COMMON_SUPPORT.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <button
                key={item.id}
                className={`spt-comm-chip${openCommon === item.id ? ' active' : ''}`}
                onClick={() => setOpenCommon(openCommon === item.id ? null : item.id)}
              >
                {Icon && <Icon size={12} />} {item.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택된 공통지원 상세 패널 */}
      {openCommon && (() => {
        const item = COMMON_SUPPORT.find((i) => i.id === openCommon);
        if (!item) return null;
        const Icon = ICONS[item.icon];
        return (
          <div className="spt-common-detail">
            <div className="spt-common-detail-head">
              {Icon && <Icon size={15} />}
              <span>{item.title}</span>
              <span className={`spt-common-card-badge${item.status === 'check' ? ' check' : ''}`}>
                {item.status === 'check' ? '확인 필요' : '공통'}
              </span>
            </div>
            <p className="spt-common-detail-summary">{item.summary}</p>
            <p className="spt-common-detail-body">{item.detail}</p>
            {item.action?.tel && (
              <a className="support-action-btn call" href={`tel:${item.action.tel}`}>
                <Phone size={14} /> {item.action.label}
              </a>
            )}
            <p className="spt-honest-note" style={{ marginTop: 8 }}>
              <AlertCircle size={11} /> 지자체·시기별로 달라요. 거주지 센터 확인이 가장 정확해요.
            </p>
          </div>
        );
      })()}

      {/* 내 지역 센터 헤더 + 지역 칩 */}
      <div className="spt-local-header">
        <span className="spt-local-title"><MapPin size={13} /> 내 지역 센터</span>
      </div>
      <div className="support-region-scroll">
        {REGIONS.map((r) => (
          <button
            key={r}
            className={`support-region-chip${region === r ? ' active' : ''}`}
            onClick={() => saveRegion(r)}
          >
            {r}
            {r !== '전체' && regionCount[r] && (
              <span className="support-chip-cnt"> {regionCount[r]}</span>
            )}
          </button>
        ))}
      </div>

      {/* 결과 헤더 */}
      <div className="support-result-head">
        <p className="support-result-count">
          {region === '전체' ? '전국' : region} <b>{list.length}곳</b>
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* 후기(커뮤니티) — v1에서는 커뮤니티를 숨기므로 함께 감춘다 */}
          {!V1_UNIV_ONLY && (
            <button className="support-map-link" onClick={() => goTo('community', { board: 'review' })}>
              <MessageCircle size={14} /> 후기
            </button>
          )}
          <button className="support-map-link" onClick={() => goTo('dreamdrive')}>
            <MapIcon size={14} /> 지도
          </button>
        </div>
      </div>

      {/* 센터 목록 */}
      <div className="support-list">
        {shown.map((c) => {
          const open = openId === c.id;
          return (
            <div
              key={c.id}
              className={`support-card${open ? ' open' : ''}`}
              onClick={() => setOpenId(open ? null : c.id)}
            >
              <div className="support-card-head">
                <div className="support-card-left">
                  <div className="support-card-name">{c.name}</div>
                  <div className="support-card-meta">
                    <MapPin size={11} /> {c.region} {c.district}
                  </div>
                </div>
                <div className="spt-card-actions">
                  {c.phone && (
                    <a
                      className="spt-phone-btn"
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      title={c.phone}
                    >
                      <Phone size={15} />
                    </a>
                  )}
                  <ChevronRight
                    size={18}
                    className="support-card-chev"
                    style={{ transform: open ? 'rotate(90deg)' : 'none' }}
                  />
                </div>
              </div>
              {!open && <BenefitChips center={c} highlightId={null} />}
              {open && (
                <div className="support-card-body">
                  {c.address && <p className="support-card-address">{c.address}</p>}
                  <div className="support-benefit-head"><Gift size={13} /> 이 센터가 주는 것</div>
                  <BenefitChips center={c} highlightId={null} />
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
                      onClick={(e) => { e.stopPropagation(); goTo('dreamdrive', { centerId: c.id }); }}
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

      {/* 더보기 */}
      {hasMore && (
        <div className="support-pager">
          <button className="support-more-btn" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            더보기 ({shown.length}/{list.length}) <ChevronDown size={16} />
          </button>
        </div>
      )}

      <div className="spt-footer-note" style={{ margin: '12px 16px 32px' }}>
        <p>전국 공통 상담 전화: <b>1388</b> (24시간 · 무료)</p>
        <p>만 9~24세 학교 밖 청소년이라면 누구나 이용할 수 있어요.</p>
      </div>

    </div>
  );
}
