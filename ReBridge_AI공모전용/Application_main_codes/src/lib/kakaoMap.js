// 카카오맵 SDK 로더 + 지도 초기화 훅 — MapScreen/DreamdriveScreen 공용.
// (예전엔 두 화면에 같은 로딩 코드가 복사돼 있었음. 마커 그리기는 화면별로 다르므로 각자 유지)
import { useCallback, useEffect, useRef } from 'react';

// 카카오 JS 키는 도메인 제한이 걸린 공개용 키라 클라이언트 노출이 정상.
const KAKAO_KEY = '1be261c8c8703e28f0be58b4c193468e';
const SCRIPT_ID = 'kakao-map-sdk';

// 반환: { containerRef(지도 div에 연결), mapRef, runWhenReady(지도 준비 후 실행) }
export function useKakaoMap({ lat, lng, level }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const pendingRef = useRef(null);

  const runWhenReady = useCallback((fn) => {
    if (readyRef.current) fn();
    else pendingRef.current = fn;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initMap = () => {
      if (cancelled || !containerRef.current) return;
      window.kakao.maps.load(() => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level,
        });
        readyRef.current = true;
        if (pendingRef.current) { pendingRef.current(); pendingRef.current = null; }
      });
    };

    if (window.kakao?.maps) {
      initMap();
    } else {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', initMap);
      } else {
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
        script.onload = initMap;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      mapRef.current = null;
      readyRef.current = false;
    };
    // 초기 중심/레벨은 마운트 시 한 번만 사용.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, mapRef, runWhenReady };
}
