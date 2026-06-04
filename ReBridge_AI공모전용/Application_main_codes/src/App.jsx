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
import BottomNav from './components/BottomNav.jsx';
import SplashScreen from './components/SplashScreen.jsx';

// 하단 탭의 루트 화면들
const TAB_ROOTS = ['home', 'explore', 'roadmap', 'mypage'];

const KNOWN_SCREENS = [
  'guide', 'results', 'detail', 'documents', 'saved', 'map', 'help',
  'checklist', 'forms-guide',
];

function hasProfile() {
  try { return Boolean(JSON.parse(localStorage.getItem('rebridge_profile'))); }
  catch { return false; }
}

export default function App() {
  const [splash, setSplash] = useState(true);

  function handleSplashDone() {
    setSplash(false);
    if (!hasProfile()) setStack([{ screen: 'profile', params: {} }]);
  }

  function handleProfileComplete() {
    setStack([
      { screen: 'home',    params: {} },
      { screen: 'results', params: {} },
    ]);
  }

  const [stack, setStack] = useState([{ screen: 'home', params: {} }]);
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

  const isMainScreen = ['home', 'explore', 'roadmap', 'mypage', 'profile'].includes(screen);

  return (
    <div className="app-shell">
      <div className="app-frame">
        {splash && <SplashScreen onDone={handleSplashDone} />}

        {!splash && screen === 'home'        && <HomeScreen goTo={goTo} />}
        {!splash && screen === 'explore'     && <ExploreScreen goTo={goTo} />}
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

        {!splash && (TAB_ROOTS.includes(screen) || screen === 'results') && (
          <BottomNav active={TAB_ROOTS.includes(screen) ? screen : 'home'} goTo={goTo} />
        )}
      </div>
    </div>
  );
}
