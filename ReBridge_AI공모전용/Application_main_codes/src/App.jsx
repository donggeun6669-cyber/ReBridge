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
import BottomNav from './components/BottomNav.jsx';

// 하단 탭의 루트 화면들 — 탭 이동은 히스토리를 쌓지 않고 스택을 새로 시작한다.
const TAB_ROOTS = ['home', 'explore', 'roadmap', 'mypage'];

export default function App() {
  // 네비게이션 스택: 마지막 항목이 현재 화면. 뒤로가기는 한 칸 pop.
  const [stack, setStack] = useState([{ screen: 'home', params: {} }]);
  const current = stack[stack.length - 1];
  const screen = current.screen;
  const params = current.params;

  // 화면 전환: 탭 루트면 스택을 새로 시작, 하위 화면이면 push.
  // 매 전환마다 브라우저 히스토리에 한 칸 쌓아 휴대폰 뒤로가기를 받는다.
  const goTo = useCallback((next, options = {}) => {
    setStack((s) => {
      if (TAB_ROOTS.includes(next)) return [{ screen: next, params: options }];
      // 같은 화면 연속 진입 방지(중복 push 안 함)
      const top = s[s.length - 1];
      if (top.screen === next && JSON.stringify(top.params) === JSON.stringify(options)) return s;
      return [...s, { screen: next, params: options }];
    });
    window.scrollTo(0, 0);
  }, []);

  // 뒤로가기: 스택을 한 칸만 pop(루트면 그대로). 브라우저 히스토리에 의존하지 않아
  // 더블팝/홈점프가 구조적으로 불가능하다.
  const goBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.scrollTo(0, 0);
  }, []);

  const isMainScreen = ['home', 'explore', 'roadmap', 'mypage', 'profile'].includes(screen);

  return (
    <div className="app-shell">
      <div className="app-frame">
        {screen === 'home' && <HomeScreen goTo={goTo} />}
        {screen === 'explore' && <ExploreScreen goTo={goTo} />}
        {screen === 'mypage' && <MyPageScreen goTo={goTo} goBack={goBack} />}
        {screen === 'roadmap' && <RoadmapScreen goTo={goTo} />}
        {screen === 'profile' && <ProfileScreen goTo={goTo} goBack={goBack} />}
        {screen === 'guide' && <GuideScreen topic={params.topic} goTo={goTo} goBack={goBack} />}
        {screen === 'results' && <ResultsScreen goTo={goTo} goBack={goBack} />}
        {screen === 'detail' && (
          <DetailScreen goTo={goTo} goBack={goBack} univId={params.univId} univName={params.univ} />
        )}
        {screen === 'documents' && (
          <DocumentsScreen
            goTo={goTo}
            goBack={goBack}
            univId={params.univId}
            univName={params.univ}
            admissionName={params.admissionName}
          />
        )}
        {screen === 'saved' && <SavedScreen goTo={goTo} goBack={goBack} />}
        {screen === 'map' && <MapScreen goTo={goTo} goBack={goBack} />}

        {!isMainScreen && !['guide', 'results', 'detail', 'documents', 'saved', 'map'].includes(screen) && (
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
