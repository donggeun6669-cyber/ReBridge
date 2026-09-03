#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""무거운 PDF 추출만 따로 돌려 cache/ 에 저장한다.
build_inventory.py 가 이 캐시를 읽는다. 캐시가 없으면 build_inventory.py 가 이 파일을 호출한다.
읽기 전용: 원본 PDF/DB 를 절대 수정하지 않는다.
"""
import json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PDF_SRC = os.path.join(ROOT, "Application_main_codes", "src", "data", "pdf_sources")

os.makedirs(CACHE, exist_ok=True)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- 1. 검정고시 지원가능 전형 (5권역)
def extract_ged2027():
    """권역별 PDF 의 표를 pdfplumber 로 추출해 (지역, 대학, 전형명) 행을 모은다.
    표 추출이 통째로 실패하면 pdftotext 텍스트에서 '…대학교' 패턴으로 대학 목록만 회수한다."""
    import pdfplumber

    src = os.path.join(PDF_SRC, "ged_eligible_2027")
    out = {"rows": [], "byRegionFile": {}, "fallback": []}
    for fn in sorted(os.listdir(src)):
        if not fn.lower().endswith(".pdf"):
            continue
        path = os.path.join(src, fn)
        t0 = time.time()
        rows, pages_ok, pages_fail = [], 0, 0
        with pdfplumber.open(path) as pdf:
            npages = len(pdf.pages)
            for pno, page in enumerate(pdf.pages, 1):
                got = 0
                try:
                    tables = page.extract_tables()
                except Exception:
                    tables = []
                for tb in tables:
                    for r in tb:
                        cells = [(c or "").replace("\n", "").strip() for c in r]
                        if len(cells) < 3:
                            continue
                        if cells[0] == "지역" and cells[1] == "대학":
                            continue  # 매 쪽 반복되는 머리글
                        if not cells[1] or not cells[2]:
                            continue
                        rows.append({
                            "file": fn, "page": pno,
                            "region": cells[0], "univ": cells[1], "admission": cells[2],
                        })
                        got += 1
                pages_ok += 1 if got else 0
                pages_fail += 0 if got else 1
        if not rows:  # 표 추출 전면 실패 → 텍스트 폴백
            txt = subprocess.run(["pdftotext", "-layout", path, "-"],
                                 capture_output=True, text=True).stdout
            names = sorted(set(re.findall(r"[가-힣A-Za-z0-9()·]+대학교", txt)))
            out["fallback"].append({"file": fn, "univs": names})
            log(f"  [폴백] {fn}: 표 실패, 텍스트에서 대학 {len(names)}개")
        out["byRegionFile"][fn] = {
            "pages": npages, "pagesWithTable": pages_ok, "pagesWithoutTable": pages_fail,
            "rows": sum(1 for r in rows if r["file"] == fn),
        }
        log(f"  {fn}: {npages}쪽, 행 {len(rows)} ({time.time()-t0:.0f}s)")
        out["rows"].extend(rows)
    json.dump(out, open(os.path.join(CACHE, "ged2027.json"), "w"),
              ensure_ascii=False)
    return out


# ---------------------------------------------------------------- 2. 대형 자료집 전문 텍스트
BIG_DOCS = {
    "kcue2027_analysis": ("kcue_2027", "2027학년도 수시모집 지역별 전형분석 자료집.pdf"),
    "kcue2027_119": ("kcue_2027", "2027학년도 대입정보 119 자료집(260112).pdf"),
    "kcue2028_briefing": ("kcue_2028", "2028 대입 정보 설명회_최종_압축.pdf"),
    "kcue2028_subjects": ("kcue_2028", "2028 모집단위별 반영과목 및 대학별 권장과목 자료집.pdf"),
    "kcue2027_deadline": ("kcue_2027", "2027학년도 수시모집 전형 일정 (접수 마감).pdf"),
}


def extract_bigtext():
    out = {}
    for key, (sub, fn) in BIG_DOCS.items():
        path = os.path.join(PDF_SRC, sub, fn)
        if not os.path.exists(path):
            out[key] = None
            log(f"  [없음] {fn}")
            continue
        t0 = time.time()
        r = subprocess.run(["pdftotext", "-layout", path, "-"],
                           capture_output=True, text=True)
        out[key] = r.stdout
        log(f"  {fn}: {len(r.stdout)}자 ({time.time()-t0:.0f}s)")
    json.dump(out, open(os.path.join(CACHE, "bigtext.json"), "w"), ensure_ascii=False)
    return out


# ---------------------------------------------------------------- 2b. 2027 수시 접수마감 표
def extract_deadline():
    """접수마감 PDF는 4열 표인데 '대학' 칸이 pdfplumber 의 셀로 잡히지 않는다.
    '시각' 칸의 y 범위를 그 행의 띠로 삼고, 그 띠에서 오른쪽 영역만 잘라 읽는다."""
    import pdfplumber

    path = os.path.join(PDF_SRC, BIG_DOCS["kcue2027_deadline"][0],
                        BIG_DOCS["kcue2027_deadline"][1])
    rows = []
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            for tb in pg.find_tables():
                hdr = [c for c in tb.rows[0].cells if c]
                if len(hdr) < 2:
                    continue
                x_univ, x_right, y_bottom = hdr[-1][0], tb.bbox[2], tb.bbox[3]

                def cell_text(c):
                    if not c:
                        return ""
                    return (pg.crop((c[0] + .4, c[1] + .4, c[2] - .4, c[3] - .4))
                            .extract_text() or "").strip()

                body = [r for r in tb.rows[2:] if len(r.cells) > 2 and r.cells[2]]
                for i, r in enumerate(body):
                    top = r.cells[2][1]
                    bot = body[i + 1].cells[2][1] if i + 1 < len(body) else y_bottom
                    univ = (pg.crop((x_univ + .4, top + .4, x_right - .4, bot - .4))
                            .extract_text(x_tolerance=1.2) or "").replace("\n", "")
                    rows.append({
                        "region": cell_text(r.cells[0]),
                        "date": cell_text(r.cells[1]),
                        "time": cell_text(r.cells[2]),
                        "univs": univ,
                    })
    json.dump(rows, open(os.path.join(CACHE, "deadline2027.json"), "w"), ensure_ascii=False)
    log(f"  접수마감 표: {len(rows)}행")
    return rows


# ---------------------------------------------------------------- 3. 2025 대교협 전형결과 지역별 PDF 텍스트
def extract_2025():
    src = os.path.join(PDF_SRC, "2025")
    out = {}
    for fn in sorted(os.listdir(src)):
        if not fn.lower().endswith(".pdf"):
            continue
        path = os.path.join(src, fn)
        r = subprocess.run(["pdftotext", "-layout", path, "-"],
                           capture_output=True, text=True)
        out[fn] = r.stdout
        log(f"  {fn}: {len(r.stdout)}자")
    json.dump(out, open(os.path.join(CACHE, "text2025.json"), "w"), ensure_ascii=False)
    return out


if __name__ == "__main__":
    log("[1/3] 검정고시 지원가능 전형 5권역 PDF 표 추출")
    extract_ged2027()
    log("[2/4] 대형 자료집 텍스트 추출")
    extract_bigtext()
    log("[3/4] 2027 수시 접수마감 표 추출")
    extract_deadline()
    log("[4/4] 2025 대교협 전형결과 지역별 PDF 텍스트 추출")
    extract_2025()
    log("완료")
