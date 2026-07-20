import { useState, useCallback, lazy, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
// 스플래시·하단탭만 즉시 로드하고, 화면들은 lazy로 쪼개 첫 로딩 번들을 가볍게 한다.
// (대형 JSON을 물고 있는 대입 관련 화면들이 초기 번들에서 빠지는 효과)
import BottomNav from './components/BottomNav.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import { getPersona, getNav, activeTabId, loadProfile } from './lib/persona.js';

const HomeScreen = lazy(() => import('./components/HomeScreen.jsx'));
const ExploreScreen = lazy(() => import('./components/ExploreScreen.jsx'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen.jsx'));
const MyPageScreen = lazy(() => import('./components/MyPageScreen.jsx'));
const GuideScreen = lazy(() => import('./components/GuideScreen.jsx'));
const GlossaryScreen = lazy(() => import('./components/GlossaryScreen.jsx'));
const ResultsScreen = lazy(() => import('./components/ResultsScreen.jsx'));
const DetailScreen = lazy(() => import('./components/DetailScreen.jsx'));
const RoadmapScreen = lazy(() => import('./components/RoadmapScreen.jsx'));
const DocumentsScreen = lazy(() => import('./components/DocumentsScreen.jsx'));
const SavedScreen = lazy(() => import('./components/SavedScreen.jsx'));
const MapScreen = lazy(() => import('./components/MapScreen.jsx'));
const HelpScreen = lazy(() => import('./components/HelpScreen.jsx'));
const ChecklistScreen = lazy(() => import('./components/ChecklistScreen.jsx'));
const FormsGuideScreen = lazy(() => import('./components/FormsGuideScreen.jsx'));
const DreamdriveScreen = lazy(() => import('./components/DreamdriveScreen.jsx'));
const GedGuideScreen = lazy(() => import('./components/GedGuideScreen.jsx'));
const StudyRoadmapScreen = lazy(() => import('./components/StudyRoadmapScreen.jsx'));
const StudyPlannerScreen = lazy(() => import('./components/StudyPlannerScreen.jsx'));
const CareerHubScreen = lazy(() => import('./components/CareerHubScreen.jsx'));
const PathGuideScreen = lazy(() => import('./components/PathGuideScreen.jsx'));
const JobHomeScreen = lazy(() => import('./components/JobHomeScreen.jsx'));
const JobExploreScreen = lazy(() => import('./components/JobExploreScreen.jsx'));
const JobRoadmapScreen = lazy(() => import('./components/JobRoadmapScreen.jsx'));
const JobQuestionsScreen = lazy(() => import('./components/JobQuestionsScreen.jsx'));
const JobDetailScreen = lazy(() => import('./components/JobDetailScreen.jsx'));
const JobInfoScreen = lazy(() => import('./components/JobInfoScreen.jsx'));
const JobPsychScreen = lazy(() => import('./components/JobPsychScreen.jsx'));
const JobTrainingScreen = lazy(() => import('./components/JobTrainingScreen.jsx'));
const JobApplyScreen = lazy(() => import('./components/JobApplyScreen.jsx'));
const OnboardingScreen = lazy(() => import('./components/OnboardingScreen.jsx'));
const CommunityScreen = lazy(() => import('./components/CommunityScreen.jsx'));
const CommunityPostScreen = lazy(() => import('./components/CommunityPostScreen.jsx'));
const CommunityWriteScreen = lazy(() => import('./components/CommunityWriteScreen.jsx'));
const AuthScreen = lazy(() => import('./components/AuthScreen.jsx'));
const SupportScreen = lazy(() => import('./components/SupportScreen.jsx'));

// 하단 글로벌 탭의 루트 화면들(여기로 가면 스택 리셋). 항상 고정 4개.
// 트랙 화면(학습/대입/직업)은 홈 안의 TrackHome이 그리므로 여기 없음.
const TAB_ROOTS = ['home', 'support', 'community', 'mypage'];

const KNOWN_SCREENS = [
  'guide', 'glossary', 'results', 'detail', 'documents', 'saved', 'map', 'help',
  'checklist', 'forms-guide', 'dreamdrive', 'ged-guide', 'univ-explore', 'path',
  'onboarding', 'study-roadmap', 'study-planner', 'support', 'roadmap',
  'job-home', 'job-explore', 'job-roadmap', 'job-questions', 'job-detail', 'job-info', 'job-psych',
  'job-training', 'job-apply',
  'community', 'community-post', 'community-write', 'community-auth',
];

// 직업 트랙은 답변(jobProfile)이 있어야 맞춤 안내가 되므로, 없으면 질문부터.
function jobLandingFor(landing) {
  if (landing !== 'job-home') return landing;
  const p = loadProfile();
  return p?.jobProfile ? 'job-home' : 'job-questions';
}

export default function App() {
  const [splash, setSplash] = useState(true);
  const [stack, setStack] = useState([{ screen: 'home', params: {} }]);

  function handleSplashDone() {
    setSplash(false);
    // 온보딩 필터 없음 — 누구나 홈으로. 홈이 '상태'에 따라 미정/트랙을 그린다.
    setStack([{ screen: 'home', params: {} }]);
  }

  function handleProfileComplete() {
    const persona = getPersona();
    // 공부 중(대학) — '목표 점수'를 넣은 것이므로 목표 대학 탐색으로.
    if (persona?.stage === 'studying' && persona?.goal === 'university') {
      setStack([{ screen: 'univ-explore', params: {} }]);
      return;
    }
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

  // 하단 탭 전용 — 항상 스택을 해당 화면으로 리셋(콘텐츠 이동인 goTo와 분리)
  const goToTab = useCallback((screen) => {
    setStack([{ screen, params: {} }]);
    window.scrollTo(0, 0);
  }, []);

  const isMainScreen = [...TAB_ROOTS, 'profile', 'onboarding'].includes(screen);

  // 하단 탭은 항상 고정(홈·지원·커뮤니티·MY). 온보딩/프로필 화면에서만 숨김.
  const persona = getPersona();
  const nav = getNav();
  const showNav = !splash && !['onboarding', 'profile'].includes(screen);

  return (
    <div className="app-shell">
      <div className="app-frame">
        {splash && <SplashScreen onDone={handleSplashDone} />}

        <Suspense fallback={<div className="screen" aria-busy="true" />}>


        {!splash && screen === 'onboarding'  && <OnboardingScreen goTo={goTo} presetTrack={params.presetTrack} />}

        {!splash && screen === 'home'        && <HomeScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'support'     && <SupportScreen goTo={goTo} goBack={goBack} params={params} />}
        {!splash && screen === 'explore'     && <CareerHubScreen goTo={goTo} persona={persona} />}
        {!splash && screen === 'univ-explore' && <ExploreScreen goTo={goTo} goBack={goBack} canGoBack={stack.length > 1} />}
        {!splash && screen === 'path'        && (
          <PathGuideScreen pathKey={params.key} goBack={goBack} />
        )}
        {!splash && screen === 'mypage'      && <MyPageScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'roadmap'     && <RoadmapScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'profile'     && (
          <ProfileScreen goTo={goTo} goBack={goBack} onComplete={handleProfileComplete} />
        )}
        {!splash && screen === 'guide'       && (
          <GuideScreen topic={params.topic} goTo={goTo} goBack={goBack} />
        )}
        {!splash && screen === 'glossary'    && (
          <GlossaryScreen track={params.track} params={params} goTo={goTo} goBack={goBack} />
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
        {!splash && screen === 'dreamdrive'  && <DreamdriveScreen goTo={goTo} goBack={goBack} params={params} />}
        {!splash && screen === 'ged-guide'   && <GedGuideScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'study-roadmap' && <StudyRoadmapScreen goTo={goTo} />}
        {!splash && screen === 'study-planner' && <StudyPlannerScreen goTo={goTo} />}
        {!splash && screen === 'job-home'      && <JobHomeScreen goTo={goTo} />}
        {!splash && screen === 'job-explore'   && <JobExploreScreen goTo={goTo} />}
        {!splash && screen === 'job-roadmap'   && <JobRoadmapScreen goTo={goTo} />}
        {!splash && screen === 'job-questions' && <JobQuestionsScreen goTo={goTo} goBack={goBack} canGoBack={stack.length > 1} />}
        {!splash && screen === 'job-detail'    && <JobDetailScreen id={params.id} goBack={goBack} />}
        {!splash && screen === 'job-info'      && <JobInfoScreen goBack={goBack} goTo={goTo} initialQuery={params.q} />}
        {!splash && screen === 'job-psych'     && <JobPsychScreen goBack={goBack} />}
        {!splash && screen === 'job-training'  && <JobTrainingScreen goBack={goBack} goTo={goTo} />}
        {!splash && screen === 'job-apply'     && <JobApplyScreen goBack={goBack} goTo={goTo} />}
        {!splash && screen === 'community'       && <CommunityScreen goTo={goTo} goBack={goBack} params={params} />}
        {!splash && screen === 'community-post'  && <CommunityPostScreen goTo={goTo} goBack={goBack} id={params.id} />}
        {!splash && screen === 'community-write' && <CommunityWriteScreen goTo={goTo} goBack={goBack} board={params.board} initialTitle={params.initialTitle || ''} />}
        {!splash && screen === 'community-auth'  && <AuthScreen goBack={goBack} />}

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
        </Suspense>

        {showNav && (
          <BottomNav tabs={nav.tabs} active={activeTabId(screen)} goTo={goToTab} />
        )}
      </div>
    </div>
  );
}
