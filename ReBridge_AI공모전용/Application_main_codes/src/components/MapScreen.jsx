import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, MapPin, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import universities from '../data/universities.json';
import { getExploreList } from '../lib/analysis.js';

// Leaflet + OpenStreetMap — API 키·도메인 등록이 필요 없는 무료 지도.
// (카카오 지도 SDK는 허용 도메인 등록이 필요해 배포·로컬에서 막히는 문제가 있어 교체함.)

const FILTERS = ['전체', '검정고시 전형', '4년제', '전문대'];

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default function MapScreen({ goTo = () => {}, goBack = () => {} }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const layerRef     = useRef(null);

  const [status,   setStatus]   = useState('loading'); // loading | ready | error
  const [selected, setSelected] = useState(null);
  const [filter,   setFilter]   = useState('전체');

  /* ── 대학 포인트 (좌표 + 검정고시 전형 수) ── */
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
    if (filter === '4년제')        return points.filter((p) => p.kind !== '전문대학');
    if (filter === '전문대')       return points.filter((p) => p.kind === '전문대학');
    return points;
  }, [points, filter]);

  /* ── 지도 초기화 (마운트 1회) ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const map = L.map(containerRef.current, {
        center: [36.3, 127.8],
        zoom: 7,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // 컨테이너가 늦게 잡히는 경우 대비 — 크기 재계산
      setTimeout(() => { try { map.invalidateSize(); } catch { /* 무시 */ } }, 60);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; layerRef.current = null; }
    };
  }, []);

  /* ── 마커 갱신 (필터·준비 상태 변경 시) ── */
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || status !== 'ready') return;
    layer.clearLayers();

    filtered.forEach((p) => {
      const hasGed = p.eligibleCount > 0;
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 6,
        fillColor: hasGed ? '#2E8BD0' : '#C4BFCF',
        color: '#fff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 1,
      });
      marker.on('click', () => setSelected(p));
      marker.bindTooltip(p.name, { direction: 'top', offset: [0, -4] });
      layer.addLayer(marker);
    });
  }, [filtered, status]);

  const handleFilter = (opt) => {
    setFilter(opt);
    setSelected(null);
  };

  return (
    <div className="screen map-screen">
      <header className="topbar center map-topbar">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">지도로 보기</span>
      </header>

      {/* 필터 바 */}
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

      {/* 지도 영역 */}
      <div className="map-wrap">
        <div className="map-canvas" ref={containerRef} />

        {status === 'loading' && (
          <div className="map-overlay">지도를 불러오는 중이에요…</div>
        )}
        {status === 'error' && (
          <div className="map-overlay">
            지도를 불러오지 못했어요.
            <br />
            인터넷 연결을 확인해 주세요.
          </div>
        )}

        {/* 하단 슬라이딩 카드 */}
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

      {/* 범례 (카드 없을 때만 표시) */}
      {status === 'ready' && !selected && (
        <p className="map-legend">
          <span className="dot dot-ged" /> 검정고시 전형 있음
          <span className="dot dot-none" /> 정보 준비 중
        </p>
      )}
    </div>
  );
}
