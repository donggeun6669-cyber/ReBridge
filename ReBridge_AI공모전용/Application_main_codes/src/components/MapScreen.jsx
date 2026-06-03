import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, MapPin, X } from 'lucide-react';
import universities from '../data/universities.json';
import { getExploreList } from '../lib/analysis.js';

// Leaflet을 CDN에서 lazy 로드 — npm 의존성/번들 영향 0. (지도 타일은 어차피 원격이라 적합)
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.getElementById('leaflet-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L));
      existing.addEventListener('error', reject);
      if (window.L) resolve(window.L);
      return;
    }
    const s = document.createElement('script');
    s.id = 'leaflet-js';
    s.src = LEAFLET_JS;
    s.async = true;
    s.onload = () => resolve(window.L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function MapScreen({ goTo = () => {}, goBack = () => {} }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [selected, setSelected] = useState(null);

  // 좌표 + 검정고시 전형수 병합
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

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
          center: [36.5, 127.8],
          zoom: 7,
          zoomControl: true,
          attributionControl: true,
        });
        mapRef.current = map;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap',
        }).addTo(map);

        points.forEach((p) => {
          const hasGed = p.eligibleCount > 0;
          const m = L.circleMarker([p.lat, p.lng], {
            radius: 5,
            weight: 1.5,
            color: '#ffffff',
            fillColor: hasGed ? '#5B3FD6' : '#A7A2B6',
            fillOpacity: 0.92,
          });
          m.on('click', () => setSelected(p));
          m.addTo(map);
        });

        // flex 레이아웃에서 컨테이너 크기 측정 보정
        setTimeout(() => map.invalidateSize(), 0);
        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points]);

  return (
    <div className="screen map-screen">
      <header className="topbar center map-topbar">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">지도로 보기</span>
      </header>

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

        {selected && (
          <div className="map-card">
            <button
              className="icon-btn map-card-close"
              aria-label="닫기"
              onClick={() => setSelected(null)}
            >
              <X size={16} />
            </button>
            <div className="map-card-name">{selected.name}</div>
            <div className="map-card-meta">
              <MapPin size={13} /> {selected.region}
              {selected.establishment ? ` · ${selected.establishment}` : ''}
              {selected.kind === '전문대학' ? ' · 전문대학' : ''}
              {selected.eligibleCount > 0 ? ` · 검정고시 ${selected.eligibleCount}전형` : ''}
            </div>
            <button
              className="map-card-cta"
              onClick={() => goTo('detail', { univ: selected.name, univId: selected.univId })}
            >
              전형 자세히 보기 <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <p className="map-legend">
          <span className="dot dot-ged" /> 검정고시 지원 전형 있음
          <span className="dot dot-none" /> 정보 준비 중
        </p>
      )}
    </div>
  );
}
