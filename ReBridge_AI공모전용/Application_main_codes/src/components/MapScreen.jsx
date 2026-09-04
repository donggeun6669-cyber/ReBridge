import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, MapPin, X } from 'lucide-react';
import universities from '../lib/universityList.js';
import { getExploreList } from '../lib/analysis.js';
import { useKakaoMap, MAP_ENABLED } from '../lib/kakaoMap.js';

const FILTERS = ['전체', '검정고시 전형', '4년제', '전문대'];

// ── 카카오맵 뷰 ──────────────────────────────────────────────────────────
function KakaoMapView({ points, onSelect, selectedId }) {
  const { containerRef, mapRef, runWhenReady } = useKakaoMap({ lat: 36.3, lng: 127.8, level: 13 });
  const overlaysRef = useRef([]);

  useEffect(() => {
    const update = () => {
      if (!mapRef.current) return;
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];

      points.forEach((p) => {
        if (!p.lat || !p.lng) return;
        const pos = new window.kakao.maps.LatLng(p.lat, p.lng);
        const isSel = p.univId === selectedId;
        const hasGed = p.eligibleCount > 0;

        const el = document.createElement('div');
        el.className = `map-kakao-dot${hasGed ? ' ged' : ''}${isSel ? ' sel' : ''}`;
        el.title = p.name;
        el.addEventListener('click', () => onSelect(p));

        const overlay = new window.kakao.maps.CustomOverlay({
          position: pos, content: el, zIndex: isSel ? 5 : 1,
        });
        overlay.setMap(mapRef.current);
        overlaysRef.current.push(overlay);
      });
    };
    runWhenReady(update);
    return () => {
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
    };
  }, [points, selectedId, onSelect, runWhenReady, mapRef]);

  return <div ref={containerRef} className="map-canvas" />;
}

// ────────────────────────────────────────────────────────────────────────────
export default function MapScreen({ goTo = () => {}, goBack = () => {} }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('전체');

  const points = useMemo(() => {
    const elig = new Map(getExploreList().map((s) => [s.univId, s.eligibleCount]));
    return universities
      .filter((u) => u.lat != null && u.lng != null)
      .map((u) => ({
        univId: u.univId,
        name: u.name,
        region: u.region,
        kind: u.kind || '대학교',
        establishment: u.establishment || '',
        lat: u.lat,
        lng: u.lng,
        eligibleCount: elig.get(u.univId) || 0,
      }));
  }, []);

  const filtered = useMemo(() => {
    if (filter === '검정고시 전형') return points.filter((p) => p.eligibleCount > 0);
    if (filter === '4년제')         return points.filter((p) => p.kind !== '전문대학');
    if (filter === '전문대')        return points.filter((p) => p.kind === '전문대학');
    return points;
  }, [points, filter]);

  const handleFilter = (opt) => { setFilter(opt); setSelected(null); };

  return (
    <div className="screen map-screen">
      <header className="topbar center map-topbar">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">지도로 보기</span>
      </header>

      <div className="map-filter-bar">
        {FILTERS.map((opt) => (
          <button
            key={opt}
            className={`map-fchip${filter === opt ? ' sel' : ''}`}
            onClick={() => handleFilter(opt)}
          >
            {opt}
          </button>
        ))}
        <span className="map-filter-count">{filtered.length}개</span>
      </div>

      <div className="map-wrap">
        {MAP_ENABLED ? (
          <KakaoMapView
            points={filtered}
            onSelect={setSelected}
            selectedId={selected?.univId}
          />
        ) : (
          <div className="map-off">
            <MapPin size={22} />
            <p className="map-off-title">지도는 잠시 쉬어 가요</p>
            <p className="map-off-desc">
              지도 기능을 점검하는 동안 잠시 꺼 두었어요.<br />
              대학은 목록에서 그대로 찾아볼 수 있어요.
            </p>
            <button className="map-off-btn" onClick={goBack}>
              목록으로 돌아가기
            </button>
          </div>
        )}

        {selected && (
          <div className="map-bottom-sheet">
            <div className="map-sheet-handle" />
            <button
              className="icon-btn map-card-close"
              aria-label="닫기"
              onClick={() => setSelected(null)}
            >
              <X size={16} />
            </button>

            <div className="map-card-name">{selected.name}</div>
            <div className="map-card-meta">
              <MapPin size={13} />
              {selected.region}
              {selected.establishment ? ` · ${selected.establishment}` : ''}
              {selected.kind === '전문대학' ? ' · 전문대학' : ''}
            </div>

            {selected.eligibleCount > 0 ? (
              <div className="map-ged-badge has">
                검정고시 전형 {selected.eligibleCount}개 있음
              </div>
            ) : (
              <div className="map-ged-badge none">
                검정고시 전형 정보 준비 중
              </div>
            )}

            <button
              className="map-card-cta"
              onClick={() => goTo('detail', { univ: selected.name, univId: selected.univId })}
            >
              전형 자세히 보기 <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {MAP_ENABLED && !selected && (
        <p className="map-legend">
          <span className="dot dot-ged" /> 검정고시 전형 있음
          <span className="dot dot-none" /> 정보 준비 중
        </p>
      )}
    </div>
  );
}
