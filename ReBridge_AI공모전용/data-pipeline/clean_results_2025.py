"""
results_2025.json 2차 정제 스크립트
작업 A: grade/score 분리행 병합
작업 C: unit 학과명 공백 정제
작업 D: 수치 이상치 검증/플래그
작업 B: 누락 핵심대학 복구 (PDF 재처리)
→ 산출물: results_2025_clean.json + reports/results_2025_clean_report.md
"""

import argparse, json, re, collections, pathlib, sys

# ⚠️ 2026-09-03 — 연도·경로를 매개변수로 뺐다(이전엔 전부 2025 고정).
BASE   = pathlib.Path(__file__).parent
APP_DATA = BASE.parent / "Application_main_codes" / "src" / "data"

_ap = argparse.ArgumentParser(description="전형결과 JSON 2차 정제. 연도·경로는 매개변수다.")
_ap.add_argument("--year", type=int, default=2025)
_ap.add_argument("--src", help="1차 추출 JSON. 기본값: results_{year}.json")
_ap.add_argument("--pdf-dir", help="원본 PDF 폴더(작업 B 복구용)")
_ap.add_argument("--out", help="정제 결과 JSON. 기본값: results_{year}_clean.json")
_args = _ap.parse_args()

YEAR   = _args.year


def _first_dir(*cands):
    for c in cands:
        if c.is_dir():
            return c
    return cands[0]


def _first_file(*cands):
    for c in cands:
        if c.exists():
            return c
    return cands[0]


PDF_DIR = (pathlib.Path(_args.pdf_dir).expanduser() if _args.pdf_dir
           else _first_dir(APP_DATA / "pdf_sources" / f"results_{YEAR}",
                           APP_DATA / "pdf_sources" / str(YEAR),
                           BASE / "pdf_sources" / str(YEAR)))
DATA   = pathlib.Path(_args.src).expanduser() if _args.src else BASE / f"results_{YEAR}.json"
UNIV   = _first_file(APP_DATA / "universities.json", BASE / "universities.json")
ADM    = _first_file(APP_DATA / "admissions.json", BASE / "admissions.json")
OUT    = pathlib.Path(_args.out).expanduser() if _args.out else BASE / f"results_{YEAR}_clean.json"
REPORT = BASE / "reports" / f"results_{YEAR}_clean_report.md"
print(f"학년도 {YEAR} | 입력 {DATA.name} | PDF {PDF_DIR}")

# ── 로드 ──────────────────────────────────────────────────────────────────────
print("▶ 로드 중...")
rows   = json.loads(DATA.read_text())
univs  = {u["univId"]: u for u in json.loads(UNIV.read_text())}
adm    = json.loads(ADM.read_text())
print(f"  results: {len(rows)}행 | univs: {len(univs)} | admissions: {len(adm)}")

# univName → univId 빠른 조회
name2id: dict[str, str] = {}
for uid, u in univs.items():
    name2id[u["name"]] = uid
    # 약칭도 추가
    short = u["name"].replace("학교","").replace("대학교","").replace("대학","")
    name2id[short] = uid

# ── 작업 C: unit 학과명 정제 ──────────────────────────────────────────────────
print("▶ C: unit 정제...")

def clean_unit(s: str | None) -> str | None:
    if not s:
        return s
    # 한글/영문 사이 단독 공백 제거 (줄바꿈 아티팩트)
    # e.g. "스포츠레 저학전공" → "스포츠레저학전공"
    s = re.sub(r'(?<=[가-힣a-zA-Z·]) (?=[가-힣a-zA-Z·(])', '', s)
    # 가운뎃점 주변 공백 정리
    s = re.sub(r'\s*·\s*', '·', s)
    # 앞뒤 공백
    s = s.strip()
    return s

c_fixed = 0
for r in rows:
    orig = r.get("unit")
    new  = clean_unit(orig)
    if new != orig:
        r["unit"] = new
        c_fixed += 1
print(f"  unit 정제: {c_fixed}건")

