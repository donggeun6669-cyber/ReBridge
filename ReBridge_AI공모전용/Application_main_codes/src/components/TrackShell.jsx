import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { getTrack } from '../lib/tracks.js';
import StudyRoadmapScreen from './StudyRoadmapScreen.jsx';
import StudyPlannerScreen from './StudyPlannerScreen.jsx';
import GedGuideScreen from './GedGuideScreen.jsx';
import RoadmapScreen from './RoadmapScreen.jsx';
import ExploreScreen from './ExploreScreen.jsx';
import ResultsScreen from './ResultsScreen.jsx';
import JobRoadmapScreen from './JobRoadmapScreen.jsx';
import JobExploreScreen from './JobExploreScreen.jsx';
import JobPsychScreen from './JobPsychScreen.jsx';

// 서브탭 screen 키 → 실제 컴포넌트
const SCREEN_COMP = {
  'study-roadmap': StudyRoadmapScreen,
  'study-planner': StudyPlannerScreen,
  'ged-guide': GedGuideScreen,
  'roadmap': RoadmapScreen,
  'univ-explore': ExploreScreen,
  'results': ResultsScreen,
  'job-roadmap': JobRoadmapScreen,
  'job-explore': JobExploreScreen,
  'job-psych': JobPsychScreen,
};

// 홈에서 트랙이 확정되면 보이는 화면.
// 상단: 트랙 헤더(+바꾸기) → 세그먼트 서브탭 → 선택된 서브화면(기존 컴포넌트 재사용).
export default function TrackShell({ trackId, goTo = () => {}, goBack = () => {}, onSwitch = () => {} }) {
  const track = getTrack(trackId);
  const [sub, setSub] = useState(track?.subtabs?.[0]?.key);
  if (!track) return null;

  const active = track.subtabs.find((s) => s.key === sub) || track.subtabs[0];
  const Comp = SCREEN_COMP[active.screen];

  return (
    <div className="track-shell">
      <header className="track-head">
        <div className="track-head-text">
          <p className="track-kicker">{track.kicker}</p>
          <p className="track-name">{track.label} 준비</p>
        </div>
        <button className="track-switch" onClick={onSwitch}>
          <ArrowLeftRight size={14} />
          바꾸기
        </button>
      </header>

      <nav className="track-tabs" aria-label="트랙 메뉴">
        {track.subtabs.map((s) => (
          <button
            key={s.key}
            className={`track-tab ${s.key === active.key ? 'active' : ''}`}
            onClick={() => setSub(s.key)}
            aria-current={s.key === active.key ? 'page' : undefined}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="track-body">
        {Comp ? <Comp goTo={goTo} goBack={goBack} canGoBack={false} /> : null}
      </div>
    </div>
  );
}
