import { useMemo } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { getUniversityDetail, getUniversityDetailByName } from '../lib/analysis.js';
import DocumentsChecklist from './DocumentsChecklist.jsx';

// 독립 화면: 특정 전형의 제출서류를 풀스크린으로
// props: { goTo, univId, univName, admissionName }
// 라우팅은 메인이 붙임. 여기서는 export만 잘 해두면 됨.
export default function DocumentsScreen({
  goTo = () => {},
  univId,
  univName,
  admissionName,
}) {
  const detail = useMemo(() => {
    if (univId) return getUniversityDetail(univId);
    if (univName) return getUniversityDetailByName(univName);
    return null;
  }, [univId, univName]);

  const adm = useMemo(() => {
    if (!detail) return null;
    const rows = detail.rows || [];
    if (admissionName) {
      const hit = rows.find((r) => r.admissionName === admissionName);
      if (hit) return hit;
    }
    return rows[0] || null;
  }, [detail, admissionName]);

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={() => goTo('home')}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">제출서류</span>
      </header>

      {!detail || !adm ? (
        <div className="placeholder">
          <h2>아직 정보가 없어요</h2>
          <p>이 전형의 제출서류 안내는 곧 채워질 예정이에요.</p>
        </div>
      ) : (
        <>
          <div className="detail-header">
            <div className="detail-univ-name">{detail.univ.name}</div>
            <div className="detail-meta">
              <MapPin size={13} /> {detail.univ.region}
              {adm.admissionName ? ` · ${adm.admissionName}` : ''}
            </div>
          </div>

          <DocumentsChecklist adm={adm} />
        </>
      )}
    </div>
  );
}
