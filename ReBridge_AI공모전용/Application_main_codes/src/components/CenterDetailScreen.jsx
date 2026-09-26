import { useState } from 'react';
import {
  ArrowLeft, Phone, Mail, Copy, Check, Globe, HeartHandshake, GraduationCap, Compass, Users,
  Activity, School, ChevronRight, ChevronDown, Info,
} from 'lucide-react';
import { getCenter, shortName, centerMark } from '../lib/centers.js';
import { threadForCenter } from '../lib/messages.js';
import { DREAM_SERVICES } from '../data/dreamServices.js';
import '../styles.v3.css';

// 센터 상세 (PRD v2 F2·F3·F5 — 2026-09-26 시연판)
//   전화·쪽지는 화면 아래에 늘 붙어 있다(한 번에 연결 — F3 수용 기준).
//   홈페이지는 공식 CSV에 있는 곳만 보여주고, 없으면 없다고 말한다(지어내지 않는다).
//   '처음 가면' 순서는 0619 영등포 꿈드림 인터뷰(초기 상담 → 프로그램 안내)를 쉬운 말로 옮긴 것.

const ICONS = { HeartHandshake, GraduationCap, School, Compass, Users, Activity };

export default function CenterDetailScreen({ goTo = () => {}, goBack = () => {}, centerId }) {
  const c = getCenter(centerId);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState('study');

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

  const thread = threadForCenter(c.id);
  // 센터별 부연(서울·부산·경기 3곳만 있음). 나머지 219곳은 '법령상 공통 제공' 문구라 보여줄 필요가 없다.
  const localNote = c.benefitNote && !c.benefitNote.startsWith('법령에 따라') ? c.benefitNote : null;

  function copyAddress() {
    navigator.clipboard?.writeText(c.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  }

  return (
    <div className="screen v3-screen">
      <header className="v3-top">
        <button className="v3-icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="v3-top-title" />
      </header>

      <div className="v3-detail-head" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span className="v3-cav lg" aria-hidden="true">{centerMark(c)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="v3-dream-logo" style={{ background: 'var(--v3-green-soft)', height: 22, fontSize: 12 }}>꿈드림</span>
          <h1 className="v3-detail-name" style={{ margin: '6px 0 2px' }}>{shortName(c)}</h1>
          <p className="v3-detail-meta">{c.name}</p>
        </span>
      </div>

      {/* 쪽지가 이 센터로 이어진다는 걸 먼저 보여준다 (2026-09-26 2차 — 동근님: 연계되는 느낌이 부족) */}
      <div className="v3-card" style={{ borderColor: '#CFE5D9', background: '#FBFDFC' }}>
        <div className="v3-card-body">
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>이 센터 선생님께 바로 물어볼 수 있어요</p>
          <p className="v3-lead" style={{ fontSize: 14, marginTop: 4 }}>
            쪽지는 {shortName(c)} 선생님이 읽고 답해요. 이름 대신 부를 이름만 있으면 돼요.
          </p>
          <div className="v3-btn-row" style={{ marginTop: 12 }}>
            <button type="button" className="v3-btn" style={{ flex: 2 }} onClick={() => goTo('thread', { centerId: c.id })}>
              <Mail size={16} /> {thread ? '쪽지 이어서 보기' : '쪽지 보내기'}
            </button>
            <a className="v3-btn ghost" href={`tel:${c.phone}`}><Phone size={16} /> 전화</a>
          </div>
        </div>
      </div>


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

      <h2 className="v3-sec-title">
        여기서 받을 수 있는 것
        <small>눌러서 자세히</small>
      </h2>
      <div className="v3-list">
        {DREAM_SERVICES.map((sv) => {
          const Icon = ICONS[sv.icon];
          const on = open === sv.id;
          return (
            <div key={sv.id} className="v3-acc">
              <button type="button" className="v3-row" aria-expanded={on} onClick={() => setOpen(on ? null : sv.id)}>
                <span className="v3-row-ico green">{Icon && <Icon size={18} />}</span>
                <span className="v3-row-main">
                  <span className="v3-row-title">{sv.title}</span>
                  <span className="v3-row-sub">{sv.short}</span>
                </span>
                <span className="v3-row-end">{on ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
              </button>
              {on && (
                <div className="v3-acc-body">
                  {sv.items.map((it) => (
                    <div key={it.t} className="v3-acc-item"><b>{it.t}</b><span>{it.d}</span></div>
                  ))}
                  {sv.note && <p className="v3-acc-note">{sv.note}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {localNote && (
        <div className="v3-banner green" style={{ marginTop: 10 }}>
          <Info size={15} /><span>{localNote}</span>
        </div>
      )}
      <p className="v3-note">
        꿈드림센터가 공통으로 하는 일이에요(여성가족부 「학교 밖 청소년 지원 안내서」). 이 센터에서 지금 하는 프로그램은 쪽지나 전화로 물어봐 주세요.
      </p>

      <h2 className="v3-sec-title">처음 가면 이렇게 돼요</h2>
      <div className="v3-card">
        <ol className="v3-steps">
          <li>전화나 쪽지로 먼저 물어보기<span>언제 가면 되는지, 뭘 챙기면 되는지 물어봐도 돼요.</span></li>
          <li>센터에서 선생님과 첫 상담<span>지금 어떤지 편하게 이야기 나누는 자리예요.</span></li>
          <li>나에게 맞는 프로그램 안내<span>검정고시·진로·상담 중 필요한 것부터 시작해요.</span></li>
        </ol>
      </div>
      <p className="v3-note">센터마다 진행 방식은 조금씩 달라요.</p>

      {/* 위 카드와 같은 버튼을 아래에 또 고정하면 겹쳐 보여서(2026-09-26 2차) 끝에 한 번만 둔다 */}
      <div style={{ padding: '18px 16px 8px' }}>
        <button type="button" className="v3-btn block" onClick={() => goTo('thread', { centerId: c.id })}>
          <Mail size={17} /> {shortName(c)} 선생님께 쪽지 보내기
        </button>
      </div>
    </div>
  );
}
