import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Phone, MapPin, Search, Navigation, List, Map as MapIcon, X,
  Wallet, HeartHandshake, Compass, Users, GraduationCap, Lock, Gift,
} from 'lucide-react';
import centersRaw from '../data/kkumdrim.json';
import { getCenterBenefits } from '../lib/benefits';

// 카테고리 icon 이름 → lucide 컴포넌트 매핑
const BENEFIT_ICONS = { Wallet, HeartHandshake, Compass, Users, GraduationCap };

// "이 센터가 주는 것" 혜택 카테고리 칩 블록
// 정직성 원칙: 정리된 데이터가 없으면 없는 척하지 않고 자물쇠/문의 폴백을 보여준다.
function BenefitChips({ center }) {
  const { categories, note, known } = getCenterBenefits(center);

  if (!known) {
    return (
      <div className="kdream-benefit-block">
        <div className="kdream-benefit-head">
          <Gift size={13} /> 이 센터가 주는 것
        </div>
        <div className="kdream-benefit-locked">
          <Lock size={13} />
          <span>아직 정리된 혜택 정보가 없어요. 센터마다 지원이 다르니 <b>직접 문의</b>해 확인해 주세요.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="kdream-benefit-block">
      <div className="kdream-benefit-head">
        <Gift size={13} /> 이 센터가 주는 것
      </div>
      <div className="kdream-benefit-chips">
        {categories.map((cat) => {
          const Icon = BENEFIT_ICONS[cat.icon];
          return (
            <span key={cat.id} className="kdream-benefit-chip" title={cat.desc}>
              {Icon && <Icon size={12} />} {cat.label}
            </span>
          );
        })}
      </div>
      {note && <p className="kdream-benefit-note">{note}</p>}
      <p className="kdream-benefit-disclaimer">※ 정확한 대상·금액은 센터에 확인이 필요해요.</p>
    </div>
  );
}

// 좌표 없는 센터 제외 (지도용)
const centersWithCoord = centersRaw.filter((c) => c.lat && c.lng);

// Haversine 거리 (km)
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distLabel(km) {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

// 지역 목록
const REGIONS = [
  '전체', '서울', '경기', '인천', '부산', '대구', '광주', '대전',
  '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const regionCount = centersRaw.reduce((acc, c) => {
  acc[c.region] = (acc[c.region] || 0) + 1;
  return acc;
}, {});

// ── Leaflet 지도 컴포넌트 ─────────────────────────────────────────────
function KdreamMap({ centers, userPos, onSelectCenter, selectedId }) {
  const mapRef   = useRef(null);
  const leafRef  = useRef(null);
  const markerMap = useRef({});
  const userMarkerRef = useRef(null);

  // 지도 초기화
  useEffect(() => {
    if (leafRef.current) return; // 이미 초기화됨

    import('leaflet').then((L) => {
      // CSS 동적 삽입
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id   = 'leaflet-css';
        link.rel  = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // 기본 마커 아이콘 경로 수정 (Vite 번들링 이슈)
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, {
        center: [36.5, 127.8],
        zoom: 7,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      leafRef.current = { L, map };
    });

    return () => {
      if (leafRef.current) {
        leafRef.current.map.remove();
        leafRef.current = null;
        markerMap.current = {};
      }
    };
  }, []);

  // 센터 마커 업데이트
  useEffect(() => {
    if (!leafRef.current) return;
    const { L, map } = leafRef.current;

    // 기존 마커 제거
    Object.values(markerMap.current).forEach((m) => m.remove());
    markerMap.current = {};

    // 새 마커 추가
    const normalIcon = L.divIcon({
      className: '',
      html: '<div class="kdream-marker"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const selIcon = L.divIcon({
      className: '',
      html: '<div class="kdream-marker selected"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    centers.forEach((c) => {
      if (!c.lat || !c.lng) return;
      const marker = L.marker([c.lat, c.lng], {
        icon: c.id === selectedId ? selIcon : normalIcon,
      })
        .addTo(map)
        .bindPopup(
          `<b>${c.name}</b><br/>${c.district}<br/><a href="tel:${c.phone}">${c.phone}</a>`
        );
      marker.on('click', () => onSelectCenter(c));
      markerMap.current[c.id] = marker;
    });

    // 마커 있으면 fitBounds
    if (centers.length > 0 && centers.some((c) => c.lat)) {
      const latlngs = centers.filter((c) => c.lat).map((c) => [c.lat, c.lng]);
      if (latlngs.length > 0) {
        map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 13 });
      }
    }
  }, [centers, selectedId, onSelectCenter]);

  // 내 위치 마커
  useEffect(() => {
    if (!leafRef.current || !userPos) return;
    const { L, map } = leafRef.current;

    if (userMarkerRef.current) userMarkerRef.current.remove();

    const meIcon = L.divIcon({
      className: '',
      html: '<div class="kdream-marker me"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon: meIcon })
      .addTo(map)
      .bindPopup('<b>내 위치</b>');

    map.setView([userPos.lat, userPos.lng], 11);
  }, [userPos]);

  return <div ref={mapRef} className="kdream-map" />;
}

// ── 메인 화면 ─────────────────────────────────────────────────────────
export default function DreamdriveScreen({ goBack = () => {} }) {
  const [region,   setRegion]   = useState('전체');
  const [query,    setQuery]    = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [userPos,  setUserPos]  = useState(null);   // { lat, lng }
  const [locState, setLocState] = useState('idle'); // 'idle'|'loading'|'ok'|'denied'
  const [selected, setSelected] = useState(null);   // 선택된 센터 (지도 클릭)

  // 내 위치 요청
  function requestLocation() {
    setLocState('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocState('ok');
      },
      () => setLocState('denied'),
      { timeout: 10000 }
    );
  }

  // 필터링
  const filtered = useMemo(() => {
    let out = region === '전체' ? [...centersRaw] : centersRaw.filter((c) => c.region === region);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q)
      );
    }
    // 내 위치 있으면 거리순 정렬
    if (userPos) {
      out = out
        .map((c) => ({
          ...c,
          _dist: c.lat ? haversine(userPos.lat, userPos.lng, c.lat, c.lng) : Infinity,
        }))
        .sort((a, b) => a._dist - b._dist);
    }
    return out;
  }, [region, query, userPos]);

  // 지도에 표시할 센터 (좌표 있는 것만)
  const mapCenters = useMemo(
    () => filtered.filter((c) => c.lat && c.lng),
    [filtered]
  );

  const handleSelectCenter = useCallback((c) => {
    setSelected(c);
    setViewMode('list'); // 선택하면 목록으로 전환해 상세 표시
  }, []);

  return (
    <div className="screen kdream-screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">꿈드림센터 찾기</span>
        {/* 목록 / 지도 전환 */}
        <div className="kdream-view-toggle">
          <button
            className={`kdream-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List size={16} />
          </button>
          <button
            className={`kdream-toggle-btn${viewMode === 'map' ? ' active' : ''}`}
            onClick={() => setViewMode('map')}
          >
            <MapIcon size={16} />
          </button>
        </div>
      </header>

      {/* ── 검색 + 위치 버튼 ── */}
      <div className="kdream-top-bar">
        <div className="kdream-search-wrap">
          <Search size={15} className="kdream-search-ico" />
          <input
            className="kdream-search-input"
            type="text"
            placeholder="센터명, 지역, 주소 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="kdream-clear-btn" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          className={`kdream-loc-btn${locState === 'ok' ? ' active' : ''}`}
          onClick={requestLocation}
          disabled={locState === 'loading'}
          title="내 위치 기반 정렬"
        >
          <Navigation size={16} />
          {locState === 'loading' && <span className="kdream-loc-label">…</span>}
          {locState === 'ok'      && <span className="kdream-loc-label">가까운 순</span>}
          {locState === 'denied'  && <span className="kdream-loc-label" style={{ color: 'var(--danger)' }}>차단됨</span>}
          {locState === 'idle'    && <span className="kdream-loc-label">내 위치</span>}
        </button>
      </div>

      {/* 지역 필터 */}
      <div className="kdream-region-scroll">
        {REGIONS.map((r) => (
          <button
            key={r}
            className={`fchip kdream-region-chip${region === r ? ' active' : ''}`}
            onClick={() => { setRegion(r); setSelected(null); }}
          >
            {r}
            {r !== '전체' && regionCount[r] && (
              <span className="kdream-chip-cnt"> {regionCount[r]}</span>
            )}
          </button>
        ))}
      </div>

      {/* 결과 수 */}
      <p className="kdream-result-count">
        {filtered.length}개 센터
        {userPos && <span className="kdream-near-badge"> · 가까운 순</span>}
        {filtered.length === 0 && <span style={{ color: 'var(--brand)' }}> — 조건을 바꿔보세요</span>}
      </p>

      {/* ── 지도 뷰 ── */}
      {viewMode === 'map' && (
        <div className="kdream-map-wrap">
          <KdreamMap
            centers={mapCenters}
            userPos={userPos}
            onSelectCenter={handleSelectCenter}
            selectedId={selected?.id}
          />
          {/* 지도 위 선택된 센터 팝업 */}
          {selected && (
            <div className="kdream-map-panel">
              <button className="kdream-map-panel-close" onClick={() => setSelected(null)}>
                <X size={14} />
              </button>
              <div className="kdream-card-name">{selected.name}</div>
              <div className="kdream-card-meta">
                <MapPin size={11} /> {selected.region} {selected.district}
              </div>
              {selected.address && (
                <p className="kdream-card-address" style={{ marginTop: 6 }}>{selected.address}</p>
              )}
              {selected._dist != null && selected._dist !== Infinity && (
                <p className="kdream-near-dist">📍 내 위치에서 {distLabel(selected._dist)}</p>
              )}
              <BenefitChips center={selected} />
              {selected.phone && (
                <a className="kdream-action-btn call" href={`tel:${selected.phone}`} style={{ marginTop: 8 }}>
                  <Phone size={14} /> {selected.phone}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 목록 뷰 ── */}
      {viewMode === 'list' && (
        <div className="kdream-list-wrap">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`kdream-list-card${selected?.id === c.id ? ' selected' : ''}`}
              onClick={() => setSelected(selected?.id === c.id ? null : c)}
            >
              {/* 카드 헤더 */}
              <div className="kdream-list-card-head">
                <div className="kdream-card-left">
                  <div className="kdream-card-name">{c.name}</div>
                  <div className="kdream-card-meta">
                    <MapPin size={11} /> {c.region} {c.district}
                    {c._dist != null && c._dist !== Infinity && (
                      <span className="kdream-dist-chip">{distLabel(c._dist)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 펼쳐진 상세 */}
              {selected?.id === c.id && (
                <div className="kdream-list-card-body">
                  {c.address && <p className="kdream-card-address">{c.address}</p>}
                  {c._dist != null && c._dist !== Infinity && (
                    <p className="kdream-near-dist">📍 내 위치에서 {distLabel(c._dist)}</p>
                  )}
                  <BenefitChips center={c} />
                  <div className="kdream-actions">
                    {c.phone && (
                      <a
                        className="kdream-action-btn call"
                        href={`tel:${c.phone}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone size={14} /> {c.phone}
                      </a>
                    )}
                    {c.lat && (
                      <button
                        className="kdream-action-btn web"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewMode('map');
                        }}
                      >
                        <MapIcon size={14} /> 지도에서 보기
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="kdream-footer-note">
        <p>📞 전국 공통 상담 전화: <b>1388</b> (24시간)</p>
        <p>만 9~24세 학교 밖 청소년이라면 누구나 무료로 이용할 수 있어요.</p>
        <p className="kdream-source">출처: 여성가족부 2025 학교밖청소년지원센터 주소록 (250821)</p>
      </div>
    </div>
  );
}
