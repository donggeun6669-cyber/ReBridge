import { useState } from 'react';
import {
  ArrowLeft, Phone, Mail, Copy, Check, Globe, HeartHandshake, GraduationCap, Compass, Users,
  Activity, Wallet, ChevronRight,
} from 'lucide-react';
import { getCenter, shortName } from '../lib/centers.js';
import { getCenterBenefits } from '../lib/benefits.js';
import { threadForCenter } from '../lib/messages.js';
import '../styles.v3.css';

// 센터 상세 (PRD v2 F2·F3·F5 — 2026-09-26 시연판)
//   전화·쪽지는 화면 아래에 늘 붙어 있다(한 번에 연결 — F3 수용 기준).
//   홈페이지는 공식 CSV에 있는 곳만 보여주고, 없으면 없다고 말한다(지어내지 않는다).
//   '처음 가면' 순서는 0619 영등포 꿈드림 인터뷰(초기 상담 → 프로그램 안내)를 쉬운 말로 옮긴 것.

const ICONS = { HeartHandshake, GraduationCap, Compass, Users, Activity, Wallet };

export default function CenterDetailScreen({ goTo = () => {}, goBack = () => {}, centerId }) {
  const c = getCenter(centerId);
  const [copied, setCopied] = useState(false);

  if (!c) {
    return (
      <div className="screen v3-screen">
        <header className="v3-top">
          <button className="v3-icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
          <span className="v3-top-title">센터</span>
        </header>
        <div className="v3-empty"><b>센터 정보를 찾지 못했어요</b>목록에서 다시 골라 주세요.</div>
      </div>
    );
  }

  const { categories, note, known } = getCenterBenefits(c);
  const thread = threadForCenter(c.id);

  function copyAddress() {
    navigator.clipboard?.writeText(c.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  }

  return (
    <div className="screen v3-screen" style={{ paddingBottom: 0 }}>
      <header className="v3-top">
        <button className="v3-icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="v3-top-title" />
      </header>

      <div className="v3-detail-head">
        <span className="v3-tag green">{c.region} {c.district}</span>
        <h1 className="v3-detail-name">{shortName(c)}</h1>
        <p className="v3-detail-meta">{c.name}</p>
      </div>

      {thread && (
        <button type="button" className="v3-banner green" style={{ textAlign: 'left', width: 'calc(100% - 32px)' }}
          onClick={() => goTo('thread', { centerId: c.id })}>
          <Mail size={16} />
          <span style={{ flex: 1 }}>이 센터와 주고받은 쪽지가 있어요. <b>이어서 보기</b></span>
          <ChevronRight size={16} />
        </button>
      )}

      <h2 className="v3-sec-title">기본 정보</h2>
      <dl className="v3-list" style={{ margin: '0 16px' }}>
        <div className="v3-kv">
          <dt>주소</dt>
          <dd>
            {c.address}
            <button type="button" className="v3-tag" style={{ marginLeft: 6, border: 'none' }} onClick={copyAddress}>
              {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
            </button>
          </dd>
        </div>
        <div className="v3-kv">
          <dt>전화</dt>
          <dd><a href={`tel:${c.phone}`}>{c.phone}</a></dd>
        </div>
        <div className="v3-kv">
          <dt>홈페이지</dt>
          <dd>
            {c.homepage ? (
              <a href={c.homepage} target="_blank" rel="noopener noreferrer">
                <Globe size={13} style={{ verticalAlign: '-2px', marginRight: 3 }} />
                {c.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            ) : (
              <span style={{ color: 'var(--v3-ink-3)' }}>등록된 주소가 없어요. 전화나 쪽지로 물어봐 주세요.</span>
            )}
          </dd>
        </div>
      </dl>

      <h2 className="v3-sec-title">여기서 도와주는 것</h2>
      <div className="v3-list">
        {!known && (
          <div className="v3-empty">아직 정리된 정보가 없어요. 센터에 직접 물어봐 주세요.</div>
        )}
        {categories.map((cat) => {
          const Icon = ICONS[cat.icon];
          return (
            <div key={cat.id} className="v3-row">
              <span className="v3-row-ico green">{Icon && <Icon size={18} />}</span>
              <span className="v3-row-main">
                <span className="v3-row-title">{cat.label}</span>
                <span className="v3-row-sub">{cat.desc.replace(/\s*\((전국 공통|센터별 상이)\)/, '')}</span>
              </span>
              {/\(센터별 상이\)/.test(cat.desc) && <span className="v3-tag warn">센터마다 달라요</span>}
            </div>
          );
        })}
      </div>
      {note && <p className="v3-note">{note}</p>}
      <p className="v3-note">정확한 대상·일정은 센터에 확인해 주세요.</p>

      <h2 className="v3-sec-title">처음 가면 이렇게 돼요</h2>
      <div className="v3-card">
        <ol className="v3-steps">
          <li>전화나 쪽지로 먼저 물어보기<span>언제 가면 되는지, 뭘 챙기면 되는지 물어봐도 돼요.</span></li>
          <li>센터에서 선생님과 첫 상담<span>지금 어떤지 편하게 이야기 나누는 자리예요.</span></li>
          <li>나에게 맞는 프로그램 안내<span>검정고시·진로·상담 중 필요한 것부터 시작해요.</span></li>
        </ol>
      </div>
      <p className="v3-note">센터마다 진행 방식은 조금씩 달라요.</p>

      <div className="v3-sticky-cta">
        <a className="v3-btn ghost" href={`tel:${c.phone}`}><Phone size={17} /> 전화</a>
        <button type="button" className="v3-btn" style={{ flex: 2 }} onClick={() => goTo('thread', { centerId: c.id })}>
          <Mail size={17} /> 쪽지로 물어보기
        </button>
      </div>
    </div>
  );
}
