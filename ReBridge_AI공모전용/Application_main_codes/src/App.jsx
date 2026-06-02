import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import HomeScreen from './components/HomeScreen.jsx';
import ExploreScreen from './components/ExploreScreen.jsx';
import ProfileScreen from './components/ProfileScreen.jsx';
import MyPageScreen from './components/MyPageScreen.jsx';
import GuideScreen from './components/GuideScreen.jsx';
import ResultsScreen from './components/ResultsScreen.jsx';
import DetailScreen from './components/DetailScreen.jsx';
import RoadmapScreen from './components/RoadmapScreen.jsx';
import BottomNav from './components/BottomNav.jsx';

const TAB_ROOTS = ['home', 'explore', 'roadmap', 'mypage'];

export default function App() {
  const [screen, setScreen] = useState('home');
  const [params, setParams] = useState({});

  function goTo(next, options = {}) {
    setParams(options);
    setScreen(next);
  }

  const isMainScreen = ['home', 'explore', 'roadmap', 'mypage', 'profile'].includes(screen);

  return (
    <div className="app-shell">
      <div className="app-frame">
        {screen === 'home' && <HomeScreen goTo={goTo} />}
        {screen === 'explore' && <ExploreScreen goTo={goTo} />}
        {screen === 'mypage' && <MyPageScreen goTo={goTo} />}
        {screen === 'roadmap' && <RoadmapScreen goTo={goTo} />}
        {screen === 'profile' && <ProfileScreen goTo={goTo} />}
        {screen === 'guide' && <GuideScreen topic={params.topic} goTo={goTo} />}
        {screen === 'results' && <ResultsScreen goTo={goTo} />}
        {screen === 'detail' && (
          <DetailScreen goTo={goTo} univId={params.univId} univName={params.univ} />
        )}

        {!isMainScreen && !['guide', 'results', 'detail'].includes(screen) && (
          <div className="screen">
            <header className="topbar center">
              <button className="icon-btn" aria-label="뒤로" onClick={() => goTo('home')}>
                <ArrowLeft size={22} />
              </button>
              <span className="page-title">준비 중</span>
            </header>
            <div className="placeholder">
              <h2>준비 중이에요</h2>
              <p>
                "{screen}" 화면은 다음 단계에서 만들 거예요.
                {params.topic ? ` (주제: ${params.topic})` : ''}
                {params.univ ? ` (${params.univ})` : ''}
              </p>
            </div>
          </div>
        )}

        {TAB_ROOTS.includes(screen) && <BottomNav active={screen} goTo={goTo} />}
      </div>
    </div>
  );
}
