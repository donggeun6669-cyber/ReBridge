import { Route, Gauge, Sparkles, Search, Files, BookOpenCheck, ChevronRight } from 'lucide-react';
import SyTop from './SyTop.jsx';
import './sy-c.css';

// 서연 UI 「진학지원 허브」 (진학지원 탭 첫 화면) — 2026-09-28 시안
// 네 칸 + 목록 두 줄. 각 칸은 원래 있던 화면으로 보낸다.
const TILES = [
  { id: 'roadmap', title: '나의 로드맵', sub: '다음 할 일을 확인해요', Icon: Route, main: true },
  { id: 'score', title: '내 점수', sub: '검정고시·모의 등급', Icon: Gauge },
  { id: 'results', title: '나와 맞는 대학', sub: '5단계로 살펴봐요', Icon: Sparkles },
  { id: 'univ-explore', title: '대학 찾기', sub: '조건으로 찾아요', Icon: Search },
];
const ROWS = [
  { id: 'documents', title: '제출서류', sub: '무엇을 준비할지 확인해요', Icon: Files },
  { id: 'ged-guide', title: '검정고시 안내', sub: '응시 조건과 공식 자료', Icon: BookOpenCheck },
];

export default function SyUnivHome({ goTo }) {
  return (
    <div className="sy-screen">
      <SyTop title="진학지원" />

      <h2 className="sy-c-hero">대입 준비, 필요한 것만 골라봐요</h2>
      <p className="sy-c-lead">순서가 궁금하면 로드맵부터 확인해요.</p>

      <div className="sy-c-tiles">
        {TILES.map(({ id, title, sub, Icon, main }) => (
          <button key={id} type="button" className={`sy-c-tile${main ? ' main' : ''}`} onClick={() => goTo(id)}>
            <span className="sy-c-tile-ico"><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
            <span className="sy-c-tile-title">{title}</span>
            <span className="sy-c-tile-sub">{sub}</span>
          </button>
        ))}
      </div>

      <div className="sy-c-links">
        {ROWS.map(({ id, title, sub, Icon }) => (
          <button key={id} type="button" className="sy-c-link" onClick={() => goTo(id)}>
            <span className="sy-c-link-ico"><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
            <span className="sy-c-link-main">
              <span className="sy-c-link-title">{title}</span>
              <span className="sy-c-link-sub">{sub}</span>
            </span>
            <ChevronRight size={20} strokeWidth={2} className="sy-c-link-end" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
