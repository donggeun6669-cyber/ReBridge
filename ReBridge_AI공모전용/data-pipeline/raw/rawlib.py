"""RAW 원본 수집 공용 도구 (2026-09-17 동근님 지시).

원본만 모은다. 분석·파싱은 하지 않는다.

    RAW/
      2025/ 2026/ 2027/ 2028/
        {univId}_{대학명}/        받은 파일을 형식 그대로
        _manifests/{작업자}.csv   파일 1개 = 1줄 (작업자별로 따로 써서 동시 작업 충돌을 막는다)
      수집현황.xlsx               status_xlsx() 가 manifest 전부를 모아 만든다

대상: universities.json 351곳 − 제외 6곳(대학 아님·사내대학) = 345곳.
      마스터에 없는 학교(사관학교·경찰대·폴리텍·방송대·사이버대)는 이번 단계에서 하지 않는다.

사용 예 (에이전트·스크립트 공통):
    python3 rawlib.py targets                      # 대상 목록(번호·univId·이름·분류·지역·홈페이지)
    python3 rawlib.py add --year 2027 --who S1 --univ uA0000001 --doc 모집요강_수시 \\
        --file /path/to/downloaded.pdf --url https://... [--posted 2026-05-30] [--note ...]
    python3 rawlib.py miss --year 2027 --who S1 --univ uA0000001 --doc 모집요강_수시 \\
        --reason "입학처에 2027 모집요강 없음(2026-09-17 확인)" [--url 확인한 페이지]
    python3 rawlib.py status                       # 수집현황.xlsx 다시 만들기
"""

import argparse
import csv
import datetime as dt
import hashlib
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent                      # ReBridge_AI공모전용/
RAW = ROOT / "RAW"
APP_DATA = ROOT / "Application_main_codes" / "src" / "data"
YEARS = ("2025", "2026", "2027", "2028")

# 문서 종류 — 연도별로 쓸 수 있는 값
DOC_TYPES = {
    "2025": ("입시결과_수시", "입시결과_정시", "입시결과_통합"),
    "2026": ("입시결과_수시", "입시결과_정시", "입시결과_통합"),
    "2027": ("모집요강_수시", "모집요강_정시", "모집요강_통합"),
    "2028": ("시행계획", "모집요강_수시", "모집요강_정시", "모집요강_통합"),
}

FIELDS = [
    "univId", "대학명", "연도", "문서종류", "상태", "형식", "원문여부",
    "파일", "출처URL", "게시일", "받은날짜", "sha256", "쪽수", "작업자", "비고",
]

# 제외 6곳 — Application_main_codes/src/data/excludedUniversities.js 와 같아야 한다
EXCLUDED = {"uA0000639", "uA0002698", "uA0002749", "uA0000288", "uA0000289", "uA0002699"}


def nfc(s):
    return unicodedata.normalize("NFC", str(s or ""))


def safe(s):
    return re.sub(r'[\\/:*?"<>|\s]+', "_", nfc(s)).strip("_")


def targets():
    js = nfc((APP_DATA / "excludedUniversities.js").read_text(encoding="utf-8"))
    ids_in_js = set(re.findall(r"\b(uA\d{7})\s*:", js))
    if ids_in_js != EXCLUDED:
        sys.exit(f"제외 목록이 excludedUniversities.js 와 다르다: {sorted(ids_in_js ^ EXCLUDED)}")
    unis = json.loads((APP_DATA / "universities.json").read_text(encoding="utf-8"))
    out = [u for u in unis if u["univId"] not in EXCLUDED]
    # 번호: 분류(대학교 → 전문대학) 안에서 가나다순
    out.sort(key=lambda u: (u.get("kind") != "대학교", nfc(u["name"])))
    for i, u in enumerate(out, 1):
        u["no"] = i
        u["name"] = nfc(u["name"])
    return out


def by_id():
    return {u["univId"]: u for u in targets()}


def univ_dir(year, u):
    d = RAW / year / f"{u['univId']}_{safe(u['name'])}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pages(p):
    if p.suffix.lower() != ".pdf":
        return ""
    try:
        r = subprocess.run(["pdfinfo", str(p)], capture_output=True, text=True, timeout=30)
        m = re.search(r"^Pages:\s+(\d+)", r.stdout, re.M)
        return m.group(1) if m else "열기 실패"
    except Exception:
        return "열기 실패"


def sniff(p):
    """확장자가 아니라 파일 앞부분으로 형식을 판정한다(확장자가 틀린 다운로드가 흔하다)."""
    head = open(p, "rb").read(8)
    if head.startswith(b"%PDF"):
        return "PDF"
    if head.startswith(b"\xd0\xcf\x11\xe0"):
        return "HWP" if p.suffix.lower() == ".hwp" else ("XLS" if p.suffix.lower() == ".xls" else "OLE")
    if head.startswith(b"PK"):
        ext = p.suffix.lower().lstrip(".")
        return {"xlsx": "XLSX", "hwpx": "HWPX", "zip": "ZIP", "docx": "DOCX"}.get(ext, "ZIP계열")
    if head[:4] in (b"\x89PNG",) or head[:3] == b"\xff\xd8\xff":
        return "이미지"
    txt = head.lower()
    if txt.startswith((b"<!doc", b"<html", b"\xef\xbb\xbf<")):
        return "HTML"
    return p.suffix.lower().lstrip(".").upper() or "알수없음"


