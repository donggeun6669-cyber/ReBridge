import { useEffect, useState } from 'react';
import { Sparkles, BookOpen, ChevronRight, Phone, Map, Globe, Send } from 'lucide-react';
import SyTop from './SyTop.jsx';
import { shortName, centerMark, distLabel, locationAllowed, requestPosition } from '../lib/centers.js';
import { homeFallbackCenter, nearestCenter, mapLink } from './bUtil.js';
import './sy-b.css';

// 꿈드림센터 홈 (시안: 꿈드림센터 홈.png)
//   ① 누구나 받을 수 있는 지원 소개 → 학습·검정고시 지원 상세로
//   ② 가장 가까운 센터 1곳 — 위치를 한 번 허용해 둔 적이 있으면 조용히 다시 받아 진짜 거리순으로,
//      없으면 사는 지역(홈 화면에서 고른 지역) 대표 센터를 보여준다(기존 CentersScreen과 같은 규칙).
//   ③ 센터에 쪽지 보내기 — 기존 messages.js 저장 로직으로 이어지는 SyMessageWrite(thread)로.
//
//   ⚠️ 시안의 '운영 중' 배지·'오늘 09:00-18:00' 영업시간은 실제 데이터(kkumdrim.json)에 없어
//      지어내지 않고 뺐다(이 앱의 정직성 원칙). 상세는 최종 보고에 적는다.
//   ⚠️ 지도 그림도 실제 지도(MAP_ENABLED=false)가 아니라 장식용이며,
//      '도보 24분'처럼 없는 이동시간 대신 실제 지역 표식을 보여준다.

export default function SyCenters({ goTo = () => {} }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!locationAllowed()) return;
    requestPosition().then((p) => { if (p) setPos(p); });
  }, []);

  const near = pos ? nearestCenter(pos) : null;
  const center = near || homeFallbackCenter();
  const centerName = center ? `${shortName(center)}센터` : '';
  const dist = pos && center?._dist != null && Number.isFinite(center._dist) ? distLabel(center._dist) : null;
  const link = center ? mapLink(center) : null;

  return (
    <div className="sy-screen">
      <SyTop title="꿈드림센터" />

      <section className="sy-b-hero">
        <span className="sy-b-hero-badge"><Sparkles size={13} /> 누구나 받을 수 있어요</span>
        <h1 className="sy-b-hero-title">상담부터 대학 준비까지</h1>
        <p className="sy-b-hero-sub">비용 없이 필요한 지원을 함께 찾아요.</p>
        <button
          type="button"
          className="sy-b-hero-row"
          onClick={() => goTo('support-detail', { supportId: 'study' })}
        >
          <span className="sy-b-hero-row-ico"><BookOpen size={18} /></span>
          <span className="sy-b-hero-row-main">
            <span className="sy-b-hero-row-title">학습·검정고시 지원</span>
            <span className="sy-b-hero-row-sub">교재, 강의, 학습 상담</span>
          </span>
          <ChevronRight size={18} />
        </button>
      </section>

      <div className="sy-b-section">
        <h2 className="sy-b-section-title">가장 가까운 센터</h2>
        <button type="button" className="sy-b-section-link" onClick={() => goTo('location-consent')}>
          다른 센터
        </button>
      </div>

      {center && (
        <>
          <div className="sy-b-center-card">
            <div className="sy-b-center-head">
              <div>
                <div className="sy-b-center-name">{centerName}</div>
                <div className="sy-b-center-meta">{dist || center.address}</div>
              </div>
            </div>

            <div className="sy-b-actions">
              <a className="sy-b-action" href={`tel:${center.phone}`}>
                <span className="sy-b-action-ico"><Phone size={18} /></span>
                전화
              </a>
              <a
                className={`sy-b-action${link ? '' : ' disabled'}`}
                href={link || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!link}
              >
                <span className="sy-b-action-ico"><Map size={18} /></span>
                지도
              </a>
              <a
                className={`sy-b-action${center.homepage ? '' : ' disabled'}`}
                href={center.homepage || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!center.homepage}
              >
                <span className="sy-b-action-ico"><Globe size={18} /></span>
                홈페이지
              </a>
            </div>
          </div>

          <button
            type="button"
            className="sy-b-map"
            aria-label="지도에서 보기"
            onClick={() => { if (link) window.open(link, '_blank', 'noopener'); }}
          >
            <span className="sy-b-map-road" style={{ top: '20%', transform: 'rotate(-8deg)' }} />
            <span className="sy-b-map-road" style={{ top: '52%', transform: 'rotate(6deg)' }} />
            <span className="sy-b-map-road" style={{ top: '82%', transform: 'rotate(-4deg)' }} />
            <span className="sy-b-map-dot" />
            <span className="sy-b-map-label">{centerMark(center)}</span>
          </button>

          <button type="button" className="sy-btn" style={{ marginTop: 16 }} onClick={() => goTo('thread', { centerId: center.id })}>
            <Send size={17} /> 센터에 쪽지 보내기
          </button>
        </>
      )}
    </div>
  );
}
