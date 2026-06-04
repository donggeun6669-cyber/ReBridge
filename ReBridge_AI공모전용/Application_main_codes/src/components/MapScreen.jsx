import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, MapPin, X } from 'lucide-react';
import universities from '../data/universities.json';
import { getExploreList } from '../lib/analysis.js';

const KAKAO_KEY = '1be261c8c8703e28f0be58b4c193468e';

/* ── Kakao Maps SDK 동적 로드 (autoload=false + clusterer 라이브러리) ── */
function loadKakao() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  // 이미 완전히 로드된 경우
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps);

  return new Promise((resolve, reject) => {
    // 스크립트 태그는 이미 있지만 아직 로딩 중인 경우 — 폴링으로 대기
    if (document.getElementById('kakao-sdk')) {
      const tid = setInterval(() => {
        if (window.kakao?.maps?.Map) { clearInterval(tid); resolve(window.kakao.maps); }
      }, 100);
      setTimeout(() => { clearInterval(tid); reject(new Error('timeout')); }, 12000);
      return;
    }
    const s = document.createElement('script');
    s.id = 'kakao-sdk';
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=clusterer`;
    s.async = true;
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao.maps));
    s.onerror = () => reject(new Error('Kakao SDK 로드 실패'));
    document.head.appendChild(s);
  });
}

/* ── 색상 원형 SVG 마커 이미지 생성 ── */
function makeMarkerImage(maps, hasGed) {
  const fill = hasGed ? '#2E8BD0' : '#C4BFCF';
  const stroke = hasGed ? '#fff' : '#E5E0EF';
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14">` +
    `<circle cx="7" cy="7" r="5.5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
    `</svg>`
  );
  return new maps.MarkerImage(
    `data:image/svg+xml;charset=utf-8,${svg}`,
    new maps.Size(14, 14),
    { offset: new maps.Point(7, 7) }
  );
}

/* ── 클러스터 스타일 (네이비 원형 뱃지) ── */
const CLUSTER_STYLES = [{
  width: '40px', height: '40px',
  background: 'rgba(46,139,208,0.88)',
  borderRadius: '50%',
  color: '#fff',
  textAlign: 'center',
  lineHeight: '40px',
  fontSize: '13px',
  fontWeight: '700',
  boxShadow: '0 2px 8px rgba(46,139,208,0.35)',
}];

const FILTERS = ['전체', '검정고시 전형', '4년제', '전문대'];

export default function MapScreen({ goTo = () => {}, goBack = () => {} }) {
  const containerRef = useRef(null);
  const mapRef      = useRef(null);
  const mapsRef     = useRef(null);
  const clusterRef  = useRef(null);

  const [status,   setStatus]   = useState('loading'); // loading | ready | error
  const [selected, setSelected] = useState(null);
  const [filter,   setFilter]   = useState('전체');

  /* ── 대학 포인트 데이터 (좌표 + 검정고시 전형 수) ── */
  const points = useMemo(() => {
    const elig = new Map(getExploreList().map((s) => [s.univId, s.eligibleCount]));
    return universities
      .filter((u) => u.lat != null && u.lng != null)
      .map((u) => ({
        univId:        u.univId,
        name:          u.name,
        region:        u.region,
        kind:          u.kind || '대학교',
        establishment: u.establishment || '',
        lat:           u.lat,
        lng:           u.lng,
        eligibleCount: elig.get(u.univId) || 0,
      }));
  }, []);

  /* ── 필터 적용 ── */
  const filtered = useMemo(() => {
    if (filter === '검정고시 전형') return points.filter((p) => p.eligibleCount > 0);
    if (filter === '4년제')        return points.filter((p) => p.kind !== '전문대학');
    if (filter === '전문대')       return points.filter((p) => p.kind === '전문대학');
    return points;
  }, [points, filter]);

  /* ── 지도 초기화 (마운트 1회) ── */
  useEffect(() => {
    let cancelled = false;
    loadKakao()
      .then((maps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(36.5, 127.8),
          level: 8,
        });
        mapRef.current   = map;
        mapsRef.current  = maps;
        clusterRef.current = new maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 5,
          disableClickZoom: false,
          styles: CLUSTER_STYLES,
        });

        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 마커 갱신 (필터 변경 or 지도 준비 완료 시) ── */
  useEffect(() => {
    const maps    = mapsRef.current;
    const cluster = clusterRef.current;
    if (!maps || !cluster) return;

    cluster.clear();

    const markers = filtered.map((p) => {
      const marker = new maps.Marker({
        position: new maps.LatLng(p.lat, p.lng),
        image:    makeMarkerImage(maps, p.eligibleCount > 0),
        title:    p.name,
      });
      maps.event.addListener(marker, 'click', () => setSelected(p));
      return marker;
    });

    cluster.addMarkers(markers);
  }, [filtered, status]);

  /* ── 선택 초기화 (필터 바뀔 때) ── */
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
