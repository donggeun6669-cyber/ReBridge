import { useMemo, useState } from 'react';
import {
  Briefcase, Search, GraduationCap, BadgeCheck, Coins, HeartHandshake,
  ChevronDown, ChevronRight, ExternalLink, Phone, Sparkles,
} from 'lucide-react';
import { JOB_CATEGORIES, matchPrograms, matchReason } from '../data/jobData.js';
import { loadProfile } from '../lib/persona.js';
import '../styles.job.css';

const ICONS = { Briefcase, Search, GraduationCap, BadgeCheck, Coins, HeartHandshake };

export default function JobExploreScreen({ goTo = () => {} }) {
  const jp = useMemo(() => loadProfile()?.jobProfile || null, []);
  const { recommended, rest } = useMemo(() => matchPrograms(jp), [jp]);
  const reason = matchReason(jp);
  const [open, setOpen] = useState(null);

  function ProgCard(p) {
    return (
      <button
        key={p.id}
        className="job-prog"
        onClick={() => goTo('job-detail', { id: p.id })}
      >
        <div className="job-prog-top">
          <div className="job-prog-tags">
            {p.badge && <span className="job-tag badge">{p.badge}</span>}
            {p.tags.map((t) => <span key={t} className="job-tag">{t}</span>)}
          </div>
          <ChevronRight size={16} className="job-prog-go" />
        </div>
        <span className="job-prog-title">{p.title}</span>
        <span className="job-prog-desc">{p.desc}</span>
        {p.plain && <span className="job-prog-plain">{p.plain}</span>}
      </button>
    );
  }

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">취업 정보</span>
      </header>

      {/* 맞춤 추천 — 앱 안에서 설명, 신청만 외부 */}
      <p className="job-sec-label">
        <Sparkles size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
        {jp ? '나에게 맞는 것부터' : '이런 지원이 있어요'}
      </p>
      {reason && <p className="job-reason">{reason}</p>}
      <div className="job-prog-list">
        {recommended.map(ProgCard)}
      </div>

      {/* 나머지 프로그램 */}
      {rest.length > 0 && (
        <>
          <p className="job-sec-label" style={{ marginTop: 24 }}>
            다른 지원도 둘러보기 <span className="job-sec-count">{rest.length}</span>
          </p>
          <div className="job-prog-list">
            {rest.map(ProgCard)}
          </div>
        </>
      )}

      {/* 공식 포털 빠른 연결 (검색·접수형 포털) */}
      <p className="job-sec-label" style={{ marginTop: 24 }}>공식 포털 바로가기</p>
      <div className="job-cat-grid">
        {JOB_CATEGORIES.map((c) => {
          const Icon = ICONS[c.icon] || Briefcase;
          const isOpen = open === c.key;
          return (
            <div key={c.key} className={`job-cat ${isOpen ? 'open' : ''}`}>
              <button className="job-cat-head" onClick={() => setOpen(isOpen ? null : c.key)}>
                <span className={`job-cat-ico ico-${c.color}`}><Icon size={20} /></span>
                <span className="job-cat-text">
                  <span className="job-cat-title">{c.title}</span>
                  <span className="job-cat-desc">{c.desc}</span>
                </span>
                <ChevronDown size={18} className="job-cat-chev" />
              </button>
              {isOpen && (
                <div className="job-cat-links">
                  {c.links.map((l) => (
                    l.tel ? (
                      <a key={l.label} className="job-link" href={`tel:${l.tel}`}>
                        <span className="job-link-body">
                          <span className="job-link-label">{l.label}</span>
                          <span className="job-link-host">{l.host}</span>
                        </span>
                        <Phone size={15} />
                      </a>
                    ) : (
                      <a key={l.label} className="job-link" href={l.url} target="_blank" rel="noopener noreferrer">
                        <span className="job-link-body">
                          <span className="job-link-label">{l.label}</span>
                          <span className="job-link-host">{l.host}</span>
                        </span>
                        <ExternalLink size={15} />
                      </a>
                    )
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="note" style={{ marginTop: 20 }}>
        프로그램 설명은 <b>앱 안에서</b> 안내하고, 실제 신청·접수만 공식 기관으로 연결해요.
        정확한 자격·일정·금액은 신청 화면에서 확인해요.
      </p>
    </div>
  );
}
