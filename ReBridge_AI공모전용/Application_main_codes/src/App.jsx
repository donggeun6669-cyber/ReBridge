import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import HomeScreen from './components/HomeScreen.jsx';
import ExploreScreen from './components/ExploreScreen.jsx';
import ProfileScreen from './components/ProfileScreen.jsx';
import MyPageScreen from './components/MyPageScreen.jsx';
import GuideScreen from './components/GuideScreen.jsx';
import ResultsScreen from './components/ResultsScreen.jsx';
import DetailScreen from './components/DetailScreen.jsx';
import RoadmapScreen from './components/RoadmapScreen.jsx';
import DocumentsScreen from './components/DocumentsScreen.jsx';
import SavedScreen from './components/SavedScreen.jsx';
import MapScreen from './components/MapScreen.jsx';
import HelpScreen from './components/HelpScreen.jsx';
import ChecklistScreen from './components/ChecklistScreen.jsx';
import FormsGuideScreen from './components/FormsGuideScreen.jsx';
import DreamdriveScreen from './components/DreamdriveScreen.jsx';
import GedGuideScreen from './components/GedGuideScreen.jsx';
import StudyRoadmapScreen from './components/StudyRoadmapScreen.jsx';
import StudyPlannerScreen from './components/StudyPlannerScreen.jsx';
import CareerHubScreen from './components/CareerHubScreen.jsx';
import PathGuideScreen from './components/PathGuideScreen.jsx';
import OnboardingScreen from './components/OnboardingScreen.jsx';
import BottomNav from './components/BottomNav.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import { getPersona, getNav, activeTabId } from './lib/persona.js';

// 하단 탭의 루트 화면들(여기로 가면 스택 리셋). persona별로 탭이 달라도 모두 포함.
const TAB_ROOTS = ['home', 'ged-guide', 'explore', 'univ-explore', 'roadmap', 'study-roadmap', 'study-planner', 'mypage'];

const KNOWN_SCREENS = [
  'guide', 'results', 'detail', 'documents', 'saved', 'map', 'help',
  'checklist', 'forms-guide', 'dreamdrive', 'ged-guide', 'univ-explore', 'path',
  'onboarding', 'study-roadmap', 'study-planner',
];

export default function App() {
  const [splash, setSplash] = useState(true);
  const [stack, setStack] = useState([{ screen: 'home', params: {} }]);

  function handleSplashDone() {
    setSplash(false);
    const persona = getPersona();
    if (!persona) {
      setStack([{ screen: 'onboarding', params: {} }]);
    } else {
      const { landing } = getNav(persona);
      setStack([{ screen: landing, params: {} }]);
    }
  }

  function handleProfileComplete() {
    setStack([
      { screen: 'home',    params: {} },
      { screen: 'results', params: {} },
    ]);
  }

  const current = stack[stack.length - 1];
  const screen  = current.screen;
  const params  = current.params;

  const goTo = useCallback((next, options = {}) => {
    setStack((s) => {
      if (TAB_ROOTS.includes(next)) return [{ screen: next, params: options }];
      const top = s[s.length - 1];
      if (top.screen === next && JSON.stringify(top.params) === JSON.stringify(options)) return s;
      return [...s, { screen: next, params: options }];
    });
    window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.scrollTo(0, 0);
  }, []);

  const isMainScreen = [...TAB_ROOTS, 'profile', 'onboarding'].includes(screen);

  // persona 기반 하단 탭 (없으면 BottomNav 기본 폴백)
  const persona = getPersona();
  const nav = getNav(persona);
  const showNav = !splash && persona && !['onboarding', 'profile'].includes(screen);

  return (
    <div className="app-shell">
      <div className="app-frame">
        {splash && <SplashScreen onDone={handleSplashDone} />}

        {!splash && screen === 'onboarding'  && <OnboardingScreen goTo={goTo} presetTrack={params.presetTrack} />}

        {!splash && screen === 'home'        && <HomeScreen goTo={goTo} />}
        {!splash && screen === 'explore'     && <CareerHubScreen goTo={goTo} persona={persona} />}
        {!splash && screen === 'univ-explore' && <ExploreScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'path'        && (
          <PathGuideScreen pathKey={params.key} goBack={goBack} />
        )}
        {!splash && screen === 'mypage'      && <MyPageScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'roadmap'     && <RoadmapScreen goTo={goTo} />}
        {!splash && screen === 'profile'     && (
          <ProfileScreen goTo={goTo} goBack={goBack} onComplete={handleProfileComplete} />
        )}
        {!splash && screen === 'guide'       && (
          <GuideScreen topic={params.topic} goTo={goTo} goBack={goBack} />
        )}
        {!splash && screen === 'results'     && <ResultsScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'detail'      && (
          <DetailScreen goTo={goTo} goBack={goBack} univId={params.univId} univName={params.univ} />
        )}
        {!splash && screen === 'documents'   && (
          <DocumentsScreen
            goTo={goTo}
            goBack={goBack}
            univId={params.univId}
            univName={params.univ}
            admissionName={params.admissionName}
          />
        )}
        {!splash && screen === 'saved'       && <SavedScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'map'         && <MapScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'help'        && <HelpScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'checklist'   && <ChecklistScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'forms-guide' && <FormsGuideScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'dreamdrive'  && <DreamdriveScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'ged-guide'   && <GedGuideScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'study-roadmap' && <StudyRoadmapScreen goTo={goTo} />}
        {!splash && screen === 'study-planner' && <StudyPlannerScreen goTo={goTo} />}

        {/* 미구현 화면 fallback */}
        {!splash && !isMainScreen && !KNOWN_SCREENS.includes(screen) && (
          <div className="screen">
            <header className="topbar center">
              <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
                <ArrowLeft size={22} />
              </button>
              <span className="page-title">준비 중</span>
            </header>
            <div className="placeholder">
              <h2>준비 중이에요</h2>
              <p>
                "{screen}" 화면은 다음 단계에서 만들 거예요.
                {params.topic ? ` (주제: ${params.topic})` : ''}
                {params.univ  ? ` (${params.univ})`        : ''}
              </p>
            </div>
          </div>
        )}

        {showNav && (
          <BottomNav tabs={nav.tabs} active={activeTabId(screen)} goTo={goTo} />
        )}
      </div>
    </div>
  );
}