# ── 작업 D: 수치 이상치 검증 ────────────────────────────────────────────────
print("▶ D: 수치 검증...")

d_flags = 0
for r in rows:
    g = r.get("cutGrade")
    s = r.get("cutScore")

    # cutGrade 범위 체크 (1.0~9.0)
    if isinstance(g, (int, float)):
        if not (1.0 <= g <= 9.0):
            # 등급이라기엔 너무 큰 값 → cutScore로 이동
            if g > 9.0:
                r["cutScore"] = r["cutScore"] or g
                r["cutGrade"] = None
                r["note"] = (r.get("note") or "") + " [D: grade>9 → score로이동]"
                r["confidence"] = "low"
                d_flags += 1

    # cutScore 스케일 의심: 백분위 범위인데 22 이하거나 비현실
    if isinstance(s, (int, float)) and r.get("cutType") in ("최종등록", "70%컷", "80%컷"):
        if 0 < s < 30 and r.get("admissionType") == "수능위주":
            r["note"] = (r.get("note") or "") + " [D: score<30 의심]"
            if r.get("confidence") == "high":
                r["confidence"] = "mid"
                d_flags += 1

print(f"  이상치 플래그: {d_flags}건")

# ── 작업 A: grade/score 분리행 병합 ─────────────────────────────────────────
print("▶ A: grade/score 분리행 병합...")

MERGE_KEY = ("univId","phase","admissionType","admissionName","unit","cutType","year","sourceFile","sourcePage")

buckets: dict[tuple, list] = {}
for r in rows:
    key = tuple(r.get(k) for k in MERGE_KEY)
    buckets.setdefault(key, []).append(r)

merged = []
a_merged = a_conflict = a_single = 0

for key, group in buckets.items():
    if len(group) == 1:
        merged.append(group[0])
        a_single += 1
        continue

    # grade 있는 것, score 있는 것 분리
    grade_rows = [r for r in group if r.get("cutGrade") is not None]
    score_rows = [r for r in group if r.get("cutScore") is not None]

    if len(grade_rows) == 1 and len(score_rows) == 1:
        # 정상 병합
        base = grade_rows[0].copy()
        base["cutScore"] = score_rows[0]["cutScore"]
        # confidence: 낮은 쪽 채택
        conf_rank = {"high":2,"mid":1,"low":0}
        base["confidence"] = min(
            [grade_rows[0]["confidence"], score_rows[0]["confidence"]],
            key=lambda c: conf_rank.get(c,0)
        )
        merged.append(base)
        a_merged += 1
    elif len(grade_rows) == 0 and len(score_rows) >= 1:
        # score만 여러개 → 대표 1개 유지
        merged.append(score_rows[0])
        a_single += 1
    elif len(score_rows) == 0 and len(grade_rows) >= 1:
        merged.append(grade_rows[0])
        a_single += 1
    else:
        # 충돌 (grade 2개 등)
        for r in group:
            r["note"] = (r.get("note") or "") + " [A: 병합충돌]"
            r["confidence"] = "low"
        merged.extend(group)
        a_conflict += 1

print(f"  병합: {a_merged}쌍 → 절반 제거 | 충돌: {a_conflict} | 단독: {a_single}")
print(f"  병합 전: {len(rows)} → 후: {len(merged)}")

rows = merged

# ── 작업 B: 누락 핵심대학 복구 (PDF 재처리) ──────────────────────────────────
print("▶ B: 누락 핵심대학 PDF 재처리...")

MISSING_UNIVS = {
    "전북대학교": "jbnu",
    "충남대학교": "cnu",
    "중앙대학교": "cau",
    "인하대학교": "inha",
    "한양대학교": "hanyang",
}

# 이미 있는 univId 목록
present_ids = set(r["univId"] for r in rows)
still_missing = {name: uid for name, uid in MISSING_UNIVS.items() if uid not in present_ids}
print(f"  여전히 누락: {list(still_missing.keys())}")

if not still_missing:
    print("  → 이미 복구됨, 건너뜀")
