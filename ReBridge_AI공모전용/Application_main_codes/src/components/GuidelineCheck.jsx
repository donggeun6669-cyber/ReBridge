import { useState } from 'react';
import { BookOpenCheck, ChevronDown, ExternalLink } from 'lucide-react';
import GUIDELINES from '../data/guidelines_2027.json';
import { TARGET_ADMISSION_YEAR } from '../data/meta.js';

// 받침이 있으면 '이/은/을', 없으면 '가/는/를'. 대학 이름을 문장에 넣을 때 필요하다.
// (한글 음절 = 0xAC00 + 초성*588 + 중성*28 + 종성. 나머지가 0이면 받침이 없다.)
function josa(word, withBatchim, withoutBatchim) {
  const last = (word || '').trim().slice(-1);
  const code = last.charCodeAt(0);
  if (!last || Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return withoutBatchim;
  return (code - 0xac00) % 28 === 0 ? withoutBatchim : withBatchim;
}

// ── 모집요강에서 확인하기 (2026-09) ──────────────────────────────────────
//
// 왜 만들었나
//   앱이 아무리 잘 정리해도 최종 근거는 대학이 낸 모집요강이다. 그런데 그 원본으로
//   가는 길이 '환산표 근거 원문 보기' 토글 안쪽에만 숨어 있었다(그것도 환산 발췌가
//   있는 대학만). 검정고시생이 제일 자주 틀리는 지점 — 지원자격 6개월 규정,
//   비교내신 적용 여부, 학생부 대체서식 — 이 전부 모집요강에만 적혀 있는데
//   정작 그 문서로 가는 버튼이 없었다.
//
// 무엇을 하나
//   전형마다 접었다 펴는 토글 하나. 안에는 세 가지만 둔다.
//     ① 이 전형 정보가 어느 자료 몇 쪽에서 왔는지 (대교협 자료 출처 그대로)
//     ② 대학이 낸 2027 모집요강 원본 PDF 링크 (어디가 배포본, 수시·정시)
//     ③ 검정고시생이 모집요강에서 '반드시' 직접 볼 항목 5개
//
// ⚠️ 여기 체크리스트는 답을 주는 곳이 아니라 '무엇을 찾아봐야 하는지' 알려주는 곳이다.
//    확인한 적 없는 대학별 값을 이 목록에 써넣지 말 것 — 그 순간 근거 없는 안내가 된다.

// 검정고시생이 모집요강에서 직접 확인해야 하는 것들.
// 각 항목은 "왜 이게 검정고시생에게 특히 중요한가"까지 적는다.
const CHECKS = [
  {
    label: '지원자격',
    why: '고교 자퇴·제적 후 6개월이 지나야 검정고시를 볼 수 있어요. 대학이 합격 연도나 회차에 조건을 다는 경우도 있어요.',
  },
  {
    label: '비교내신 적용 여부와 환산 방법',
    why: '검정고시 점수를 몇 등급으로 볼지 정하는 부분이에요. 이게 없으면 합격선과 비교 자체가 불가능해요.',
  },
  {
    label: '제출서류 · 학생부 대체서식',
    why: '학교생활기록부가 없으니 대학이 정한 대체서식을 내야 해요. 서식과 마감이 대학마다 달라요.',
  },
  {
    label: '수능 최저학력기준',
    why: '서류·면접을 아무리 잘 봐도 최저를 못 맞추면 불합격이에요. 검정고시생도 똑같이 적용돼요.',
  },
  {
    label: '원서 접수 일정',
    why: '접수는 하루 이틀 차이로 끝나요. 앱의 마감일도 요강에서 한 번 더 확인하세요.',
  },
];

/**
 * @param {string} univId   대학 id (guidelines_2027.json 키)
 * @param {string} univName 대학 이름 — 안내 문구용
 * @param {string} source   이 전형 행의 출처 문자열(대교협 자료 + 쪽수). 없으면 생략
 * @param {string} officeUrl 입학처 주소 (universities.json admissionOfficeUrl)
 */
export default function GuidelineCheck({ univId, univName, source = null, officeUrl = null }) {
  const [open, setOpen] = useState(false);
  // 수시를 먼저 보여준다 — 이 앱 사용자 대부분이 수시 지원자다.
  const links = (GUIDELINES[univId] || [])
    .slice()
    .sort((a, b) => (a.phase === '수시' ? 0 : 1) - (b.phase === '수시' ? 0 : 1));

  return (
    <div className="ged-raw gcheck">
      <button className="ged-raw-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <BookOpenCheck size={13} />
        {open ? '모집요강에서 확인하기 접기' : '모집요강에서 확인하기'}
        <ChevronDown size={14} className={`ged-raw-chev${open ? ' on' : ''}`} />
      </button>

      {open && (
        <div className="ged-raw-body">
          <p className="gcheck-lead">
            여기 내용은 정리한 자료예요.{' '}
            <b>최종 근거는 {univName || '대학'}{josa(univName || '대학', '이', '가')} 낸 모집요강</b>이고,
            아래에서 원본을 바로 열 수 있어요.
          </p>

          {links.length > 0 ? (
            <div className="gcheck-links">
              {links.map((l, i) => (
                <a key={i} className="gcheck-link" href={l.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} />
                  {TARGET_ADMISSION_YEAR}학년도 {l.phase || ''} 모집요강
                  {l.campus ? ` · ${l.campus}` : ''} PDF
                  {l.pages ? <span className="gcheck-pages">{l.pages}쪽</span> : null}
                </a>
              ))}
            </div>
          ) : (
            <p className="gcheck-none">
              이 대학의 모집요강 원본 주소를 아직 모아두지 못했어요.
              {officeUrl ? ' 아래 입학처에서 찾을 수 있어요.' : ' 대학 입학처 홈페이지에서 찾아보세요.'}
            </p>
          )}

          {officeUrl && (
            <a className="gcheck-link gcheck-office" href={officeUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> {univName || '대학'} 입학처 홈페이지
            </a>
          )}

          <p className="gcheck-sub">모집요강에서 이 다섯 가지를 꼭 직접 보세요.</p>
          <ol className="gcheck-list">
            {CHECKS.map((c) => (
              <li key={c.label}>
                <b>{c.label}</b>
                <span>{c.why}</span>
              </li>
            ))}
          </ol>

          {source && <p className="adm-src gcheck-src">이 전형 정보의 출처: {source}</p>}
          <p className="gcheck-warn">
            앱과 모집요강이 다르면 <b>모집요강이 맞아요.</b> 다른 점을 찾으면 입학처에 확인하세요.
          </p>
        </div>
      )}
    </div>
  );
}
