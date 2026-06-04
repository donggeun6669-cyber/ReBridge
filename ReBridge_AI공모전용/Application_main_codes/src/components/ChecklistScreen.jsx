import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Circle,
  ExternalLink, ChevronRight, Info, FileText,
} from 'lucide-react';

const STORAGE_KEY   = 'rebridge_profile';
const CHECK_KEY     = 'rebridge_checklist';
const CURRENT_YEAR  = 2026;

/* ─────────────────────────────────────────────
   체크리스트 항목 생성 로직
───────────────────────────────────────────── */
function buildChecklist(profile) {
  const round       = profile?.examRound   || '';
  const year        = profile?.examYear    || '';
  const highSchool  = profile?.highSchool  || '';
  const overseas    = profile?.overseasSchool || '';

  const is2nd         = round === '2회차';
  const isCritical2nd = is2nd && year === String(CURRENT_YEAR);

  const items = [];

  // ── 기본 필수 서류 (전 대학 공통) ──────────────
  items.push({
    id: 'admit-cert',
    category: '기본 필수',
    title: '고졸 검정고시 합격증명서',
    badge: '대입전형용',
    badgeColor: 'danger',
    issuer: '나이스(kged.go.kr) 또는 시도교육청',
    url: 'https://kged.go.kr',
    days: '즉시 발급',
    warn: '반드시 "대입전형용"으로 발급하세요. 일반용 제출 시 불합격 처리될 수 있어요. 2026학년도부터 학교폭력 조치사항 포함본으로 변경됐어요.',
    required: true,
  });

  items.push({
    id: 'score-cert',
    category: '기본 필수',
    title: '검정고시 성적증명서',
    issuer: '나이스(kged.go.kr)',
    url: 'https://kged.go.kr',
    days: '즉시 발급',
    warn: isCritical2nd
      ? `${CURRENT_YEAR}년 2회차 합격자는 수시 나이스 온라인 연동 불가! 실물 원본을 등기우편으로 직접 제출해야 해요.`
      : is2nd
        ? '2회차 합격자는 수시 나이스 온라인 연동이 차단될 수 있어요. 지원 대학에 확인 후 필요 시 실물 우편 제출하세요.'
        : '나이스에서 대학에 온라인으로 직접 전송 신청이 가능해요.',
    warnLevel: isCritical2nd ? 'critical' : is2nd ? 'caution' : 'info',
    required: true,
  });

  // ── 자퇴/제적 이력 ───────────────────────────
  if (highSchool === '있어요 (자퇴·제적)') {
    items.push({
      id: 'withdraw-cert',
      category: '추가 서류',
      title: '제적증명서',
      badge: '원본',
      badgeColor: 'brand',
      issuer: '다녔던 고등학교',
      url: '',
      days: '1~3일',
      warn: '합격증명서 학력란에 제적 학교명·일자가 명시된 경우 제출 면제 가능. 대학별로 다르므로 반드시 확인하세요.',
      required: false,
      condition: '고교 재학 후 자퇴·제적한 경우',
    });

    items.push({
      id: 'school-record',
      category: '추가 서류',
      title: '학교생활기록부',
      issuer: '다녔던 고등학교 / 나이스(neis.go.kr)',
      url: 'https://www.neis.go.kr',
      days: '3~7일 (학교 방문 필요)',
      warn: '해당 연도 9월 1일 이후 발급분만 인정해요. 학교장 직인 필수.',
      required: false,
      condition: '전형에 따라 요구되는 경우',
    });
  }

  // ── 학종 지원 ────────────────────────────────
  items.push({
    id: 'hs-alt-form',
    category: '학종 지원',
    title: '학생부 대체 서식',
    issuer: '지원 대학 입학처 홈페이지',
    url: '',
    days: '직접 작성',
    warn: '대학마다 규격(항목 수·글자 수)이 달라요. 반드시 해당 대학 서식을 확인해서 작성하세요.',
    required: false,
    condition: '학생부종합 전형 지원 시',
    guideKey: 'forms',
  });

  // ── 해외 학교 이력 ───────────────────────────
  if (overseas === '있어요') {
    items.push({
      id: 'overseas-gpa',
      category: '해외고 추가 서류',
      title: 'GPA 성적증명서 (원본, 학기별)',
      issuer: '다녔던 해외 학교',
      url: '',
      days: '1~4주 (학교에 따라 다름)',
      warn: '번역 공증이 필요한 경우가 있어요. 대학별 요구사항을 확인하세요.',
      required: false,
      condition: '해외고 이력 있는 경우',
    });

    items.push({
      id: 'overseas-grad',
      category: '해외고 추가 서류',
      title: '졸업(예정)증명서 (학교장 직인)',
      issuer: '다녔던 해외 학교',
      url: '',
      days: '1~4주',
      required: false,
      condition: '해외고 이력 있는 경우',
    });

    items.push({
      id: 'school-profile',
      category: '해외고 추가 서류',
      title: 'School Profile',
      issuer: '다녔던 해외 학교',
      url: '',
      days: '1~2주',
      required: false,
      condition: '해외고 이력 있는 경우',
    });

    items.push({
      id: 'immigration',
      category: '해외고 추가 서류',
      title: '출입국사실증명서',
      issuer: '법무부 (hikorea.go.kr)',
      url: 'https://www.hikorea.go.kr',
      days: '즉시 발급',
      required: false,
      condition: '해외고 이력 있는 경우',
    });
  }

  return items;
}