else:
    try:
        import pdfplumber, fitz
        _has_pdf = True
    except ImportError:
        _has_pdf = False
        print("  pdfplumber/fitz 없음, B 건너뜀")

    if _has_pdf:
        # 재처리 대상 PDF (누락 대학이 속할 가능성 높은 것)
        # ⚠️ 이 목록은 2025 전용 수기 목록이다. 다른 학년도에서는 폴더 전체를 훑는다.
        TARGET_PDFS = [p.name for p in sorted(PDF_DIR.glob("*.pdf"))] if YEAR != 2025 else [
            "2025학년도 대입 전형결과(서울_1).pdf",
            "2025학년도 대입 전형결과(서울_2).pdf",
            "2025학년도 대입 전형결과(서울_3).pdf",
            "2025학년도 대입 전형결과(서울_4).pdf",
            "2025학년도 대입 전형결과(충남_1).pdf",
            "2025학년도 대입 전형결과(충남_2).pdf",
            "2025학년도 대입 전형결과(전북_1).pdf",
            "2025학년도 대입 전형결과(전북_2).pdf",
            "2025학년도 대입 전형결과(인천_1).pdf",  # 인하대(인천)
            "2025학년도 대입 전형결과(경기_1).pdf",  # 한양대 에리카
        ]

        # 대학 헤더 패턴 (페이지 상단 또는 표 상단에 대학명)
        UNIV_HDR = re.compile(
            r'(?:^|\s)((?:' + '|'.join(re.escape(n) for n in still_missing) + r')(?:학교)?)',
            re.MULTILINE
        )

        # cutType/grade/score 추출용 패턴 (1차와 동일 간략버전)
        GRADE_PAT   = re.compile(r'\b([1-9]\.\d{1,2}|[1-9]등급)\b')
        SCORE_PAT   = re.compile(r'\b(\d{2,3}\.\d{1,2})\b')
        PHASE_PAT   = re.compile(r'(수시|정시)')
        ADM_TYPE_PAT= re.compile(r'(학생부교과|학생부종합|수능위주|논술|실기|일반\(서류\))')
        CUT_PAT     = re.compile(r'(70%컷|80%컷|70%|평균|최종등록|최저)')
        UNIT_PAT    = re.compile(r'([가-힣a-zA-Z]+(?:학과|학부|전공|학과(군)?|전문대학원|대학원))')
        RECRUIT_PAT = re.compile(r'모집\s*인원[:\s]*(\d+)|^\s*(\d+)\s*명')
        COMP_PAT    = re.compile(r'경쟁률[:\s]*([\d.]+)')
        ANCHOR_WORDS= set("입시결과 합격 최종 등록 충원 70% 80% 평균 등급 환산 경쟁률 모집 수시 정시".split())

        b_recovered = 0

        for pdf_name in TARGET_PDFS:
            pdf_path = PDF_DIR / pdf_name
            if not pdf_path.exists():
                continue

            # 먼저 PyMuPDF로 페이지별 텍스트 추출
            try:
                doc = fitz.open(str(pdf_path))
            except Exception as e:
                print(f"  {pdf_name}: 열기 실패 {e}")
                continue

            current_univ_id   = None
            current_univ_name = None
            current_phase     = "수시"
            current_adm_type  = "학생부교과"

            for page_no in range(len(doc)):
                page = doc[page_no]
                text = page.get_text()

                # 앵커 체크
                if not any(w in text for w in ANCHOR_WORDS):
                    # 페이지 상단만 체크 (대학 헤더일 수 있음)
                    top_text = text[:300]
                    hdr = UNIV_HDR.search(top_text)
                    if hdr:
                        name_hit = hdr.group(1)
                        # 정규화
                        for full_name in still_missing:
                            if full_name[:3] in name_hit:
                                current_univ_id   = still_missing[full_name]
                                current_univ_name = full_name
                                break
                    continue

                # 대학 헤더 찾기
                hdr = UNIV_HDR.search(text)
                if hdr:
                    name_hit = hdr.group(1)
                    for full_name in still_missing:
                        if full_name[:3] in name_hit:
                            current_univ_id   = still_missing[full_name]
                            current_univ_name = full_name
                            break
                    # universities.json에 없는 대학도 헤더로 전환
                    else:
                        # 다른 대학 헤더면 current_univ 초기화 (더이상 누락대학 섹션 아님)
                        for uid, u in univs.items():
                            if u["name"] in text[:200]:
                                current_univ_id   = uid
                                current_univ_name = u["name"]
                                break

                if current_univ_id not in still_missing.values():
                    continue

                # phase
                pm = PHASE_PAT.search(text)
                if pm:
                    current_phase = pm.group(1)

                # admissionType
                am = ADM_TYPE_PAT.search(text)
                if am:
                    current_adm_type = am.group(1)

                # cut type
                cut_m = CUT_PAT.search(text)
                cut_type = cut_m.group(1) if cut_m else "70%컷"
                if "70%" in cut_type:
                    cut_type = "70%컷"

                # 줄 단위 파싱
                for line in text.split('\n'):
                    line = line.strip()
                    if not line or len(line) < 3:
                        continue

                    unit_m = UNIT_PAT.search(line)
                    if not unit_m:
                        continue
                    unit = clean_unit(unit_m.group(1))

                    grade_m = GRADE_PAT.search(line)
                    score_m = SCORE_PAT.search(line)
                    if not grade_m and not score_m:
                        continue

                    cut_grade = None
                    cut_score = None
                    if grade_m:
                        try:
                            val = float(grade_m.group(1).replace("등급",""))
                            if 1.0 <= val <= 9.0:
                                cut_grade = round(val, 2)
                        except:
                            pass
                    if score_m:
                        try:
                            cut_score = float(score_m.group(1))
                        except:
                            pass

                    recruit_m = RECRUIT_PAT.search(line)
                    comp_m    = COMP_PAT.search(line)

                    new_row = {
                        "univId":        current_univ_id,
                        "univName":      current_univ_name,
                        "phase":         current_phase,
                        "admissionType": current_adm_type,
                        "admissionName": "",
                        "unit":          unit,
                        "year":          YEAR,
                        "cutType":       cut_type,
                        "cutGrade":      cut_grade,
                        "cutScore":      cut_score,
                        "recruitCount":  int(recruit_m.group(1) or recruit_m.group(2)) if recruit_m else None,
                        "competition":   float(comp_m.group(1)) if comp_m else None,
                        "region":        univs[current_univ_id]["region"] if current_univ_id in univs else "",
                        "sourceFile":    pdf_name,
                        "sourcePage":    page_no + 1,
                        "confidence":    "mid",  # 재처리라 mid
                        "note":          "[B: pdf재처리복구]",
                    }
                    if cut_grade is not None or cut_score is not None:
                        rows.append(new_row)
                        b_recovered += 1

            doc.close()

        print(f"  B 복구 행: {b_recovered}")
        for name, uid in still_missing.items():
            cnt = sum(1 for r in rows if r.get("univId") == uid)
            print(f"    {name}({uid}): {cnt}행")

