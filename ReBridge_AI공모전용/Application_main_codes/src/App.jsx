import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
// 스플래시만 즉시 로드하고, 화면들은 lazy로 쪼개 첫 로딩 번들을 가볍게 한다.
// (대형 JSON을 물고 있는 대입 관련 화면들이 초기 번들에서 빠지는 효과)
import SplashScreen from './components/SplashScreen.jsx';
import TabBar from './components/TabBar.jsx';
import { getPersona, loadProfile, V1_UNIV_ONLY, isHiddenScreen } from './lib/persona.js';

const HomeScreen = lazy(() => import('./components/HomeScreen.jsx'));
const ExploreScreen = lazy(() => import('./components/ExploreScreen.jsx'));
const ExploreHelpScreen = lazy(() => import('./components/ExploreHelpScreen.jsx'));
const AdmissionMatrixScreen = lazy(() => import('./components/AdmissionMatrixScreen.jsx'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen.jsx'));
const MyPageScreen = lazy(() => import('./components/MyPageScreen.jsx'));
const GuideScreen = lazy(() => import('./components/GuideScreen.jsx'));
const ResultsScreen = lazy(() => import('./components/ResultsScreen.jsx'));
const DetailScreen = lazy(() => import('./components/DetailScreen.jsx'));
const RoadmapScreen = lazy(() => import('./components/RoadmapScreen.jsx'));
const DocumentsScreen = lazy(() => import('./components/DocumentsScreen.jsx'));
const SavedScreen = lazy(() => import('./components/SavedScreen.jsx'));
const MapScreen = lazy(() => import('./components/MapScreen.jsx'));
const HelpScreen = lazy(() => import('./components/HelpScreen.jsx'));
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
const PolicyScreen = lazy(() => import('./components/PolicyScreen.jsx'));
// 팀 내부용 데이터 원본 화면 — 서비스 동선에 링크가 없고 주소 뒤 #data 로만 열린다.
const RawDataScreen = /* #__PURE__ */ lazy(() => import('./components/RawDataScreen.jsx'));

// 하단 탭 5개로 다시 도입 (2026-09 리디자인). 탭마다 화면 스택을 독립적으로 들고 있어서
// 다른 탭에서 뭘 보다가 탭을 눌러 돌아와도 보던 화면이 그대로 남는다.
// 탭 루트가 아닌 화면(상세·결과·가이드 등)은 지금 활성 탭의 스택 위에 쌓인다.
// 화면 이름(별칭 포함) → 그 화면이 루트인 탭. 탭 전환은 goTo()가 이 맵으로 판단한다.
const SCREEN_TO_TAB = {
  home: 'home',
  dreamdrive: 'dreamdrive',
  support: 'dreamdrive',
  roadmap: 'study',
  checklist: 'study',
  community: 'community',
  mypage: 'mypage',
};
function initialStacks() {
  return {
    home: [{ screen: 'home', params: {} }],
    dreamdrive: [{ screen: 'dreamdrive', params: {} }],
    study: [{ screen: 'roadmap', params: {} }],
    community: [{ screen: 'community', params: {} }],
    mypage: [{ screen: 'mypage', params: {} }],
  };
}
const COMMUNITY_ON = !isHiddenScreen('community');
// KNOWN_SCREENS 밖이지만 '준비 중'으로 떨어뜨리면 안 되는 화면들
const MAIN_SCREENS = ['home', 'support', 'mypage', 'community', 'profile', 'onboarding'];
// 탭바를 감추는 화면 — 전체화면 흐름(작성·인증·법적고지 등)
const HIDE_TABBAR_SCREENS = ['onboarding', 'community-write', 'community-auth', 'privacy', 'terms', 'data-raw'];

// 주소 뒤 #data 로 들어오면 데이터 원본 화면부터 연다(스플래시도 건너뛴다).
// UI를 고치는 사람이 실제 데이터를 보려고 쓰는 통로다. 일반 사용자 동선에는 링크가 없다.
const RAW_HASH = '#data';
const isRawHash = () => typeof window !== 'undefined' && window.location.hash === RAW_HASH;

// v1에서 숨긴 화면(커뮤니티/인증·직업·학습)은 이 목록에서도 빠진다.
// → 어딘가에 링크가 남아 있어도 아래 "준비 중" 폴백으로 떨어진다.
const KNOWN_SCREENS = [
  // 'glossary'는 help(담임에게 물어보기), 'checklist'는 roadmap(지금 시기에 할 일),
  // 'support'는 dreamdrive(꿈드림센터)에 합쳤다. 예전 링크가 살아 있게 이름은 남겨 둔다.
  'guide', 'glossary', 'results', 'detail', 'admission-matrix', 'documents', 'saved', 'map', 'help',
  'checklist', 'forms-guide', 'dreamdrive', 'ged-guide', 'univ-explore', 'explore-help', 'path',
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
  const [rawOpen, setRawOpen] = useState(isRawHash());
  // getPersona()가 null = 아직 온보딩(인사 화면)을 안 지난 사람.
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [stacks, setStacks] = useState(initialStacks());

  function handleSplashDone() {
    setSplash(false);
    if (isRawHash()) return;
    setShowOnboarding(!getPersona());
  }

  function handleOnboardingDone() {
    setShowOnboarding(false);
    setActiveTab('home');
    setStacks(initialStacks());
  }

  function handleProfileComplete() {
    // 점수 입력을 마치면 진학지원 탭에서 결과를 보여준다.
    setActiveTab('study');
    setStacks((s) => ({
      ...s,
      study: [{ screen: 'roadmap', params: {} }, { screen: 'results', params: {} }],
    }));
  }

  const stack   = stacks[activeTab];
  const current = stack[stack.length - 1];
  const screen  = current.screen;
  const params  = current.params;

  // next가 탭의 루트 화면(별칭 포함)이면 화면을 쌓지 않고 그 탭으로 전환한다.
  // 이미 그 탭에 깊은 스택이 있으면 그대로 둔다 — 탭끼리 오가도 하던 걸 이어 볼 수 있게.
  const goTo = useCallback((next, options = {}) => {
    const targetTab = SCREEN_TO_TAB[next];
    if (targetTab) {
      setActiveTab(targetTab);
      setStacks((s) => {
        const tabStack = s[targetTab];
        if (tabStack.length > 1) return s;
        const top = tabStack[0];
        if (top.screen === next && JSON.stringify(top.params) === JSON.stringify(options)) return s;
        return { ...s, [targetTab]: [{ screen: next, params: options }] };
      });
      window.scrollTo(0, 0);
      return;
    }
    setStacks((s) => {
      const tabStack = s[activeTab];
      const top = tabStack[tabStack.length - 1];
      if (top.screen === next && JSON.stringify(top.params) === JSON.stringify(options)) return s;
      return { ...s, [activeTab]: [...tabStack, { screen: next, params: options }] };
    });
    window.scrollTo(0, 0);
  }, [activeTab]);

  const goBack = useCallback(() => {
    setStacks((s) => {
      const tabStack = s[activeTab];
      if (tabStack.length <= 1) return s;
      return { ...s, [activeTab]: tabStack.slice(0, -1) };
    });
    window.scrollTo(0, 0);
  }, [activeTab]);

  // 탭바 탭 선택 — 같은 탭을 다시 누르면 그 탭의 첫 화면으로 리셋, 다른 탭이면 하던 걸 이어서.
  const selectTab = useCallback((key) => {
    if (key === activeTab) {
      setStacks((s) => (s[key].length > 1 ? { ...s, [key]: [s[key][0]] } : s));
    } else {
      setActiveTab(key);
    }
    window.scrollTo(0, 0);
  }, [activeTab]);

  // 주소창에 #data 를 직접 쳐 넣었을 때도 열리게 한다(앱이 이미 떠 있는 경우).
  useEffect(() => {
    function onHashChange() {
      setRawOpen(isRawHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // 데이터 원본 화면에서 뒤로 — #data 를 지워야 뒤로 간 자리에서 다시 열리지 않는다.
  const leaveRawData = useCallback(() => {
    if (isRawHash()) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setRawOpen(false);
    window.scrollTo(0, 0);
  }, []);

  const isMainScreen = MAIN_SCREENS.includes(screen);
  const persona = getPersona();
  const showApp = !splash && !rawOpen && !showOnboarding;
  const showTabBar = showApp && !HIDE_TABBAR_SCREENS.includes(screen);

  return (
    <div className="app-shell">
      <div className="app-frame">
        {splash && <SplashScreen onDone={handleSplashDone} />}

        <Suspense fallback={<div className="screen" aria-busy="true" />}>

        {!splash && rawOpen && <RawDataScreen goBack={leaveRawData} />}
        {!splash && !rawOpen && showOnboarding && <OnboardingScreen onDone={handleOnboardingDone} />}

        {/* 마이페이지 '다시 선택하기' 등으로 앱 안에서 다시 열리는 경우 — goBack으로 닫는다 */}
        {showApp && screen === 'onboarding'  && <OnboardingScreen goBack={goBack} />}

        {showApp && screen === 'home'        && <HomeScreen goTo={goTo} goBack={goBack} />}
        {/* 지원 혜택은 꿈드림센터 화면에 합쳤다 — 'support'로 와도 같은 화면 */}
        {showApp && (screen === 'support' || screen === 'dreamdrive') && (
          <DreamdriveScreen goTo={goTo} goBack={goBack} params={params} />
        )}
        {/* 진로 허브 — v1에서 숨김. (숨기면 'explore'가 KNOWN_SCREENS에 없어
            CareerHub와 '준비 중'이 같이 그려지던 이중 렌더도 함께 사라진다) */}
        {showApp && !V1_UNIV_ONLY && screen === 'explore'     && <CareerHubScreen goTo={goTo} persona={persona} />}
        {showApp && screen === 'univ-explore' && <ExploreScreen goTo={goTo} goBack={goBack} canGoBack={stack.length > 1} />}
        {showApp && screen === 'explore-help' && <ExploreHelpScreen goBack={goBack} />}
        {showApp && screen === 'path'        && (
          <PathGuideScreen pathKey={params.key} goBack={goBack} />
        )}
        {showApp && screen === 'mypage'      && <MyPageScreen goTo={goTo} goBack={goBack} />}
        {/* 내 로드맵 + 서류 체크리스트 = '지금 시기에 할 일' 한 화면 */}
        {showApp && (screen === 'roadmap' || screen === 'checklist') && (
          <RoadmapScreen goTo={goTo} goBack={goBack} focus={screen === 'checklist' ? 'docs' : null} />
        )}
        {showApp && screen === 'profile'     && (
          <ProfileScreen goTo={goTo} goBack={goBack} onComplete={handleProfileComplete} />
        )}
        {showApp && screen === 'guide'       && (
          <GuideScreen topic={params.topic} goTo={goTo} goBack={goBack} />
        )}
        {showApp && screen === 'results'     && <ResultsScreen goTo={goTo} goBack={goBack} />}
        {showApp && screen === 'detail'      && (
          <DetailScreen goTo={goTo} goBack={goBack} univId={params.univId} univName={params.univ} />
        )}
        {showApp && screen === 'admission-matrix' && (
          <AdmissionMatrixScreen goBack={goBack} univId={params.univId} univName={params.univ} />
        )}
        {showApp && screen === 'documents'   && (
          <DocumentsScreen
            goTo={goTo}
            goBack={goBack}
            univId={params.univId}
            univName={params.univ}
            admissionName={params.admissionName}
          />
        )}
        {showApp && screen === 'saved'       && <SavedScreen goTo={goTo} goBack={goBack} />}
        {showApp && screen === 'map'         && <MapScreen goTo={goTo} goBack={goBack} />}
        {/* 담임에게 물어보기 = 자주 묻는 질문 + 입시 용어. 'glossary'로 와도 같은 화면 */}
        {showApp && (screen === 'help' || screen === 'glossary') && (
          <HelpScreen goTo={goTo} goBack={goBack} termId={params.termId} />
        )}
        {showApp && screen === 'forms-guide' && <FormsGuideScreen goTo={goTo} goBack={goBack} />}
        {showApp && screen === 'ged-guide'   && <GedGuideScreen goTo={goTo} goBack={goBack} />}
        {/* ▼ v1(V1_UNIV_ONLY)에서 숨기는 화면들 — 학습·직업 트랙.
            남은 링크로 들어와도 KNOWN_SCREENS에서 빠져 '준비 중'으로 떨어진다. */}
        {showApp && !V1_UNIV_ONLY && screen === 'study-roadmap' && <StudyRoadmapScreen goTo={goTo} />}
        {showApp && !V1_UNIV_ONLY && screen === 'study-planner' && <StudyPlannerScreen goTo={goTo} />}
        {showApp && !V1_UNIV_ONLY && screen === 'job-home'      && <JobHomeScreen goTo={goTo} />}
        {showApp && !V1_UNIV_ONLY && screen === 'job-explore'   && <JobExploreScreen goTo={goTo} />}
        {showApp && !V1_UNIV_ONLY && screen === 'job-roadmap'   && <JobRoadmapScreen goTo={goTo} />}
        {showApp && !V1_UNIV_ONLY && screen === 'job-questions' && <JobQuestionsScreen goTo={goTo} goBack={goBack} canGoBack={stack.length > 1} />}
        {showApp && !V1_UNIV_ONLY && screen === 'job-detail'    && <JobDetailScreen id={params.id} goBack={goBack} />}
        {showApp && !V1_UNIV_ONLY && screen === 'job-info'      && <JobInfoScreen goBack={goBack} goTo={goTo} initialQuery={params.q} />}
        {showApp && !V1_UNIV_ONLY && screen === 'job-psych'     && <JobPsychScreen goBack={goBack} />}
        {showApp && !V1_UNIV_ONLY && screen === 'job-training'  && <JobTrainingScreen goBack={goBack} goTo={goTo} />}
        {showApp && !V1_UNIV_ONLY && screen === 'job-apply'     && <JobApplyScreen goBack={goBack} goTo={goTo} />}
        {/* 커뮤니티 — 2026-09-18 v1에 넣었다(COMMUNITY_IN_V1). 출시 때 뺄지는 다시 정한다. */}
        {showApp && COMMUNITY_ON && screen === 'community'       && <CommunityScreen goTo={goTo} goBack={goBack} params={params} />}
        {showApp && COMMUNITY_ON && screen === 'community-post'  && <CommunityPostScreen goTo={goTo} goBack={goBack} id={params.id} />}
        {showApp && COMMUNITY_ON && screen === 'community-write' && <CommunityWriteScreen goTo={goTo} goBack={goBack} board={params.board} tag={params.tag} initialTitle={params.initialTitle || ''} />}
        {showApp && COMMUNITY_ON && screen === 'community-auth'  && <AuthScreen goTo={goTo} goBack={goBack} />}

        {/* 법적 고지 — 청소년 대상 서비스 필수 + 스토어 심사 요건 */}
        {showApp && screen === 'privacy'         && <PolicyScreen doc="privacy" goBack={goBack} />}
        {showApp && screen === 'terms'           && <PolicyScreen doc="terms"   goBack={goBack} />}

        {/* 미구현 화면 fallback */}
        {showApp && !isMainScreen && !KNOWN_SCREENS.includes(screen) && (
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

        {showTabBar && <TabBar active={activeTab} onSelect={selectTab} />}
      </div>
    </div>
  );
}
