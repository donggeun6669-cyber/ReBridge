import { useMemo } from 'react';
import {
  CircleCheck, CircleX, TriangleAlert, CircleHelp, Layers, LockKeyhole, Minus, ShieldCheck, ShieldX,
} from 'lucide-react';
import SyTop from './SyTop.jsx';
import './sy-d.css';
import { getUniversityDetail, getUniversityDetailByName } from '../lib/analysis.js';
import { admissionLabel, matrixKind } from './dUtil.js';

// 전형별 지원 가능 여부 (시안 '전형별 지원 가능 여부.png')
// params: { univId, univ } — 대학 상세의 '비교하기'에서 온다.
// 목록은 대학 상세와 같은 학년도 자료(getUniversityDetail 이 고른 것) + 정원외 전형이다.
// ⚠️ 두 학년도(2027 대교협 · 2028 시행계획)를 한 목록에 섞지 않는다 — 전형명이 달라 없는 대응이 생긴다.

const MATRIX_LABEL = {
  ok: { Icon: CircleCheck, label: '가능' },
  no: { Icon: CircleX, label: '불가' },
  cond: { Icon: TriangleAlert, label: '조건부' },
  check: { Icon: CircleHelp, label: '확인 필요' },
  quota: { Icon: Layers, label: '정원외' },
  lock: { Icon: LockKeyhole, label: '자격 제한' },
  none: { Icon: Minus, label: '자료 없음' },
};

function Pill({ kind }) {
  const { Icon, label } = MATRIX_LABEL[kind];
  return (
    <span className={`sy-d-mpill k-${kind}`}>
      <Icon size={14} strokeWidth={2.2} /> {label}
    </span>
  );
}

export default function SyAdmissionMatrix({ goBack, params = {} }) {
  const { univId, univ: univName } = params;
  const detail = useMemo(() => {
    if (univId) return getUniversityDetail(univId);
    if (univName) return getUniversityDetailByName(univName);
    return null;
  }, [univId, univName]);

  const list = detail ? [...detail.rows, ...detail.quotaRows] : [];

  return (
    <div className="sy-screen sy-d">
      <SyTop title="지원 가능 여부" onBack={goBack} />

      <h2 className="sy-d-hero">라벨과 아이콘으로 구분해요</h2>
      <p className="sy-d-herosub">미확정은 실패가 아니라 확인할 정보예요.</p>

      <div className="sy-d-card sy-d-mcard sy-d-shadow">
        {list.length === 0 && (
          <div className="sy-d-mrow">
            <span className="sy-d-mname">{univName || '이 대학'} 전형 자료</span>
            <Pill kind="none" />
          </div>
        )}
        {list.map((r, i) => (
          <div className="sy-d-mrow" key={`${r.admissionName}-${i}`}>
            <span className="sy-d-mname">{admissionLabel(r)}</span>
            <Pill kind={matrixKind(r)} />
          </div>
        ))}
      </div>

      {/* 수능 최저 — 앱에 수능 성적 입력이 없어 대학별 충족 여부는 계산하지 않는다. 라벨 설명으로만 둔다. */}
      <h3 className="sy-d-sec sy-d-sec-csat">수능 최저</h3>
      <div className="sy-d-csat">
        <div className="sy-d-csat-card">
          <span className="sy-d-mpill k-ok"><ShieldCheck size={14} strokeWidth={2.2} /> 수능 최저 충족</span>
          <p>기준을 맞췄어요</p>
        </div>
        <div className="sy-d-csat-card">
          <span className="sy-d-mpill k-no"><ShieldX size={14} strokeWidth={2.2} /> 수능 최저 미달</span>
          <p>기준보다 낮아요</p>
        </div>
      </div>
    </div>
  );
}
