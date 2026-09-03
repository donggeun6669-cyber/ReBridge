import { ArrowLeft, AlertTriangle, Info, ExternalLink, ChevronRight } from 'lucide-react';
import { FORMS_BASIS_LABEL } from '../data/meta.js';

const UNIV_FORMS = [
  {
    name: '서울대',
    maxItems: 10,
    charsPerItem: 100,
    attachLimit: 'A4 30페이지 이내',
    externalScore: 'IB·AP만 인정 (정규 고교 과정 내), SAT·ACT 기재 금지',
    special: '',
  },
  {
    name: '연세대',
    maxItems: 10,
    charsPerItem: 50,
    attachLimit: 'A4 10페이지 이내',
    externalScore: '학교 편성 AP·IB·A-Level 파이널 성적 1항목 허용',
    special: '',
  },
  {
    name: '경희대',
    maxItems: 15,
    charsPerItem: 50,
    attachLimit: '공식 고교 성적표만',
    externalScore: '단독 제출 불가, 성적표 내 표기 시 간접 반영',
    special: '',
  },
  {
    name: '아주대',
    maxItems: 6,
    charsPerItem: 50,
    attachLimit: 'A4 10페이지 이내',
    externalScore: '성적표 내 이수 표기 시 참작',
    special: '',
  },
  {
    name: '숭실대',
    maxItems: 10,
    charsPerItem: 100,
    attachLimit: 'A4 10페이지 이내',
    externalScore: '정규 커리큘럼 포함 시 파이널 성적 1칸 기술 허용',
    special: '',
  },
  {
    name: '건국대',
    maxItems: 5,
    charsPerItem: 300,
    attachLimit: '미제출',
    externalScore: 'SAT·ACT·AP·IB 일절 기재 불가',
    special: '',
  },
  {
    name: '충북대',
    maxItems: null,
    charsPerItem: 200,
    attachLimit: '원본대조필 필수',
    externalScore: '기관명 명시 금지, 공인어학성적 기재 금지',
    special: '수시 원서접수 마감 직후 청주 본교(N10동 1층 153호) 직접 방문하여 원본대조필 필수!',
  },
  {
    name: '동국대',
    maxItems: null,
    charsPerItem: null,
    attachLimit: '청소년생활기록부 허용',
    externalScore: '—',
    special: '학교 밖 청소년 지원센터(꿈드림) 청소년생활기록부를 정식 대체서식으로 채택',
  },
];

const COMMON_WARNINGS = [
  '항목당 글자 수 초과 시 탈락 사유가 될 수 있어요.',
  '공인어학성적(TOEFL, TOEIC 등), 교외 수상 실적은 기재해도 평가에서 배제돼요.',
  '기관명 명시 금지 대학(예: 충북대)에서는 고유명사 기재를 주의하세요.',
  '충북대는 수시 원서접수 마감 직후 청주 본교를 직접 방문해야 해요.',
  '대학별 서식은 매년 달라질 수 있으니 해당 연도 모집요강에서 반드시 확인하세요.',
];

export default function FormsGuideScreen({ goTo = () => {}, goBack = () => {} }) {
  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">학생부 대체서식 안내</span>
      </header>

      <div className="intro-line">생기부 없이 학종 지원하기</div>
      <div className="intro-sub">
        검정고시생은 생활기록부 대신 "학생부 대체 서식"을 제출해 학생부종합 전형에 지원할 수 있어요.
        <br />
        대학마다 규격이 크게 달라요 — 반드시 지원 대학 서식으로 작성하세요.
      </div>

      {/* 핵심 주의사항 */}
      <div className="fg-warn-card">
        <div className="fg-warn-title">
          <AlertTriangle size={15} /> 작성 전 꼭 확인하세요
        </div>
        <ul className="fg-warn-list">
          {COMMON_WARNINGS.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>

      {/* 청소년생활기록부 안내 */}
      <div className="fg-info-card">
        <Info size={15} />
        <div>
          <b>청소년생활기록부란?</b>
          <p>
            학교 밖 청소년 지원센터(꿈드림)에서 누적한 활동 이력을 공식 포맷으로
            정리한 서류예요. 동국대 등 일부 대학에서 정식 대체서식으로 채택하고 있어요.
          </p>
          <a
            className="fg-ext-link"
            href="https://www.kdream.or.kr"
            target="_blank"
            rel="noopener noreferrer"
          >
            가까운 꿈드림 센터 찾기 <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* 대학별 규격 표 */}
      <div className="fg-section-label">{FORMS_BASIS_LABEL}</div>
      <div className="fg-note">매년 달라지므로 해당 연도 모집요강 필수 확인</div>

      <div className="fg-table-wrap">
        {UNIV_FORMS.map((u) => (
          <div className="fg-row" key={u.name}>
            <div className="fg-row-head">
              <span className="fg-univ-name">{u.name}</span>
              {u.special && (
                <span className="fg-special-badge">주의</span>
              )}
            </div>
            <div className="fg-row-body">
              <div className="fg-stat">
                <span className="fg-stat-label">항목 수</span>
                <span className="fg-stat-val">{u.maxItems != null ? `최대 ${u.maxItems}개` : '제한 없음'}</span>
              </div>
              <div className="fg-stat">
                <span className="fg-stat-label">항목당 글자</span>
                <span className="fg-stat-val">{u.charsPerItem != null ? `${u.charsPerItem}자` : '—'}</span>
              </div>
              <div className="fg-stat">
                <span className="fg-stat-label">첨부 한도</span>
                <span className="fg-stat-val">{u.attachLimit}</span>
              </div>
              <div className="fg-stat fg-stat-full">
                <span className="fg-stat-label">외부 성적 기재</span>
                <span className="fg-stat-val">{u.externalScore}</span>
              </div>
              {u.special && (
                <div className="fg-special-note">
                  <AlertTriangle size={12} /> {u.special}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="fg-footer">
        <p className="note">
          <Info size={12} /> 위 정보는 참고용이에요. 실제 지원 전 각 대학 입학처에서
          해당 연도 모집요강을 반드시 확인하세요.
        </p>
        <button
          className="btn-outline"
          onClick={() => goTo('checklist')}
          style={{ marginTop: 12 }}
        >
          내 서류 체크리스트로 가기 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
