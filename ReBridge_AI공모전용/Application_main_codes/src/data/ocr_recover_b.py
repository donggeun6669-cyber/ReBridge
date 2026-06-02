"""
작업 B: 누락 핵심대학 OCR 복구
- Apple Vision OCR (macOS 내장, Neural Engine) 사용
- 전략: 전체 PDF OCR 안 함. 누락 대학이 있는 페이지만 골라 OCR.
- 대상: 서울_4, 인천_2, 인천_3, 전북_2 (충남대는 충남_1/2 OCR 페이지)
"""

import json, re, pathlib, sys, time, collections
import fitz  # PyMuPDF — 페이지→이미지 변환

BASE    = pathlib.Path(__file__).parent
PDF_DIR = BASE / "pdf_sources" / "2025"
CLEAN   = BASE / "results_2025_clean.json"
UNIV    = BASE / "universities.json"
OUT     = BASE / "results_2025_clean.json"   # 덮어씌워 업데이트

univs = {u["univId"]: u for u in json.loads(UNIV.read_text())}
rows  = json.loads(CLEAN.read_text())

MISSING = {
    "전북대학교": "jbnu",
    "충남대학교": "cnu",
    "중앙대학교": "cau",
    "인하대학교": "inha",
    "한양대학교": "hanyang",
}
present = set(r["univId"] for r in rows)
still_missing = {n: uid for n, uid in MISSING.items() if uid not in present}
print("복구 대상:", list(still_missing.keys()))

# ── Apple Vision OCR ─────────────────────────────────────────────────────────
import Vision, Quartz, Foundation
import struct

def ocr_page(page: fitz.Page) -> str:
    """PyMuPDF 페이지 → Apple Vision OCR → 텍스트 반환"""
    # 2x 해상도로 렌더링 (인식률 향상)
    mat  = fitz.Matrix(2.0, 2.0)
    pix  = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")

    # NSData로 변환
    ns_data = Foundation.NSData.dataWithBytes_length_(img_bytes, len(img_bytes))
    ci_image = Quartz.CIImage.imageWithData_(ns_data)

    # Vision 요청
    handler = Vision.VNImageRequestHandler.alloc().initWithCIImage_options_(
        ci_image, None
    )
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(True)
    # 한국어 우선
    try:
        langs = request.supportedRecognitionLanguages()
        kor_langs = [l for l in langs if 'ko' in l.lower() or 'korean' in l.lower()]
        if kor_langs:
            request.setRecognitionLanguages_(kor_langs + ['en-US'])
    except Exception:
        pass

    success, err = handler.performRequests_error_([request], None)
    if not success:
        return ""

    results = request.results() or []
    lines = []
    for obs in results:
        cand = obs.topCandidates_(1)
        if cand:
            lines.append(str(cand[0].string()))
    return "\n".join(lines)

# ── 파싱 유틸 ────────────────────────────────────────────────────────────────
GRADE_PAT    = re.compile(r'\b([1-9]\.\d{1,2})\b')
SCORE_PAT    = re.compile(r'\b(\d{3,4}\.\d{1,2})\b')   # 환산점수 (3~4자리)
PCT_PAT      = re.compile(r'\b(\d{2,3}\.\d{1,2})\b')   # 백분위
PHASE_PAT    = re.compile(r'(수시|정시)')
ADM_PAT      = re.compile(r'(학생부교과|학생부종합|수능위주|논술|실기)')
CUT_PAT      = re.compile(r'(70\s*%\s*컷|70\s*%|80\s*%|평균|최종\s*등록|최저)')
UNIT_PAT     = re.compile(r'([가-힣]{2,15}(?:학과|학부|전공|대학원|계열|학)(?:\([^)]+\))?)')
RECRUIT_PAT  = re.compile(r'^(\d{1,4})\s')
COMP_PAT     = re.compile(r'(\d{1,3}\.\d)\s')

def clean_unit(s):
    if not s: return s
    s = re.sub(r'(?<=[가-힣a-zA-Z·]) (?=[가-힣a-zA-Z·(])', '', s)
    s = re.sub(r'\s*·\s*', '·', s)
    return s.strip()

def parse_cut_type(text):
    m = CUT_PAT.search(text)
    if not m: return "70%컷"
    t = m.group(1).replace(" ","")
    if "70" in t: return "70%컷"
    if "80" in t: return "80%컷"
    if "평균" in t: return "평균"
    if "최종" in t: return "최종등록"
    if "최저" in t: return "최저"
    return "70%컷"

