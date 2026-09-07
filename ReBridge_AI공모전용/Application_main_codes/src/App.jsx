import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
// 스플래시·하단탭만 즉시 로드하고, 화면들은 lazy로 쪼개 첫 로딩 번들을 가볍게 한다.
// (대형 JSON을 물고 있는 대입 관련 화면들이 초기 번들에서 빠지는 효과)
import BottomNav from './components/BottomNav.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import { getPersona, getNav, activeTabId, loadProfile, V1_UNIV_ONLY, isHiddenScreen } from './lib/persona.js';

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
const StudyRoadmapScreen = /* #__PURE__ */ lazy(() => import('./components/StudyRoadmapScreen.jsx'));
const StudyPlannerScreen = /* #__PURE__ */ lazy(() => import('./components/StudyPlannerScreen.jsx'));
const CareerHubScreen = /* #__PURE__ */ lazy(() => import('./components/CareerHubScreen.jsx'));
const PathGuideScreen = lazy(() => import('./components/PathGuideScreen.jsx'));
const JobHomeScreen = /* #__PURE__ */ lazy(() => import('./components/JobHomeScreen.jsx'));
const JobExploreScreen = /* #__PURE__ */ lazy(() => import('./components/JobExploreScreen.jsx'));
const JobRoadmapScreen = /* #__PURE__ */ lazy(() => import('./components/JobRoadmapScreen.jsx'));
const JobQuestionsScreen = /* #__PURE__ */ lazy(() => import('./components/JobQuestionsScreen.jsx'));
const JobDetailScreen = /* #__PURE__ */ lazy(() => import('./components/JobDetailScreen.jsx'));
const JobInfoScreen = /* #__PURE__ */ lazy(() => import('./components/JobInfoScreen.jsx'));
const JobPsychScreen = /* #__PURE__ */ lazy(() => import('./components/JobPsychScreen.jsx'));
const JobTrainingScreen = /* #__PURE__ */ lazy(() => import('./components/JobTrainingScreen.jsx'));
const JobApplyScreen = /* #__PURE__ */ lazy(() => import('./components/JobApplyScreen.jsx'));
const OnboardingScreen = lazy(() => import('./components/OnboardingScreen.jsx'));
const CommunityScreen = /* #__PURE__ */ lazy(() => import('./components/CommunityScreen.jsx'));
const CommunityPostScreen = /* #__PURE__ */ lazy(() => import('./components/CommunityPostScreen.jsx'));
const CommunityWriteScreen = /* #__PURE__ */ lazy(() => import('./components/CommunityWriteScreen.jsx'));
const AuthScreen = /* #__PURE__ */ lazy(() => import('./components/AuthScreen.jsx'));
const SupportScreen = lazy(() => import('./components/SupportScreen.jsx'));
const PolicyScreen = lazy(() => import('./components/PolicyScreen.jsx'));
// 팀 내부용 데이터 원본 화면 — 서비스 동선에 링크가 없고 주소 뒤 #data 로만 열린다.
const RawDataScreen = /* #__PURE__ */ lazy(() => import('./components/RawDataScreen.jsx'));

// 하단 글로벌 탭의 루트 화면들(여기로 가면 스택 리셋).
// v1(V1_UNIV_ONLY)에서는 커뮤니티가 빠져 3개가 된다.
// 트랙 화면(학습/대입/직업)은 홈 안의 TrackHome이 그리므로 여기 없음.
const TAB_ROOTS = ['home', 'support', 'community', 'mypage'].filter((s) => !isHiddenScreen(s));

// 주소 뒤 #data 로 들어오면 데이터 원본 화면부터 연다(스플래시도 건너뛴다).
// UI를 고치는 사람이 실제 데이터를 보려고 쓰는 통로다. 일반 사용자 동선에는 링크가 없다.
const RAW_HASH = '#data';
const isRawHash = () => typeof window !== 'undefined' && window.location.hash === RAW_HASH;

// v1에서 숨긴 화면(커뮤니티/인증·직업·학습)은 이 목록에서도 빠진다.
// → 어딘가에 링크가 남아 있어도 아래 "준비 중" 폴백으로 떨어진다.
const KNOWN_SCREENS = [
  'guide', 'glossary', 'results', 'detail', 'documents', 'saved', 'map', 'help',
  'checklist', 'forms-guide', 'dreamdrive', 'ged-guide', 'univ-explore', 'path',
  'onboarding', 'study-roadmap', 'study-planner', 'support', 'roadmap',
  'job-home', 'job-explore', 'job-roadmap', 'job-questions', 'job-detail', 'job-info', 'job-psych',
  'job-training', 'job-apply',
  'community', 'community-post', 'community-write', 'community-auth',
  'privacy', 'terms',
  'data-raw',
].filter((s) => !isHiddenScreen(s));

// 직업 트랙은 답변(jobProfile)이 있어야 맞춤 안내가 되므로, 없으면 질문부터.
function jobLandingFor(landing) {
  if (landing !== 'job-home') return landing;
  const p = loadProfile();
  return p?.jobProfile ? 'job-home' : 'job-questions';
}

