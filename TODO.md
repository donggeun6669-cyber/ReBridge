# ReBridge 작업 리스트

> 최종 업데이트: 2026-06-02
> 정본 저장소: https://github.com/donggeun6669-cyber/ReBridge · 라이브: https://rebridge-rho.vercel.app

---

## ✅ 최근 완료 (2026-06-02)

- [x] 탐색 탭 배지 `지원 가능` → `검정고시 가능` (지원 *자격* 의미로 명확화)
- [x] 탐색 탭 하단 안내를 "실제 합격 가능성은 점수·경쟁률에 따라 달라요"로 (합격 단정 안 함)
- [x] 탐색 탭 지역 필터(전체/서울/수도권/지방거점/기타/전문대학) 정상화
- [x] FAQ 상세 카드 아이콘 전부 파란색이던 문제 → 카드마다 색 순환(초록/노랑/파랑/빨강)
- [x] **배포 반영 안 되던 진짜 원인 해결** — Vercel 엣지/브라우저 캐시. `vercel.json`에 캐시 헤더(에셋 immutable, index.html no-cache) 추가
- [x] 빌드 스탬프(프로필 하단 `build MM-DD HH:mm`) + `npm run deploy` / `npm run verify` 도구
- [x] 팀 협업 셋업 — README, GitHub push

---

## 🔴 긴급 / 보안

- [ ] **VITE_ API 키 노출 차단** — `VITE_GEMINI_API_KEY`·`VITE_CAREERNET_API_KEY`가 배포 번들에 그대로 박혀 누구나 추출 가능. 키 재발급 + Vercel 서버리스 함수(`/api/*`)로 옮겨 서버에만 보관. (과금 악용 위험)

---

## A. 데이터 (최우선)

- [ ] 핵심 대학 상세 8곳 추가 — **부산대(1순위)** → 국민·인하·한양·서울과기·경북·충남·전북
- [ ] OCR 실패 3곳(경희·이화·순천) 한글 재다운로드 → 반영
- [ ] 학생부교과 '일괄 불가' 중 검정고시 교과전형 운영 대학 → '가능'으로 보정
- [ ] 비교내신 환산식(comparativeGrade) 핵심 대학부터 입력 (학종·교과 지원자에 큰 도움)
- [ ] 입학처 정확 URL 교체 / 전문대 PDF 수집 여부 결정

## B. 앱 기능

- [ ] 지도(Leaflet + OSM) — 좌표 다 있어서 바로 가능
- [ ] 관심 대학 저장(북마크) — 마이페이지 메뉴만 있고 기능 없음
- [ ] 탐색 탭 실데이터 연결 — 현재 예시 15곳 하드코딩 → `admissions.json`으로
- [ ] 결과/상세에 데이터 신뢰도(확정 vs 기본) 표시

## C. 협업 / 운영

- [x] 팀원이 클론·작업 가능하도록 README + push 완료
- [ ] 팀원 GitHub 저장소 Collaborator 초대 (Settings → Collaborators)
- [ ] 팀원에게 `.env` 키 안전하게 공유
- [ ] (선택) Vercel ↔ GitHub 자동배포 연결 — 현재는 CLI 수동배포
- [ ] (정리) 옛 복사본 `~/Documents/Codex/...extract/` 사용 금지 — 정본은 GitHub 저장소 하나뿐

---

## 작업 규칙 (사고 방지)

1. 작업 **전 `git pull`**, **후 `git push`** — "수정이 사라졌다" 방지
2. 앱 코드는 항상 `ReBridge_AI공모전용/Application_main_codes/` 에서만 수정
3. 배포 후 화면이 안 바뀌면 → 캐시. 시크릿창 또는 주소 뒤 `?v=1`, 또는 `npm run verify`