# ── 보충분 병합 ───────────────────────────────────────────────────────────────
# ⚠️ 2026-09-03 추가.
# 이미지 PDF라 표 추출이 안 되는 대학(중앙대·인하대·한양대·충남대·전북대)은
# scrape_missing_univs.py / scrape_cnu_jbnu.py 가 따로 뽑아 clean 파일에 **덧붙여** 놨었다.
# 그래서 1차 추출을 다시 돌리면 그 1,244행이 조용히 사라졌다(대학 119개 → 114개).
# 보충분을 별도 파일로 떼어 두고 여기서 다시 합친다. 없으면 그냥 넘어간다.
SUPP = BASE / f"results_{YEAR}_scraped_supplement.json"
if SUPP.exists():
    supp = json.loads(SUPP.read_text())
    have = {r.get("univId") for r in rows}
    added = [r for r in supp if r.get("univId") not in have]
    rows.extend(added)
    print(f"▶ 보충분 병합: {SUPP.name} {len(supp)}행 중 {len(added)}행 추가 "
          f"(이미 뽑힌 대학은 건너뜀)")
else:
    print(f"▶ 보충분 없음 ({SUPP.name})")

# ── 저장 ──────────────────────────────────────────────────────────────────────
print("▶ 저장 중...")
OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
print(f"  → {OUT.name}: {len(rows)}행")