def extract_rows_from_text(text, univ_id, univ_name, pdf_name, page_no,
                            phase, adm_type, cut_type):
    """OCR 텍스트에서 합격선 행 추출"""
    extracted = []
    for line in text.split('\n'):
        line = line.strip()
        if len(line) < 5: continue

        unit_m = UNIT_PAT.search(line)
        if not unit_m: continue
        unit = clean_unit(unit_m.group(1))

        grade_m = GRADE_PAT.search(line)
        score_m = SCORE_PAT.search(line)  # 3~4자리.소수
        pct_m   = PCT_PAT.search(line)    # 2~3자리.소수

        cut_grade = None
        cut_score = None

        if grade_m:
            try:
                v = float(grade_m.group(1))
                if 1.0 <= v <= 9.0:
                    cut_grade = round(v, 2)
            except: pass

        if score_m:
            try:
                cut_score = float(score_m.group(1))
            except: pass
        elif pct_m and adm_type == "수능위주":
            try:
                v = float(pct_m.group(1))
                if 10 <= v <= 100:
                    cut_score = v
            except: pass

        if cut_grade is None and cut_score is None:
            continue

        recruit_m = RECRUIT_PAT.match(line)
        comp_m    = COMP_PAT.search(line)

        row = {
            "univId":        univ_id,
            "univName":      univ_name,
            "phase":         phase,
            "admissionType": adm_type,
            "admissionName": "",
            "unit":          unit,
            "year":          2025,
            "cutType":       cut_type,
            "cutGrade":      cut_grade,
            "cutScore":      cut_score,
            "recruitCount":  int(recruit_m.group(1)) if recruit_m else None,
            "competition":   float(comp_m.group(1)) if comp_m else None,
            "region":        univs[univ_id]["region"] if univ_id in univs else "",
            "sourceFile":    pdf_name,
            "sourcePage":    page_no,
            "confidence":    "mid",
            "note":          "[B: Apple Vision OCR 복구]",
        }
        extracted.append(row)
    return extracted

# ── 대상 PDF 정의 (누락 대학별) ───────────────────────────────────────────────
# 어떤 PDF에 어떤 대학이 있는지 (가나다순 구조 기반 + 지역 기반)
TARGET_MAP = {
    # (pdf파일명, 추정되는 누락 대학들)
    "2025학년도 대입 전형결과(서울_4).pdf":  ["중앙대학교","한양대학교"],
    "2025학년도 대입 전형결과(인천_2).pdf":  ["인하대학교"],
    "2025학년도 대입 전형결과(인천_3).pdf":  ["인하대학교"],
    "2025학년도 대입 전형결과(전북_2).pdf":  ["전북대학교"],
    "2025학년도 대입 전형결과(충남_1).pdf":  ["충남대학교"],   # OCR 페이지
    "2025학년도 대입 전형결과(충남_2).pdf":  ["충남대학교"],
}

# ── 메인 처리 ────────────────────────────────────────────────────────────────
total_new = 0
recovered = collections.Counter()

for pdf_name, target_names in TARGET_MAP.items():
    # still missing 中 이 PDF에서 찾을 대학만
    needed = {n: MISSING[n] for n in target_names if n in still_missing}
    if not needed:
        continue

    pdf_path = PDF_DIR / pdf_name
    if not pdf_path.exists():
        print(f"없음: {pdf_name}")
        continue

    doc = fitz.open(str(pdf_path))
    n_pages = len(doc)
    print(f"\n▶ {pdf_name} ({n_pages}p) | 찾을 대학: {list(needed.keys())}")

    current_univ_id   = None
    current_univ_name = None
    current_phase     = "수시"
    current_adm_type  = "학생부교과"
    current_cut_type  = "70%컷"

    page_new = 0

    for pg in range(n_pages):
        t0 = time.time()
        page = doc[pg]

        # 먼저 텍스트 레이어 시도 (빠름)
        text = page.get_text().strip()

        # 텍스트 없으면 OCR
        if len(text) < 30:
            text = ocr_page(page)

        if not text:
            continue

        elapsed = time.time() - t0

        # 대학 헤더 감지 (가나다 순 구조 기반)
        for univ_name, univ_id in needed.items():
            variants = [univ_name, univ_name[:3]+"대", univ_name[:2]+"대학교"]
            if any(v in text for v in variants):
                current_univ_id   = univ_id
                current_univ_name = univ_name
                break

        # 앵커 키워드 없으면 스킵 (합격선 페이지가 아님)
        ANCHORS = ["합격","등록","경쟁률","70%","80%","평균","모집","수시","정시","등급","컷","cut"]
        if not any(a in text for a in ANCHORS):
            continue

        # phase / admissionType / cutType 업데이트
        pm = PHASE_PAT.search(text)
        if pm: current_phase = pm.group(1)
        am = ADM_PAT.search(text)
        if am: current_adm_type = am.group(1)
        current_cut_type = parse_cut_type(text)

        if current_univ_id is None:
            continue

        new_rows = extract_rows_from_text(
            text, current_univ_id, current_univ_name,
            pdf_name, pg+1,
            current_phase, current_adm_type, current_cut_type
        )
        rows.extend(new_rows)
        page_new  += len(new_rows)
        total_new += len(new_rows)
        if new_rows:
            recovered[current_univ_name] += len(new_rows)
            print(f"  p{pg+1}: {current_univ_name} +{len(new_rows)}행 ({elapsed:.1f}s)")

    doc.close()
    print(f"  소계: {page_new}행")

# ── 결과 저장 ─────────────────────────────────────────────────────────────────
print(f"\n▶ 복구 합계: {total_new}행")
for name, cnt in recovered.items():
    print(f"  {name}: {cnt}행")

OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
print(f"▶ 저장: {OUT.name} ({len(rows)}행)")

# 리포트 업데이트
REPORT = BASE / "reports" / "results_2025_clean_report.md"
orig = REPORT.read_text() if REPORT.exists() else ""
patch = f"\n\n## B 추가 OCR 복구 결과\n\n| 대학 | 복구 행수 |\n| --- | ---: |\n"
for name in MISSING:
    cnt = sum(1 for r in rows if r.get("univId") == MISSING[name])
    patch += f"| {name} | {cnt} |\n"
patch += f"\n- 추가된 행: {total_new}\n- 방법: Apple Vision OCR (Neural Engine)\n"
REPORT.write_text(orig + patch)
print("✅ 완료")
