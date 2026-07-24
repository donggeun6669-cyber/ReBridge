import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Phone, MapPin, Search, Navigation, X,
  Wallet, HeartHandshake, Compass, Users, GraduationCap, Lock, Activity,
  CheckCircle, Map as MapIcon, Copy, ChevronLeft, ChevronRight,
} from 'lucide-react';
import centersRaw from '../data/kkumdrim.json';
import { getCenterBenefits } from '../lib/benefits';
import { useKakaoMap, MAP_ENABLED } from '../lib/kakaoMap.js';

const BENEFIT_ICONS = { Wallet, HeartHandshake, Compass, Users, GraduationCap, Activity };

function BenefitChips({ center }) {
  const { categories, note, known } = getCenterBenefits(center);
  if (!known) {
    return (
      <div className="kdream-benefit-block">
        <div className="kdream-benefit-locked">
          <Lock size={13} />
          <span>아직 정리된 혜택 정보가 없어요. <b>직접 문의</b>해 확인해 주세요.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="kdream-benefit-block">
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

const REGIONS = [
  '전체', '서울', '경기', '인천', '부산', '대구', '광주', '대전',
  '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const regionCount = centersRaw.reduce((acc, c) => {
  acc[c.region] = (acc[c.region] || 0) + 1;
  return acc;
}, {});

// ── 카카오맵 컴포넌트 ──────────────────────────────────────────────────
function KakaoMapView({ centers, userPos, onSelectCenter, selectedId }) {
  const { containerRef, mapRef, runWhenReady } = useKakaoMap({ lat: 36.5, lng: 127.8, level: 12 });
  const overlaysRef = useRef([]);
  const meOverlayRef = useRef(null);

  // 센터 마커 업데이트
  useEffect(() => {
    const update = () => {
      if (!mapRef.current) return;
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];

      centers.forEach((c) => {
        if (!c.lat || !c.lng) return;
        const pos = new window.kakao.maps.LatLng(c.lat, c.lng);
        const isSel = c.id === selectedId;
        const el = document.createElement('div');
        el.className = `kdream-kakao-dot${isSel ? ' sel' : ''}`;
        el.addEventListener('click', () => onSelectCenter(c));
        const overlay = new window.kakao.maps.CustomOverlay({
          position: pos, content: el, zIndex: isSel ? 5 : 1,
        });
        overlay.setMap(mapRef.current);
        overlaysRef.current.push(overlay);
      });

      // 위치 없을 때: 센터 전체가 보이도록 bounds 맞춤
      if (!userPos && centers.length > 0) {
        const valid = centers.filter((c) => c.lat && c.lng);
        if (valid.length > 0) {
          const bounds = new window.kakao.maps.LatLngBounds();
          valid.forEach((c) => bounds.extend(new window.kakao.maps.LatLng(c.lat, c.lng)));
          mapRef.current.setBounds(bounds, 40, 40, 40, 40);
        }
      }
    };
    runWhenReady(update);
    return () => {
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
    };
  }, [centers, selectedId, userPos, onSelectCenter, runWhenReady, mapRef]);

  // 내 위치 마커 + 지도 이동
  useEffect(() => {
    if (!userPos) return;
    const update = () => {
      if (!mapRef.current) return;
      if (meOverlayRef.current) meOverlayRef.current.setMap(null);
      const pos = new window.kakao.maps.LatLng(userPos.lat, userPos.lng);
      const el = document.createElement('div');
      el.className = 'kdream-kakao-me';
      meOverlayRef.current = new window.kakao.maps.CustomOverlay({
        position: pos, content: el, zIndex: 10,
      });
      meOverlayRef.current.setMap(mapRef.current);
      mapRef.current.setCenter(pos);
      mapRef.current.setLevel(9);
    };
    runWhenReady(update);
    return () => {
      if (meOverlayRef.current) { meOverlayRef.current.setMap(null); meOverlayRef.current = null; }
    };
  }, [userPos, runWhenReady, mapRef]);

  return <div ref={containerRef} className="kdream-map" />;
}

// ── 메인 화면 ─────────────────────────────────────────────────────────
export default function DreamdriveScreen({ goBack = () => {}, params = {} }) {
  const [region, setRegion] = useState('전체');
  const [query, setQuery] = useState('');
  const [userPos, setUserPos] = useState(null);
  const [locConsent, setLocConsent] = useState('idle');
  const [showConsent, setShowConsent] = useState(false);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(null);
  const listRef = useRef(null);
  const PAGE_SIZE = 10;

  // 첫 진입 시 위치 동의 창 자동 표시
  useEffect(() => {
    setShowConsent(true);
  }, []);

  // 검색 결과에서 직접 진입 시 해당 센터 자동 선택
  useEffect(() => {
    if (params.centerId) {
      const center = centersRaw.find((c) => c.id === params.centerId);
      if (center) { setSelected(center); setRegion(center.region); }
    }
  }, [params.centerId]);

  // 동의 → 위치 수집 + 지도 이동
  const handleConsent = useCallback(() => {
    setShowConsent(false);
    setLocConsent('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocConsent('granted');
      },
      () => setLocConsent('denied'),
      { timeout: 10000 }
    );
  }, []);

  // 거절 → 동의창 닫기, 위치 없이 지도 표시
  const handleDeny = useCallback(() => {
    setShowConsent(false);
    setLocConsent('denied');
  }, []);

  // 지역 변경 시 선택·페이지 초기화
  const changeRegion = useCallback((r) => {
    setRegion(r);
    setSelected(null);
    setPage(1);
  }, []);

  // 필터링 + 거리 정렬
  const filtered = useMemo(() => {
    let out = region === '전체' ? [...centersRaw] : centersRaw.filter((c) => c.region === region);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q) ||
          (c.address || '').toLowerCase().includes(q)
      );
    }
    if (userPos) {
      out = out
        .map((c) => ({ ...c, _dist: c.lat ? haversine(userPos.lat, userPos.lng, c.lat, c.lng) : Infinity }))
        .sort((a, b) => a._dist - b._dist);
    }
    return out;
  }, [region, query, userPos]);

  const mapCenters = useMemo(() => filtered.filter((c) => c.lat && c.lng), [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page, PAGE_SIZE]
  );

  // 지도 마커 클릭 시 → 해당 센터가 있는 페이지로 이동 + 카드 열기
  const handleSelectCenter = useCallback((c) => {
    setSelected(c);
    const idx = filtered.findIndex((x) => x.id === c.id);
    if (idx !== -1) {
      const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
      setPage(targetPage);
    }
    setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-id="${c.id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
  }, [filtered, PAGE_SIZE]);

  // 주소 복사
  const copyAddress = useCallback((e, c) => {
    e.stopPropagation();
    const text = c.address || `${c.region} ${c.district} ${c.name}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(c.id);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);

  return (
    <div className="screen kdream-screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={22} />
        </button>
        <span className="page-title">꿈드림센터 찾기</span>
        <div style={{ width: 44 }} />
      </header>

      {/* 위치 동의 모달 */}
      {showConsent && (
        <div className="kdream-consent-overlay">
          <div className="kdream-consent-modal">
            <div className="kdream-consent-icon">
              <Navigation size={26} />
            </div>
            <h3 className="kdream-consent-title">내 위치를 사용할까요?</h3>
            <p className="kdream-consent-desc">
              내 위치를 기반으로 가까운 꿈드림센터를<br />
              {MAP_ENABLED ? '지도에 표시하고 거리 순으로 안내해 드려요.' : '거리 순으로 안내해 드려요.'}<br />
              위치 정보는 이 앱 외부로 전송되지 않아요.
            </p>
            <div className="kdream-consent-btns">
              <button className="kdream-consent-deny" onClick={handleDeny}>그냥 볼게요</button>
              <button className="kdream-consent-agree" onClick={handleConsent}>
                <CheckCircle size={15} /> 동의하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 검색 + 위치 상태 */}
      <div className="kdream-top-bar">
        <div className="kdream-search-wrap">
          <Search size={15} className="kdream-search-ico" />
          <input
            className="kdream-search-input"
            type="text"
            placeholder="센터명, 지역, 주소 검색"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
          {query && (
            <button className="kdream-clear-btn" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
        {locConsent === 'loading' && (
          <span className="kdream-loc-badge loading">위치 확인 중…</span>
        )}
        {locConsent === 'granted' && (
          <span className="kdream-loc-badge granted"><Navigation size={12} /> 가까운 순</span>
        )}
      </div>

      {/* ── 카카오맵 (점검 중엔 안내로 대체 — lib/kakaoMap.js 의 MAP_ENABLED) ── */}
      {MAP_ENABLED && (
      <div className="kdream-map-wrap">
        <KakaoMapView
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
              {selected._dist != null && selected._dist !== Infinity && (
                <span className="kdream-dist-chip">{distLabel(selected._dist)}</span>
              )}
            </div>
            {selected.phone && (
              <a className="kdream-action-btn call" href={`tel:${selected.phone}`} style={{ marginTop: 8, display: 'inline-flex' }}>
                <Phone size={14} /> {selected.phone}
              </a>
            )}
          </div>
        )}
      </div>
      )}

      {/* ── 지역 필터 ── */}
      <div className="kdream-region-scroll">
        {REGIONS.map((r) => (
          <button
            key={r}
            className={`fchip kdream-region-chip${region === r ? ' active' : ''}`}
            onClick={() => changeRegion(r)}
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
        {region === '전체' ? '전국' : region} <b>{filtered.length}개 센터</b>
        {locConsent === 'granted' && <span className="kdream-near-badge"> · 가까운 순</span>}
      </p>

      {/* ── 목록 (10개씩 페이지네이션) ── */}
      <div className="kdream-list-wrap" ref={listRef}>
        {pageItems.map((c) => {
          const open = selected?.id === c.id;
          return (
            <div
              key={c.id}
              data-id={c.id}
              className={`kdream-list-card${open ? ' selected' : ''}`}
              onClick={() => setSelected(open ? null : c)}
            >
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
                {c.phone && (
                  <a
                    className="kdream-list-call-btn"
                    href={`tel:${c.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    title={c.phone}
                  >
                    <Phone size={15} />
                  </a>
                )}
              </div>

              {open && (
                <div className="kdream-list-card-body">
                  {c.address && (
                    <div className="kdream-address-row">
                      <p className="kdream-card-address">{c.address}</p>
                      <button
                        className={`kdream-copy-btn${copied === c.id ? ' done' : ''}`}
                        onClick={(e) => copyAddress(e, c)}
                        title="주소 복사"
                      >
                        {copied === c.id ? '복사됨' : <><Copy size={12} /> 복사</>}
                      </button>
                    </div>
                  )}
                  {c._dist != null && c._dist !== Infinity && (
                    <p className="kdream-near-dist">내 위치에서 {distLabel(c._dist)}</p>
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
                        onClick={(e) => { e.stopPropagation(); handleSelectCenter(c); }}
                      >
                        <MapIcon size={14} /> 지도에서 보기
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 페이지네이션 ── */}
      {totalPages > 1 && (
        <div className="kdream-pagination">
          <button
            className="kdream-page-btn"
            onClick={() => { setPage((p) => Math.max(1, p - 1)); setSelected(null); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            disabled={page === 1}
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="kdream-page-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  className={`kdream-page-num${page === p ? ' active' : ''}`}
                  onClick={() => { setPage(p); setSelected(null); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                >
                  {p}
                </button>
              )
            )}
          <button
            className="kdream-page-btn"
            onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); setSelected(null); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            disabled={page === totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div className="kdream-footer-note">
        <p>전국 공통 상담 전화: <b>1388</b> (24시간)</p>
        <p>만 9~24세 학교 밖 청소년이라면 누구나 무료로 이용할 수 있어요.</p>
        <p className="kdream-source">출처: 여성가족부 2025 학교밖청소년지원센터 주소록</p>
      </div>
    </div>
  );
}