# ── 리포트 생성 ───────────────────────────────────────────────────────────────
print("▶ 리포트 생성...")

# 조인 준비도: (univId, admissionType) 겹침
adm_pairs = set((a["univId"], a["admissionType"]) for a in adm)
res_pairs  = set((r["univId"], r["admissionType"]) for r in rows if r.get("admissionType"))
join_ok    = adm_pairs & res_pairs
join_pct   = len(join_ok) / len(adm_pairs) * 100 if adm_pairs else 0

# 핵심 10개 대학 커버리지
CORE10 = [
    ("부산대학교","pusan"),("경북대학교","knu"),("성균관대학교","skku"),
    ("국민대학교","kookmin"),("서울시립대학교","uos"),
    ("중앙대학교","cau"),("인하대학교","inha"),("한양대학교","hanyang"),
    ("전북대학교","jbnu"),("충남대학교","cnu"),
]

def univ_coverage(uid):
    rr = [r for r in rows if r.get("univId") == uid]
    if not rr:
        return 0, "-"
    conf = collections.Counter(r["confidence"] for r in rr)
    return len(rr), f"high:{conf.get('high',0)} mid:{conf.get('mid',0)} low:{conf.get('low',0)}"

conf_total = collections.Counter(r["confidence"] for r in rows)

lines = [
    f"# results_{YEAR} 2차 정제 리포트",
    "",
    "## 요약",
    "",
    f"| 항목 | 값 |",
    f"| --- | --- |",
    f"| 1차 행수 | 20,830 |",
    f"| **2차 정제 후** | **{len(rows):,}** |",
    f"| A 병합 쌍 | {a_merged}쌍 제거 |",
    f"| A 충돌 유지 | {a_conflict}그룹 |",
    f"| B 복구 행 | {b_recovered} |",
    f"| C unit 정제 | {c_fixed}건 |",
    f"| D 이상치 플래그 | {d_flags}건 |",
    "",
    "## confidence 분포",
    "",
    "| confidence | 행수 |",
    "| --- | ---: |",
    *[f"| {k} | {v:,} |" for k, v in conf_total.most_common()],
    "",
    "## 핵심 10개 대학 커버리지",
    "",
    "| 대학 | univId | 행수 | confidence 분포 |",
    "| --- | --- | ---: | --- |",
    *[f"| {name} | {uid} | {univ_coverage(uid)[0]:,} | {univ_coverage(uid)[1]} |"
      for name, uid in CORE10],
    "",
    "## 조인 준비도 (admissions.json 연결 가능 비율)",
    "",
    f"- admissions (univId×admissionType) 조합: {len(adm_pairs):,}",
    f"- results_clean 포함 조합: {len(res_pairs):,}",
    f"- 겹치는 조합: {len(join_ok):,} ({join_pct:.1f}%)",
    "",
    "## C: unit 정제 규칙",
    "",
    "- 한글/영문 사이 단독 공백 제거 (PDF 줄바꿈 아티팩트)",
    "- 가운뎃점(·) 주변 공백 제거",
    "- 앞뒤 공백 trim",
    f"- 정제 건수: {c_fixed}",
    "",
    "## D: 수치 이상치 처리",
    "",
    f"- cutGrade > 9.0 → cutScore로 이동: 포함",
    f"- 수능위주 score < 30 (백분위 의심): 포함",
    f"- 총 플래그: {d_flags}건",
]

REPORT.parent.mkdir(exist_ok=True)
REPORT.write_text("\n".join(lines))
print(f"  → {REPORT.name}")
print("✅ 완료")