/* ─────────────────────────────────────────────
   화면 컴포넌트
───────────────────────────────────────────── */
export default function ChecklistScreen({ goTo = () => {}, goBack = () => {} }) {
  const profile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
  }, []);

  const items = useMemo(() => buildChecklist(profile), [profile]);

  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHECK_KEY)) || {}; } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(checked)); } catch { /* 무시 */ }
  }, [checked]);

  function toggle(id) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const doneCount = items.filter((i) => checked[i.id]).length;

  // 카테고리 그룹핑
  const categories = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    });
    return map;
  }, [items]);

  const round       = profile?.examRound || '';
  const year        = profile?.examYear  || '';
  const isCritical  = round === '2회차' && year === String(CURRENT_YEAR);

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">서류 체크리스트</span>
      </header>

      <div className="intro-line">내 상황에 맞는 서류 목록</div>
      <div className="intro-sub">
        체크하면서 준비해요.
        {!profile && (
          <> 정보를 입력하면 내 상황에 꼭 맞는 목록을 만들어드려요.</>
        )}
      </div>

      {/* 진행 바 */}
      <div className="cl-progress-wrap">
        <div className="cl-progress-bar">
          <div
            className="cl-progress-fill"
            style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
          />
        </div>
        <span className="cl-progress-text">{doneCount} / {items.length} 완료</span>
      </div>

      {/* 2회차 경고 */}
      {isCritical && (
        <div className="cl-alert critical">
          <AlertTriangle size={16} />
          <div>
            <b>{CURRENT_YEAR}년 2회차 합격자 — 나이스 온라인 연동 불가!</b>
            <p>수시 서류를 나이스로 전송하면 안 돼요. 성적증명서 실물 원본을 등기우편으로 직접 제출해야 해요.</p>
          </div>
        </div>
      )}

      {!profile && (
        <button className="cl-goto-profile" onClick={() => goTo('profile')}>
          <FileText size={16} />
          내 정보 입력하면 맞춤 목록을 만들어드려요
          <ChevronRight size={16} />
        </button>
      )}

      {/* 카테고리별 체크리스트 */}
      {[...categories.entries()].map(([cat, catItems]) => (
        <div className="cl-section" key={cat}>
          <div className="cl-section-label">{cat}</div>
          {catItems.map((item) => (
            <div
              key={item.id}
              className={`cl-item ${checked[item.id] ? 'done' : ''}`}
              onClick={() => toggle(item.id)}
            >
              <button
                className="cl-check"
                aria-label={checked[item.id] ? '완료 취소' : '완료 표시'}
                onClick={(e) => { e.stopPropagation(); toggle(item.id); }}
              >
                {checked[item.id]
                  ? <CheckCircle2 size={22} className="cl-check-on" />
                  : <Circle size={22} className="cl-check-off" />}
              </button>
              <div className="cl-item-body">
                <div className="cl-item-title-row">
                  <span className="cl-item-title">{item.title}</span>
                  {item.badge && (
                    <span className={`cl-badge cl-badge-${item.badgeColor || 'brand'}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.condition && (
                  <span className="cl-condition">{item.condition}</span>
                )}
                <div className="cl-item-meta">
                  <span>발급처: {item.issuer}</span>
                  {item.days && <span>· {item.days}</span>}
                </div>
                {item.warn && (
                  <div className={`cl-warn cl-warn-${item.warnLevel || 'info'}`}>
                    {(item.warnLevel === 'critical' || item.warnLevel === 'caution') && (
                      <AlertTriangle size={12} />
                    )}
                    {item.warnLevel === 'info' && <Info size={12} />}
                    <span>{item.warn}</span>
                  </div>
                )}
                <div className="cl-item-actions">
                  {item.url && (
                    <a
                      className="cl-link"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      바로가기 <ExternalLink size={12} />
                    </a>
                  )}
                  {item.guideKey === 'forms' && (
                    <button
                      className="cl-link"
                      onClick={(e) => { e.stopPropagation(); goTo('forms-guide'); }}
                    >
                      대체서식 안내 <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="cl-footer">
        <p className="note">
          <Info size={12} /> 서류 요구사항은 대학·전형마다 달라요.
          지원 전 반드시 해당 대학 모집요강 원문을 확인하세요.
        </p>
        <button className="btn-outline" onClick={() => goTo('guide', { topic: 'docs' })}>
          합격증명서 vs 성적증명서 차이 알아보기
        </button>
      </div>
    </div>
  );
}
