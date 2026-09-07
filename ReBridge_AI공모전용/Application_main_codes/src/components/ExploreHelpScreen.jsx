import { ArrowLeft } from 'lucide-react';
import {
  CUTLINE_YEAR, CUTLINE_SOURCE_LABEL_ALL,
  PLAN_YEAR, GED_2027_SOURCE_LABEL, ADMISSION_DATA_UNIV_COUNT,
} from '../data/meta.js';

// 2026-09 서연님 UI 개선안: 대학 탐색·결과 화면 맨 아래에 박혀 있던 설명 문단을
// 통째로 옮겨온 화면. 목록을 보는 사람은 목록만 보고, 궁금한 사람만 여기로 들어온다.
// 두 화면이 거의 같은 설명을 쓰므로 한 페이지로 합쳤다 — 나누지 말 것(문구가 갈라진다).
//
// ⚠️ 여기 문구는 "합격 보장으로 읽히지 않게" 하는 안전장치다(CLAUDE.md).
//    칸수 = 합격 가능성 / 적합도 = 지원하기 좋은 정도, 이 둘의 구분을 흐리지 말 것.
export default function ExploreHelpScreen({ goBack = () => {} }) {
  return (
    <div className="screen">
      <header className="topbar">
        <span className="topbar-left">
          <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
            <ArrowLeft size={22} />
          </button>
          <span className="page-title">이 목록 읽는 법</span>
        </span>
      </header>

      <section className="ehelp-sec">
        <span className="ehelp-emoji" aria-hidden="true">📊</span>
        <h2 className="ehelp-title">칸수 게이지는 뭐예요?</h2>
        <p className="ehelp-body">
          <b>안정 · 적정 · 소신</b> 같은 표시예요. 내가 넣은 검정고시 점수를
          그 대학 합격선과 비교해 <b>합격 가능성</b>을 어림한 거예요.
        </p>
        <p className="ehelp-body">
          다만 이 합격선은 <b>일반 학생 입시 결과</b>를 바탕으로 한 참고값이에요
          ({CUTLINE_SOURCE_LABEL_ALL}). 검정고시생만의 합격선이 아니에요.
        </p>
      </section>

      <section className="ehelp-sec">
        <span className="ehelp-emoji" aria-hidden="true">🧮</span>
        <h2 className="ehelp-title">'추정'이라고 붙은 건요?</h2>
        <p className="ehelp-body">
          그 대학이 <b>검정고시 환산표를 공개하지 않아서</b>, 공개된 다른 대학 표의
          중앙값으로 계산했다는 뜻이에요. 실제 대학 계산과 다를 수 있어요.
        </p>
      </section>

      <section className="ehelp-sec">
        <span className="ehelp-emoji" aria-hidden="true">🔍</span>
        <h2 className="ehelp-title">'대학 미확인 · 일반 안내'는요?</h2>
        <p className="ehelp-body">
          대교협 기본사항을 바탕으로 한 <b>일반적인 안내</b>라는 뜻이에요.
          그 대학이 실제로 그렇게 뽑는다고 발표한 게 아니라서,
          <b> 대학 시행계획을 꼭 확인</b>해야 해요.
        </p>
      </section>

      <section className="ehelp-sec">
        <span className="ehelp-emoji" aria-hidden="true">🧭</span>
        <h2 className="ehelp-title">"지원 수월 / 지원 가능"은요?</h2>
        <p className="ehelp-body">
          합격선 자료가 없는 대학에 뜨는 표시예요. 전형 성격·환산표·수능최저를 보고
          <b> 검정고시생이 지원하기 좋은 정도</b>를 알려주는 거예요.
        </p>
        <p className="ehelp-callout">
          이건 <b>합격 확률이 아니에요.</b> 칸수 게이지와는 다른 뜻이니 섞어서 보면 안 돼요.
        </p>
      </section>

      <section className="ehelp-sec">
        <span className="ehelp-emoji" aria-hidden="true">📅</span>
        <h2 className="ehelp-title">어느 해 자료예요?</h2>
        <p className="ehelp-body">
          지원 가능 여부는 <b>{GED_2027_SOURCE_LABEL}</b> 기준이고,{' '}
          {ADMISSION_DATA_UNIV_COUNT}개 대학이 들어 있어요.
        </p>
        <p className="ehelp-body">
          이 자료에 없는 대학은 <b>{PLAN_YEAR}학년도 시행계획</b> 기준이라
          카드에 학년도를 따로 표시해 뒀어요. {PLAN_YEAR}학년도 전형 구조는
          대학 상세 화면에서 볼 수 있어요.
        </p>
      </section>

      <section className="ehelp-sec">
        <span className="ehelp-emoji" aria-hidden="true">⚠️</span>
        <h2 className="ehelp-title">꼭 알아두세요</h2>
        <p className="ehelp-body">
          합격선·비교내신은 <b>{CUTLINE_YEAR}학년도 자료 참고용</b>이에요
          ({CUTLINE_SOURCE_LABEL_ALL}).
        </p>
        <p className="ehelp-callout">
          실제 지원 자격과 반영 방법은 <b>반드시 그 대학 모집요강</b>을 확인해요.
          여기 표시는 참고일 뿐이고, 합격을 보장하지 않아요.
        </p>
      </section>
    </div>
  );
}