export default function App() {
  const [splash, setSplash] = useState(!isRawHash());
  const [stack, setStack] = useState(
    isRawHash() ? [{ screen: 'data-raw', params: {} }] : [{ screen: 'home', params: {} }],
  );

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

  // 주소창에 #data 를 직접 쳐 넣었을 때도 열리게 한다(앱이 이미 떠 있는 경우).
  useEffect(() => {
    function onHashChange() {
      if (!isRawHash()) return;
      setSplash(false);
      setStack((s) => (s[s.length - 1].screen === 'data-raw'
        ? s
        : [...s, { screen: 'data-raw', params: {} }]));
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // 데이터 원본 화면에서 뒤로 — #data 를 지워야 뒤로 간 자리에서 다시 열리지 않는다.
  const leaveRawData = useCallback(() => {
    if (isRawHash()) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ screen: 'home', params: {} }]));
    window.scrollTo(0, 0);
  }, []);

  const isMainScreen = [...TAB_ROOTS, 'profile', 'onboarding'].includes(screen);

  // 하단 탭은 항상 고정(홈·지원·커뮤니티·MY). 온보딩/프로필 화면에서만 숨김.
  const persona = getPersona();
  const nav = getNav();
  // 데이터 원본은 팀 내부용 전체화면이라 하단 탭을 띄우지 않는다.
  const showNav = !splash && !['onboarding', 'profile', 'data-raw'].includes(screen);

  return (
    <div className="app-shell">
      <div className="app-frame">
        {splash && <SplashScreen onDone={handleSplashDone} />}

        <Suspense fallback={<div className="screen" aria-busy="true" />}>


        {!splash && screen === 'onboarding'  && <OnboardingScreen goTo={goTo} presetTrack={params.presetTrack} />}

        {!splash && screen === 'home'        && <HomeScreen goTo={goTo} goBack={goBack} />}
        {!splash && screen === 'support'     && <SupportScreen goTo={goTo} goBack={goBack} params={params} />}
        {/* 진로 허브 — v1에서 숨김. (숨기면 'explore'가 KNOWN_SCREENS에 없어
            CareerHub와 '준비 중'이 같이 그려지던 이중 렌더도 함께 사라진다) */}
        {!splash && !V1_UNIV_ONLY && screen === 'explore'     && <CareerHubScreen goTo={goTo} persona={persona} />}
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
        {/* ▼ v1(V1_UNIV_ONLY)에서 숨기는 화면들 — 학습·직업 트랙, 커뮤니티·인증.
            남은 링크로 들어와도 KNOWN_SCREENS에서 빠져 '준비 중'으로 떨어진다. */}
        {!splash && !V1_UNIV_ONLY && screen === 'study-roadmap' && <StudyRoadmapScreen goTo={goTo} />}
        {!splash && !V1_UNIV_ONLY && screen === 'study-planner' && <StudyPlannerScreen goTo={goTo} />}
        {!splash && !V1_UNIV_ONLY && screen === 'job-home'      && <JobHomeScreen goTo={goTo} />}
        {!splash && !V1_UNIV_ONLY && screen === 'job-explore'   && <JobExploreScreen goTo={goTo} />}
        {!splash && !V1_UNIV_ONLY && screen === 'job-roadmap'   && <JobRoadmapScreen goTo={goTo} />}
        {!splash && !V1_UNIV_ONLY && screen === 'job-questions' && <JobQuestionsScreen goTo={goTo} goBack={goBack} canGoBack={stack.length > 1} />}
        {!splash && !V1_UNIV_ONLY && screen === 'job-detail'    && <JobDetailScreen id={params.id} goBack={goBack} />}
        {!splash && !V1_UNIV_ONLY && screen === 'job-info'      && <JobInfoScreen goBack={goBack} goTo={goTo} initialQuery={params.q} />}
        {!splash && !V1_UNIV_ONLY && screen === 'job-psych'     && <JobPsychScreen goBack={goBack} />}
        {!splash && !V1_UNIV_ONLY && screen === 'job-training'  && <JobTrainingScreen goBack={goBack} goTo={goTo} />}
        {!splash && !V1_UNIV_ONLY && screen === 'job-apply'     && <JobApplyScreen goBack={goBack} goTo={goTo} />}
        {!splash && !V1_UNIV_ONLY && screen === 'community'       && <CommunityScreen goTo={goTo} goBack={goBack} params={params} />}
        {!splash && !V1_UNIV_ONLY && screen === 'community-post'  && <CommunityPostScreen goTo={goTo} goBack={goBack} id={params.id} />}
        {!splash && !V1_UNIV_ONLY && screen === 'community-write' && <CommunityWriteScreen goTo={goTo} goBack={goBack} board={params.board} initialTitle={params.initialTitle || ''} />}
        {!splash && !V1_UNIV_ONLY && screen === 'community-auth'  && <AuthScreen goTo={goTo} goBack={goBack} />}

        {/* 법적 고지 — 청소년 대상 서비스 필수 + 스토어 심사 요건 */}
        {!splash && screen === 'privacy'         && <PolicyScreen doc="privacy" goBack={goBack} />}
        {!splash && screen === 'terms'           && <PolicyScreen doc="terms"   goBack={goBack} />}

        {/* 데이터 원본 — 팀 내부용. 주소 뒤 #data 로만 들어온다. */}
        {!splash && screen === 'data-raw'        && <RawDataScreen goBack={leaveRawData} />}

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
