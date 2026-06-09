import { useState } from 'react';
import {
  Briefcase, Search, GraduationCap, BadgeCheck, Coins, HeartHandshake,
  ChevronDown, ExternalLink, Phone, ArrowUpRight,
} from 'lucide-react';
import { JOB_CATEGORIES, JOB_PROGRAMS } from '../data/jobData.js';
import '../styles.job.css';

const ICONS = { Briefcase, Search, GraduationCap, BadgeCheck, Coins, HeartHandshake };

export default function JobExploreScreen() {
  const [open, setOpen] = useState(null);

  return (
    <div className="screen">
      <header className="topbar">
        <span className="page-title">취업 정보</span>
      </header>

      {/* 고용정책 카테고리 */}
      <p className="job-sec-label">고용정책 한눈에</p>
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

      {/* 청년 지원 프로그램 */}
      <p className="job-sec-label" style={{ marginTop: 24 }}>
        청년 지원 프로그램 <span className="job-sec-count">{JOB_PROGRAMS.length}</span>
      </p>
      <div className="job-prog-list">
        {JOB_PROGRAMS.map((p) => (
          <a key={p.title} className="job-prog" href={p.url} target="_blank" rel="noopener noreferrer">
            <div className="job-prog-top">
              <div className="job-prog-tags">
                {p.badge && <span className="job-tag badge">{p.badge}</span>}
                {p.tags.map((t) => <span key={t} className="job-tag">{t}</span>)}
              </div>
              <ArrowUpRight size={16} className="job-prog-go" />
            </div>
            <span className="job-prog-title">{p.title}</span>
            <span className="job-prog-desc">{p.desc}</span>
          </a>
        ))}
      </div>

      <p className="note" style={{ marginTop: 20 }}>
        프로그램·자격 정보는 <b>공식 기관으로 바로 연결</b>해요. 정확한 자격·일정·금액은 해당 기관에서 확인해요.
      </p>
    </div>
  );
}
