import { ArrowLeft, ShieldCheck, FileText, Mail } from 'lucide-react';
import {
  PRIVACY_POLICY, TERMS, POLICY_CONTACT, POLICY_EFFECTIVE,
} from '../data/policies.js';
import '../styles.policy.css';

// 개인정보처리방침 / 이용약관 — 원문은 src/data/policies.js 한 곳에만 둔다.
// params.doc 으로 어느 문서를 그릴지 정한다: 'privacy' | 'terms'

// 본문 안의 **강조** 만 처리하는 최소 파서. 마크다운 라이브러리를 들일 이유가 없다.
function Emphasized({ text }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) => (
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      ))}
    </>
  );
}

export default function PolicyScreen({ doc = 'privacy', goBack = () => {} }) {
  const isPrivacy = doc !== 'terms';
  const data = isPrivacy ? PRIVACY_POLICY : TERMS;
  const Icon = isPrivacy ? ShieldCheck : FileText;

  const hasContact = Boolean(POLICY_CONTACT.email);

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">{data.title}</span>
      </header>

      <div className="pol-hero">
        <span className="pol-hero-ico"><Icon size={20} /></span>
        <p className="pol-hero-lead">{data.lead}</p>
      </div>

      {data.sections.map((s) => (
        <section className="pol-section" key={s.h}>
          <h2 className="pol-h">{s.h}</h2>

          {s.p?.map((para) => (
            <p className="pol-p" key={para}><Emphasized text={para} /></p>
          ))}

          {s.ul && (
            <ul className="pol-ul">
              {s.ul.map((li) => (
                <li key={li}><Emphasized text={li} /></li>
              ))}
            </ul>
          )}

          {/* 처리위탁·국외이전 표 */}
          {s.table && (
            <div className="pol-table">
              {s.table.map((row) => (
                <div className="pol-table-row" key={row.name}>
                  <span className="pol-table-name">{row.name}</span>
                  <span className="pol-table-role">{row.role}</span>
                  <span className="pol-table-place">{row.place}</span>
                </div>
              ))}
            </div>
          )}

          {s.after && <p className="pol-after">{s.after}</p>}
        </section>
      ))}

      {/* 문의처 — 아직 정해지지 않았으면 있는 척하지 않는다 */}
      <section className="pol-section">
        <h2 className="pol-h">문의</h2>
        {hasContact ? (
          <div className="pol-contact">
            {POLICY_CONTACT.owner && (
              <p className="pol-p">운영: {POLICY_CONTACT.owner}</p>
            )}
            {POLICY_CONTACT.manager && (
              <p className="pol-p">개인정보 보호책임자: {POLICY_CONTACT.manager}</p>
            )}
            <a className="pol-mail" href={`mailto:${POLICY_CONTACT.email}`}>
              <Mail size={15} />
              {POLICY_CONTACT.email}
            </a>
          </div>
        ) : (
          <p className="pol-p pol-muted">
            문의 창구를 준비하고 있어요. 급한 도움이 필요하면 청소년전화 <b>1388</b>이나
            가까운 꿈드림센터로 연락해 주세요.
          </p>
        )}
      </section>

      <p className="pol-effective">시행일: {POLICY_EFFECTIVE}</p>
    </div>
  );
}