def manifest_path(year, who):
    d = RAW / year / "_manifests"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{safe(who)}.csv"


def append(year, who, row):
    p = manifest_path(year, who)
    new = not p.exists()
    with open(p, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new:
            w.writeheader()
        w.writerow({k: row.get(k, "") for k in FIELDS})


def check_args(year, univ, doc):
    if year not in YEARS:
        sys.exit(f"연도는 {YEARS} 중 하나")
    if doc not in DOC_TYPES[year]:
        sys.exit(f"{year} 문서종류는 {DOC_TYPES[year]} 중 하나")
    u = by_id().get(univ)
    if not u:
        sys.exit(f"대상에 없는 univId: {univ}")
    return u


def add(year, who, univ, doc, file, url, posted="", note="", original="원문", copy=True, campus=""):
    """파일 1개를 RAW에 넣고 manifest에 1줄 쓴다. 같은 내용(sha256)이 이미 있으면 넣지 않는다."""
    u = check_args(year, univ, doc)
    src = Path(file)
    if not src.is_file() or src.stat().st_size == 0:
        sys.exit(f"파일이 없거나 비어 있다: {src}")
    digest = sha256(src)
    d = univ_dir(year, u)
    for old in load_manifest(year):
        if old["univId"] == univ and old["sha256"] == digest and old["상태"] == "확보":
            print(f"이미 있음(같은 내용): {old['파일']} — 넣지 않음")
            return None
    fmt = sniff(src)
    ext = src.suffix.lower() or ".bin"
    stem = f"{year}_{doc}"
    # 캠퍼스별로 따로 받은 파일은 이름에 캠퍼스를 붙인다(같은 대학 폴더에 여러 개가 들어간다)
    stem = f"{stem}_{safe(campus)}" if campus else stem
    name = f"{stem}{ext}"
    dst = d / name
    n = 2
    while dst.exists():
        dst = d / f"{stem}_{n}{ext}"
        n += 1
    (shutil.copy2 if copy else shutil.move)(src, dst)
    row = {
        "univId": univ, "대학명": u["name"], "연도": year, "문서종류": doc, "상태": "확보",
        "형식": fmt, "원문여부": original, "파일": str(dst.relative_to(RAW)), "출처URL": url,
        "게시일": posted, "받은날짜": dt.date.today().isoformat(), "sha256": digest,
        "쪽수": pages(dst), "작업자": who, "비고": note,
    }
    append(year, who, row)
    print(f"확보: {row['파일']} ({fmt}, {row['쪽수']}쪽)")
    return row


def miss(year, who, univ, doc, reason, url=""):
    u = check_args(year, univ, doc)
    append(year, who, {
        "univId": univ, "대학명": u["name"], "연도": year, "문서종류": doc, "상태": "못 구함",
        "출처URL": url, "받은날짜": dt.date.today().isoformat(), "작업자": who, "비고": reason,
    })
    print(f"못 구함 기록: {u['name']} {year} {doc}")


def load_manifest(year):
    rows = []
    d = RAW / year / "_manifests"
    if not d.exists():
        return rows
    for p in sorted(d.glob("*.csv")):
        with open(p, encoding="utf-8-sig") as f:
            rows.extend(csv.DictReader(f))
    return rows


# ── 현황 엑셀 ───────────────────────────────────────────────────────
SHORT = {"입시결과_수시": "수시", "입시결과_정시": "정시", "입시결과_통합": "통합",
         "모집요강_수시": "수시요강", "모집요강_정시": "정시요강", "모집요강_통합": "통합요강",
         "시행계획": "시행계획"}


def cell_for(rows):
    """한 대학·한 연도의 manifest 줄들 → 칸 문자열.
    확보가 하나라도 있으면 '형식(종류…)', 못 구함만 있으면 '못 구함', 아무것도 없으면 '미확인'."""
    got = [r for r in rows if r["상태"] == "확보"]
    if got:
        parts = {}
        for r in got:
            label = SHORT.get(r["문서종류"], r["문서종류"])
            if r["원문여부"] != "원문":
                label += "·가공" if r["원문여부"] == "가공" else "·대체"
            parts.setdefault(r["형식"], [])
            if label not in parts[r["형식"]]:
                parts[r["형식"]].append(label)
        return " / ".join(f"{fmt}({', '.join(v)})" for fmt, v in parts.items())
    if rows:
        return miss_label(rows)
    return "미확인"


# miss 사유 앞머리 → 칸 표시. 접속이 막혀 '없다'를 확인 못 한 것은 미확인으로 센다.
TAGS = (("[확인 못 함]", "미확인"), ("[게시 전]", "게시 전"), ("[해당 없음]", "해당 없음"))


def miss_label(rows):
    labels = {next((v for t, v in TAGS if r["비고"].startswith(t)), "못 구함") for r in rows}
    for v in ("못 구함", "미확인", "게시 전", "해당 없음"):   # 섞여 있으면 앞의 것
        if v in labels:
            return v


def status_xlsx():
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    T = targets()
    man = {y: load_manifest(y) for y in YEARS}
    wb = Workbook()
    ws = wb.active
    ws.title = "수집현황"
    head = ["번호", "대학이름", "대학분류", "지역", *YEARS, "비고"]
    ws.append(head)
    fill = {
        "ok": PatternFill("solid", fgColor="E2F0D9"),
        "sub": PatternFill("solid", fgColor="FFF2CC"),
        "miss": PatternFill("solid", fgColor="F8CBAD"),
        "none": PatternFill("solid", fgColor="EDEDED"),
    }
    summary = {y: {"확보": 0, "대체만": 0, "못 구함": 0, "게시 전": 0, "해당 없음": 0, "미확인": 0}
               for y in YEARS}
    for u in T:
        notes, cells = [], []
        for y in YEARS:
            rows = [r for r in man[y] if r["univId"] == u["univId"]]
            c = cell_for(rows)
            cells.append(c)
            for r in rows:
                if r["상태"] == "못 구함" and r["비고"]:
                    notes.append(f"{y} {SHORT.get(r['문서종류'], r['문서종류'])}: {r['비고']}")
            got = [r for r in rows if r["상태"] == "확보"]
            if got and all(r["원문여부"] != "원문" for r in got):
                summary[y]["대체만"] += 1
            elif got:
                summary[y]["확보"] += 1
            elif rows:
                summary[y][miss_label(rows)] += 1
            else:
                summary[y]["미확인"] += 1
        ws.append([u["no"], u["name"], u.get("kind", ""), u.get("region", ""), *cells, "\n".join(notes)])
        rix = ws.max_row
        for j, c in enumerate(cells):
            cell = ws.cell(rix, 5 + j)
            cell.fill = fill["miss"] if c == "못 구함" else fill["none"] if c in ("미확인", "게시 전", "해당 없음") \
                else fill["sub"] if "대체" in c else fill["ok"]
    for c in ws[1]:
        c.font = Font(bold=True)
    widths = [6, 26, 10, 7, 30, 30, 30, 30, 60]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(vertical="top", wrap_text=True)
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = ws.dimensions

    s = wb.create_sheet("요약")
    s.append(["연도", "원문 확보", "대체·가공만", "못 구함", "게시 전", "해당 없음", "미확인", "합계"])
    for y in YEARS:
        v = summary[y]
        s.append([y, v["확보"], v["대체만"], v["못 구함"], v["게시 전"], v["해당 없음"], v["미확인"],
                  sum(v.values())])
    s.append([])
    s.append([f"기준: 대상 {len(T)}곳 (universities.json 351 − 제외 6). 만든 날: {dt.datetime.now():%Y-%m-%d %H:%M}"])
    s.append(["칸 읽는 법: 형식(문서종류). 예) PDF(수시요강, 정시요강). '·대체' = 대학 원문이 아닌 합본·포털 자료, '·가공' = 원문을 이어붙이는 등 손댄 사본. "
              "미확인·게시 전·해당 없음은 회색, 못 구함은 빨강"])

    f = wb.create_sheet("파일목록")
    f.append(FIELDS)
    for y in YEARS:
        for r in man[y]:
            f.append([r.get(k, "") for k in FIELDS])
    out = RAW / "수집현황.xlsx"
    wb.save(out)
    print(f"저장: {out}")
    for y in YEARS:
        print(y, summary[y])


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("targets")
    t.add_argument("--kind", choices=["대학교", "전문대학"])
    a = sub.add_parser("add")
    m = sub.add_parser("miss")
    for p in (a, m):
        p.add_argument("--year", required=True)
        p.add_argument("--who", required=True)
        p.add_argument("--univ", required=True)
        p.add_argument("--doc", required=True)
        p.add_argument("--url", default="")
    a.add_argument("--file", required=True)
    a.add_argument("--posted", default="")
    a.add_argument("--note", default="")
    a.add_argument("--campus", default="", help="캠퍼스별 파일이면 캠퍼스 이름")
    a.add_argument("--substitute", action="store_true", help="대학 원문이 아닌 대체 자료")
    m.add_argument("--reason", required=True)
    sub.add_parser("status")
    args = ap.parse_args()
    if args.cmd == "targets":
        for u in targets():
            if args.kind and u.get("kind") != args.kind:
                continue
            print("\t".join(str(x) for x in (u["no"], u["univId"], u["name"], u.get("kind"),
                                             u.get("region"), u.get("admissionOfficeUrl", ""))))
    elif args.cmd == "add":
        add(args.year, args.who, args.univ, args.doc, args.file, args.url, args.posted,
            args.note, "대체" if args.substitute else "원문", campus=args.campus)
    elif args.cmd == "miss":
        miss(args.year, args.who, args.univ, args.doc, args.reason, args.url)
    elif args.cmd == "status":
        status_xlsx()


if __name__ == "__main__":
    main()
