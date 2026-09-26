import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ChevronDown, ChevronRight, Check, Phone, Globe, HeartHandshake, GraduationCap,
  School, Compass, Users, Activity, Mail,
} from 'lucide-react';
import { DREAM_ABOUT, DREAM_SERVICES } from '../data/dreamServices.js';
import { CENTERS } from '../lib/centers.js';
import '../styles.v3.css';

// 꿈드림 알아보기 (2026-09-26 동근님: "꿈드림이라는 단체를 UI가 좀 더 강조해 줬으면")
//   ① 꿈드림이 어떤 곳인지(법으로 만든 공공기관 · 전국 몇 곳 · 누구나 무료)
//   ② 누가 갈 수 있는지 ③ 무엇을 해 주는지(펼쳐 보기) ④ 어떻게 연락하는지
//   내용 출처는 data/dreamServices.js (여성가족부 「학교 밖 청소년 지원 안내서」).

const ICONS = { HeartHandshake, GraduationCap, School, Compass, Users, Activity };

export default function AboutDreamScreen({ goTo = () => {}, goBack = () => {}, open: openInit = null }) {
  const [open, setOpen] = useState(openInit);
  const refs = useRef({});

  useEffect(() => {
    if (openInit && refs.current[openInit]) {
      setTimeout(() => refs.current[openInit]?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
    }
  }, [openInit]);

  return (
    <div className="screen v3-screen">
      <header className="v3-top">
        <button className="v3-icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="v3-top-title">꿈드림 알아보기</span>
      </header>

      {/* ① 꿈드림이 어떤 곳인지 */}
      <section className="v3-dream-hero">
        <span className="v3-dream-logo" aria-hidden="true">꿈드림</span>
        <h1 className="v3-dream-hero-title">학교 밖 청소년을 위한<br />공공 지원센터예요</h1>
        <p className="v3-dream-hero-sub">{DREAM_ABOUT.law}</p>
        <div className="v3-dream-facts">
          <span><b>{CENTERS.length}곳</b>전국 센터</span>
          <span><b>{DREAM_ABOUT.age}</b>이용 나이</span>
          <span><b>무료</b>이용 비용</span>
        </div>
      </section>

      {/* ② 누가 */}
      <h2 className="v3-sec-title">누가 갈 수 있어요?</h2>
      <div className="v3-card">
        <div className="v3-card-body">
          <p style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600 }}>{DREAM_ABOUT.age} 중에서 이런 청소년이에요</p>
          <ul className="v3-checks">
            {DREAM_ABOUT.who.map((w) => (
              <li key={w}><Check size={16} aria-hidden="true" />{w}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ③ 무엇을 */}
      <h2 className="v3-sec-title">
        이런 걸 해 줘요
        <small>센터마다 조금씩 달라요</small>
      </h2>
      <div className="v3-list">
        {DREAM_SERVICES.map((s) => {
          const Icon = ICONS[s.icon];
          const on = open === s.id;
          return (
            <div key={s.id} ref={(el) => { refs.current[s.id] = el; }} className="v3-acc">
              <button type="button" className="v3-row" aria-expanded={on} onClick={() => setOpen(on ? null : s.id)}>
                <span className="v3-row-ico green">{Icon && <Icon size={18} />}</span>
                <span className="v3-row-main">
                  <span className="v3-row-title">{s.title}</span>
                  <span className="v3-row-sub">{s.short}</span>
                </span>
                <span className="v3-row-end">{on ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
              </button>
              {on && (
                <div className="v3-acc-body">
                  {s.items.map((it) => (
                    <div key={it.t} className="v3-acc-item">
                      <b>{it.t}</b>
                      <span>{it.d}</span>
                    </div>
                  ))}
                  {s.note && <p className="v3-acc-note">{s.note}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ④ 어떻게 */}
      <h2 className="v3-sec-title">어떻게 시작해요?</h2>
      <div className="v3-card">
        <ol className="v3-steps">
          <li>가까운 센터 찾기<span>꿈드림 탭에서 사는 곳 근처 센터를 골라요.</span></li>
          <li>전화하거나 쪽지 보내기<span>“가 봐도 돼요?” 한마디면 충분해요. 쪽지는 이 앱에서 바로 보낼 수 있어요.</span></li>
          <li>센터에서 첫 상담<span>선생님과 이야기하고 나에게 맞는 지원을 정해요.</span></li>
        </ol>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="v3-btn block" onClick={() => goTo('centers')}>
          <Mail size={17} /> 가까운 꿈드림 찾아서 쪽지 보내기
        </button>
        <div className="v3-btn-row">
          <a className="v3-btn ghost" href="tel:1388"><Phone size={16} /> 1388 상담</a>
          <a className="v3-btn ghost" href={DREAM_ABOUT.site} target="_blank" rel="noopener noreferrer"><Globe size={16} /> 꿈드림 누리집</a>
        </div>
      </div>

      <p className="v3-note">
        출처: 여성가족부 「학교 밖 청소년 지원 안내서」. 센터 수는 2025 학교밖청소년지원센터 주소록 기준이에요.
        지원 내용은 센터·시기마다 달라서, 정확한 건 센터에 확인해 주세요.
      </p>
    </div>
  );
}
