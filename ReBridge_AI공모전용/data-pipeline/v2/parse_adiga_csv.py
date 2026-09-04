"""어디가(adiga.kr) 대학별 전형결과 CSV → L1 적재 → 앱 JSON.

## 이 스크립트가 다루는 원본

  ../Application_main_codes/src/data/pdf_sources/results_2026/adiga/
    manifest.csv          대학명·univId·파일명·출처URL·받은 날짜·상태·비고
    {대학}[{캠퍼스}].csv   캠퍼스별 전형결과 197개

`results_2026/`의 다른 자료(PDF)와 달리 이건 **HTML 표를 그대로 뽑은 CSV**라
`extract_results_2025.py`(PDF 파서)를 쓸 수 없다. 그래서 전용 파서를 따로 둔다.

## 학년도 (2026-09-03 검증 완료 — README 및 보고서 참조)

manifest의 URL은 `searchSyr=2027`이지만 이건 **2027학년도 안내 페이지**의 주소이고,
그 페이지 안의 `tsrdCmphSlcnArtclUpCd=30` 탭 제목이 **"2026학년도 전형 결과"**다.
즉 담긴 값은 2026학년도 결과다. 근거는 아래 넷.

  1) 그 URL을 실제로 열면 "2027학년도 대학별 전형 평가기준 및 전년도 결과공개 안내"
     아래에 "Q 2027학년도 전형별 주요사항" / "Q 2026학년도 전형 결과" 두 탭이 있다.
  2) 아신대 CSV 안에 "미제출 사유 : 2026학년도부터 '학생부교과전형'으로만 선발함"이
     있고, 그 행들의 정시 모집인원이 실제로 0이다 (2026학년도 시점과 일치).
  3) L1의 2025학년도 값과 다르다. 예) 국민대 교과성적우수자 건축학부
     2025 = 경쟁률 6.59 / 70%컷 2.38·983.47,  이 CSV = 경쟁률 7.06 / 70%컷 2.01·989.46
  4) 외부 교차확인 (에듀진 2026학년도 기사)
     - 세종대 지역균형 경영학부 70% 환산점수 987.05  = CSV 987.05
     - 가천대 학종 미디어커뮤니케이션 경쟁률 114.67  = CSV 114.67
       약학과 48.17 · 의예과 39.31 · 한의예과 35     = CSV 전부 일치
     - 가천대 교과 미디어커뮤니케이션 경쟁률 13.6     = CSV 13.6
     - 세종대 교과 미디어커뮤니케이션 경쟁률 9.67     = 기사 9.7

2027학년도 수시는 2026-09 현재 원서접수 중이라 결과가 존재할 수 없다.
따라서 이 자료가 2027학년도일 가능성은 원리적으로 없다.

## CSV 구조

전형 블록이 한 파일 안에 여러 번 반복된다. 블록 하나는 이렇게 생겼다.

    학생부종합전형, 학생부종합(농어촌(종합))          ← 대분류, 전형명
    구분,모집단위,모집인원,,,경쟁률,충원인원,학생부,,,,   ← 헤더 1
    ,,최초 (A),이월 (B),최종 (A)+(B),,,환산점수,,환산등급,,총점 (학생부)  ← 헤더 2
    ,,,,,,,50%,70%,50%,70%,                        ← 헤더 3
    수시,경영학과,5,0,5,22,2,0.0,0.0,4.02,4.03,0.0   ← 데이터
    ...
    (빈 줄) 다음 블록

열 배치는 세 가지뿐이다 (197개 파일 전수 확인, 헤더 시그니처 5종).

  12/13열 — 학생부교과·학생부종합
    0 구분 / 1 모집단위 / 2 최초(A) / 3 이월(B) / 4 최종(A+B) / 5 경쟁률 / 6 충원인원
    7 환산점수50 / 8 환산점수70 / 9 환산등급50 / 10 환산등급70 / 11~ 총점(학생부)
    ⚠️ 총점은 13열일 때 11번 또는 12번 칸에 들어간다(원본 표의 셀 병합 잔재).
       한 행에 둘 다 값이 있는 경우는 0건이라, "11번 이후 중 값이 있는 칸"으로 읽는다.

  31열 — 수능위주
    0~8은 위와 같되 7·8이 수능 환산점수 50%/70%
    9~19  백분위 50% : 국어 수학 탐구1(사/과/직) 탐구2(사/과/직) 평균백분위 한국사등급 영어등급
    20~30 백분위 70% : 같은 순서

  ⚠️ 수시/정시 구분은 블록이 아니라 **행**에 있다(0번 칸).
     학생부교과 블록 안에 정시 행이 2,009개 있다("정시는 시행 안 함" 같은 설명 행).

## 값 규칙

  - "미제출 사유 : …" 문구는 값 자리(12/13열은 7번, 31열은 9번)에 들어온다.
    → 값은 NULL, 문구는 note로 옮긴다. 절대 숫자로 읽지 않는다.
  - 환산점수·환산등급·백분위의 `0.0`은 값이 아니라 **빈칸 표시**다.
    (등급 0, 백분위 0은 존재할 수 없다. 실제로 점수 0.0인 행은 등급에 값이 있다.)
    → NULL로 둔다. 모집인원·충원인원·경쟁률의 0은 진짜 0이므로 그대로 둔다.
  - 환산점수 `9999.0`은 센티널이다(신경주대 22행). → NULL + confidence=low.
  - 숫자에 쉼표가 있으면 하나의 수로 읽는다(실측 0건이지만 방어적으로 처리).

## confidence

  low   센티널(9999) 감지 — 집계에서 제외된다
  mid   최종 모집인원 ≤ 3 (어디가 자체가 3명 이하는 대부분 미제출로 뺄 만큼 표본이 얇다)
  high  그 외

## 실행

    python3 v2/parse_adiga_csv.py                # 파싱 + 통계만 (아무것도 쓰지 않음)
    python3 v2/parse_adiga_csv.py --jsonl        # 학과 단위 JSONL만 생성
    python3 v2/parse_adiga_csv.py --to-db        # L1(cutline) 적재
    python3 v2/parse_adiga_csv.py --export       # 앱용 cutlines_2026.json 생성
    python3 v2/parse_adiga_csv.py --to-db --export --jsonl   # 전부

앱 코드는 건드리지 않는다. JSON 파일만 만들어 둔다.
"""

import argparse
import csv
import json
import re
import statistics as st
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C

YEAR = 2026
GRADE_SCALE = "9"                     # 2027 이하는 9등급. 2028부터 5등급
SRC_DIR = C.PDF_ROOT / f"results_{YEAR}" / "adiga"
MANIFEST = SRC_DIR / "manifest.csv"
PUBLISHER = "한국대학교육협의회 대입정보포털 어디가(adiga.kr)"

OUT_DIR = C.OUT
PROGRAM_FILE = OUT_DIR / f"cutlines_{YEAR}_programs.jsonl"
APP_FILE = C.APP_DATA / f"cutlines_{YEAR}.json"
REPORT_FILE = OUT_DIR / f"cutlines_{YEAR}_report.md"

CATEGORIES = ("학생부교과전형", "학생부종합전형", "수능위주전형")
PHASES = ("수시", "정시(가)", "정시(나)", "정시(다)")
SENTINEL = 9999.0
USE_CONFIDENCE = ("high", "mid")      # rebuild_cutlines.py와 동일

# 31열 백분위 블록의 칸 이름 (50%는 9번부터, 70%는 20번부터)
PCT_KEYS = ["국어", "수학", "탐구1_사탐", "탐구1_과탐", "탐구1_직탐",
            "탐구2_사탐", "탐구2_과탐", "탐구2_직탐",
            "평균백분위", "한국사등급", "영어등급"]


# ── 값 읽기 ─────────────────────────────────────────────────────────
def nfc(s):
    return unicodedata.normalize("NFC", str(s or ""))


def cell(row, i):
    return nfc(row[i]).strip() if i < len(row) else ""


def num(s):
    """'1,061.93' → 1061.93 / '' → None / 문구 → None."""
    s = nfc(s).strip().replace(",", "")
    if not s:
        return None
    if not re.fullmatch(r"-?\d*\.?\d+", s):
        return None
    return float(s)


def intnum(s):
    v = num(s)
    return int(v) if v is not None and float(v).is_integer() else None


def is_note(s):
    s = nfc(s)
    return bool(s) and not re.fullmatch(r"-?[\d,]*\.?\d*", s.strip())


def cutval(s):
    """컷 값 전용. 0.0과 9999.0은 값이 아니다.

    돌려주는 것: (값 또는 None, 'ok' | 'blank' | 'sentinel')
    """
    v = num(s)
    if v is None:
        return None, "blank"
    if v == SENTINEL:
        return None, "sentinel"
    if v == 0.0:
        return None, "blank"
    return v, "ok"


# ── 파일명 → 대학/캠퍼스 ────────────────────────────────────────────
def split_campus(fname):
    """'강원대학교[제2캠퍼스].csv' → ('강원대학교', '제2캠퍼스')"""
    stem = nfc(Path(fname).stem)
    m = re.match(r"([^\[]+)\[([^\]]*)\]", stem)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return stem.strip(), None


# ── 전형유형 ────────────────────────────────────────────────────────
def admission_type(category, name):
    """대분류를 정본으로 쓰고, 전형명에 더 구체적인 단서가 있으면 덧붙인다.

    어디가 전형결과 공개는 학생부교과·학생부종합·수능위주 세 갈래뿐이다.
    논술·실기 전형은 이 자료에 **별도 대분류로 존재하지 않는다**(커버리지 한계).
    전형명에 논술/실기가 보이면 subtype으로만 남기고 대분류를 바꾸지 않는다.
    """
    base = C.norm_admission_type(category) or nfc(category)
    n = nfc(name)
    sub = None
    for kw in ("논술", "실기", "면접"):
        if kw in n:
            sub = kw
            break
    return base, sub


def norm_phase(raw):
    """'정시(가)' → ('정시', '가') / '수시' → ('수시', None)"""
    s = nfc(raw).strip()
    if s.startswith("정시"):
        m = re.search(r"[（(]([가나다])[)）]", s)
        return "정시", (m.group(1) if m else None)
    if s.startswith("수시"):
        return "수시", None
    return None, None


# ── 블록 파싱 ───────────────────────────────────────────────────────
def parse_block_rows(rows, start, ncols, stat):
    """헤더 3줄 다음부터 다음 블록 제목(또는 파일 끝)까지의 데이터 행."""
    out = []
    i = start
    while i < len(rows):
        r = rows[i]
        head = cell(r, 0)
        if head in CATEGORIES:
            break
        i += 1
        if not any(nfc(x).strip() for x in r):
            continue
        if head == "구분" or not head:
            continue
        if head not in PHASES:
            stat[f"낯선 구분값:{head}"] += 1
            continue
        out.append(r)
    return out, i


def parse_row(r, ncols):
    """데이터 행 하나 → dict. 값이 없으면 NULL, 문구는 note."""
    phase, group = norm_phase(cell(r, 0))
    unit = C.squash(cell(r, 1))

    rec_init = intnum(cell(r, 2))
    rec_carry = intnum(cell(r, 3))
    rec_final = intnum(cell(r, 4))
    comp = num(cell(r, 5))
    fill = intnum(cell(r, 6))

    note = None
    flags = set()
    d = {
        "phase": phase, "group": group, "unit": unit,
        "recruitInitial": rec_init, "recruitCarryover": rec_carry,
        "recruitCount": rec_final, "competition": comp, "fillCount": fill,
        "cut50Grade": None, "cut50Score": None,
        "cut70Grade": None, "cut70Score": None,
        "maxScore": None, "pct50": None, "pct70": None,
        "pctAvg50": None, "pctAvg70": None,
        "note": None,
    }

    if ncols >= 31:
        # 수능위주 — 7·8이 수능 환산점수, 9번 칸에 미제출 문구가 들어온다
        if is_note(cell(r, 9)):
            note = C.squash(cell(r, 9))
        for k, key in ((7, "cut50Score"), (8, "cut70Score")):
            v, why = cutval(cell(r, k))
            d[key] = v
            if why == "sentinel":
                flags.add("sentinel")
        for base, pkey, akey in ((9, "pct50", "pctAvg50"), (20, "pct70", "pctAvg70")):
            det = {}
            for off, name in enumerate(PCT_KEYS):
                v, _ = cutval(cell(r, base + off))
                if v is not None:
                    det[name] = v
            if det:
                d[pkey] = det
                d[akey] = det.get("평균백분위")
    else:
        # 학생부 — 7번 칸에 미제출 문구가 들어온다
        if is_note(cell(r, 7)):
            note = C.squash(cell(r, 7))
        for k, key in ((7, "cut50Score"), (8, "cut70Score"),
                       (9, "cut50Grade"), (10, "cut70Grade")):
            v, why = cutval(cell(r, k))
            d[key] = v
            if why == "sentinel":
                flags.add("sentinel")
        # 총점(만점) — 11번 이후 중 값이 있는 칸 (셀 병합 잔재로 위치가 흔들린다)
        for k in range(11, max(len(r), 12)):
            v, _ = cutval(cell(r, k))
            if v is not None:
                d["maxScore"] = v
                break

    d["note"] = note
    if flags:
        d["confidence"] = "low"
    elif rec_final is not None and rec_final <= 3:
        d["confidence"] = "mid"
    else:
        d["confidence"] = "high"
    return d


def parse_file(path, stat):
    """CSV 하나 → 학과 단위 dict 목록."""
    rows = list(csv.reader(open(path, encoding="utf-8-sig")))
    out = []
    i = 0
    while i < len(rows):
        r = rows[i]
        cat = cell(r, 0)
        if cat not in CATEGORIES:
            i += 1
            continue
        name = C.squash(cell(r, 1))
        ncols = len(r)
        stat[f"블록:{cat}"] += 1
        data, i = parse_block_rows(rows, i + 4, ncols, stat)
        atype, subtype = admission_type(cat, name)
        for dr in data:
            d = parse_row(dr, ncols)
            d["admissionCategory"] = cat
            d["admissionType"] = atype
            d["admissionSubtype"] = subtype
            d["admissionName"] = name
            out.append(d)
    return out


# ── manifest ────────────────────────────────────────────────────────
def load_manifest():
    rows = list(csv.DictReader(open(MANIFEST, encoding="utf-8-sig")))
    ok, ng = [], []
    for r in rows:
        rec = {k: nfc(v).strip() for k, v in r.items()}
        (ok if rec.get("상태(성공/못 구함)") == "성공" else ng).append(rec)
    return ok, ng


# ── 전체 파싱 ───────────────────────────────────────────────────────
def collect():
    ok, ng = load_manifest()
    matcher = C.UnivMatcher()
    stat = Counter()
    rows = []
    files_done = []

    for m in ok:
        fname = m["파일명"]
        if not fname:
            stat["manifest 성공인데 파일명 없음"] += 1
            continue
        path = SRC_DIR / fname
        if not path.exists():                       # macOS NFD 대비
            cand = [p for p in SRC_DIR.iterdir() if nfc(p.name) == nfc(fname)]
            if not cand:
                stat["파일 없음"] += 1
                continue
            path = cand[0]

        uname, campus = split_campus(fname)
        uid = m["univId"] if m["univId"] else None
        if uid and uid not in matcher.by_id:
            uid = None
        if not uid:
            uid = matcher.match(uname)
        if not uid:
            stat["대학 매칭 실패"] += 1
            continue

        parsed = parse_file(path, stat)
        for d in parsed:
            d["univId"] = uid
            d["univName"] = matcher.name_of(uid) or uname
            d["adigaName"] = uname
            d["campus"] = campus
            d["sourceFile"] = nfc(fname)
            d["sourceUrl"] = m["출처URL"]
            d["retrievedAt"] = m["받은 날짜"]
            d["year"] = YEAR
            d["gradeScale"] = GRADE_SCALE
        rows.extend(parsed)
        files_done.append(nfc(fname))
        stat["파일 처리"] += 1

    return rows, files_done, ok, ng, matcher, stat


# ── L1 적재 ─────────────────────────────────────────────────────────
NEW_COLS = [
    ("campus", "TEXT"),
    ("recruit_initial", "INTEGER"),
    ("recruit_carryover", "INTEGER"),
    ("fill_count", "INTEGER"),
    ("max_score", "REAL"),
    ("pct_avg", "REAL"),
    ("csat_detail", "TEXT"),
    ("admission_subtype", "TEXT"),
]


def ensure_columns(con):
    """cutline에 없는 컬럼만 추가한다. 기존 컬럼은 건드리지 않는다.

    schema.sql의 CREATE TABLE에도 같은 컬럼을 적어 두었지만
    IF NOT EXISTS라 이미 있는 DB에는 반영되지 않는다. 그래서 여기서 맞춘다.
    """
    have = {r[1] for r in con.execute("PRAGMA table_info(cutline)")}
    added = []
    for name, typ in NEW_COLS:
        if name not in have:
            con.execute(f"ALTER TABLE cutline ADD COLUMN {name} {typ}")
            added.append(name)
    return added


def to_db(rows, files_done, dry=False):
    con = C.connect()
    con.execute("PRAGMA busy_timeout=30000")        # 동시 작업자가 있다
    added = ensure_columns(con)
    if added:
        print(f"  cutline 컬럼 추가: {', '.join(added)}")

    known = {r["univ_id"] for r in con.execute("SELECT univ_id FROM university")}
    prog = {(r["univ_id"], r["name_key"]): r["program_id"]
            for r in con.execute("SELECT program_id, univ_id, name_key FROM program")}

    src_by_file = {}
    for r in con.execute(
            "SELECT source_id, title FROM source_file WHERE kind='result' AND year=?", (YEAR,)):
        src_by_file[nfc(r["title"])] = r["source_id"]

    stat = Counter()
    old = con.execute("SELECT COUNT(*) c FROM cutline WHERE year=?", (YEAR,)).fetchone()["c"]
    if old:
        con.execute("DELETE FROM cutline WHERE year=?", (YEAR,))
        print(f"  기존 {YEAR}학년도 {old:,}행 삭제 후 재적재 (2025행은 건드리지 않음)")

    for d in rows:
        uid = d["univId"]
        if uid not in known:
            stat["대학 없음(건너뜀)"] += 1
            continue

        # 출처 — 파일 하나당 source_file 한 행. source_id는 NOT NULL이다.
        f = d["sourceFile"]
        sid = src_by_file.get(f)
        if sid is None:
            path = SRC_DIR / f
            sid = con.execute(
                """INSERT INTO source_file
                   (kind,year,title,path,sha256,source_url,publisher,retrieved_at,note)
                   VALUES ('result',?,?,?,?,?,?,?,?)""",
                (YEAR, f, str(path) if path.exists() else None,
                 C.sha256(path) if path.exists() else None,
                 d["sourceUrl"], PUBLISHER, d["retrievedAt"],
                 "어디가 2027학년도 안내 페이지의 '2026학년도 전형 결과' 탭")).lastrowid
            src_by_file[f] = sid

        pid = None
        if d["unit"]:
            k = C.key_name(d["unit"])
            pid = prog.get((uid, k))
            if pid is None:
                pid = con.execute(
                    "INSERT INTO program (univ_id,name,name_key) VALUES (?,?,?)",
                    (uid, d["unit"], k)).lastrowid
                prog[(uid, k)] = pid

        base = dict(
            univ_id=uid, program_id=pid, year=YEAR, grade_scale=GRADE_SCALE,
            campus=d["campus"], phase=d["phase"],
            admission_type=d["admissionType"], admission_subtype=d["admissionSubtype"],
            admission_name=d["admissionName"],
            recruit_count=d["recruitCount"],
            recruit_initial=d["recruitInitial"], recruit_carryover=d["recruitCarryover"],
            fill_count=d["fillCount"], competition=d["competition"],
            max_score=d["maxScore"], source_id=sid, page=None,
            confidence=d["confidence"], note=d["note"],
        )

        made = 0
        for label, g, s, pa, det in (
                ("50%컷", d["cut50Grade"], d["cut50Score"], d["pctAvg50"], d["pct50"]),
                ("70%컷", d["cut70Grade"], d["cut70Score"], d["pctAvg70"], d["pct70"])):
            if g is None and s is None and pa is None:
                continue
            row = dict(base, cut_type=label, cut_grade=g, cut_score=s, pct_avg=pa,
                       csat_detail=json.dumps(det, ensure_ascii=False) if det else None)
            insert(con, row)
            made += 1
            stat[f"적재 {label}"] += 1

        if made == 0:
            # 값이 하나도 없는 행. 경쟁률·모집인원·충원인원은 살아 있으므로 버리지 않는다.
            # cut_type='미제출'이라 어떤 집계에도 섞이지 않는다.
            insert(con, dict(base, cut_type="미제출", cut_grade=None, cut_score=None,
                             pct_avg=None, csat_detail=None))
            stat["적재 미제출(값 없음)"] += 1

    con.execute(
        "INSERT INTO ingest_log (ran_at,script,target,rows_in,rows_out,note) VALUES (?,?,?,?,?,?)",
        (date.today().isoformat(), "parse_adiga_csv.py", f"{YEAR}학년도 전형결과(어디가 CSV)",
         len(rows), sum(v for k, v in stat.items() if k.startswith("적재")),
         f"CSV {len(files_done)}개 · searchSyr=2027 페이지의 2026학년도 전형결과 탭"))
    con.commit()
    return stat


COLS = ("univ_id program_id year grade_scale campus phase admission_type admission_subtype "
        "admission_name cut_type cut_grade cut_score pct_avg csat_detail recruit_count "
        "recruit_initial recruit_carryover fill_count competition max_score "
        "source_id page confidence note").split()


def insert(con, row):
    con.execute(
        f"INSERT INTO cutline ({','.join(COLS)}) VALUES ({','.join('?' * len(COLS))})",
        [row.get(c) for c in COLS])


# ── 학과 단위 JSONL ─────────────────────────────────────────────────
def write_programs(rows):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    n = 0
    with open(PROGRAM_FILE, "w", encoding="utf-8") as f:
        for d in rows:
            rec = {
                "univId": d["univId"], "univ": d["univName"], "campus": d["campus"],
                "program": d["unit"], "year": YEAR, "gradeScale": GRADE_SCALE,
                "phase": d["phase"], "phaseGroup": d["group"],
                "admissionCategory": d["admissionCategory"],
                "admissionType": d["admissionType"],
                "admissionSubtype": d["admissionSubtype"],
                "admissionName": d["admissionName"],
                "recruit": {"initial": d["recruitInitial"],
                            "carryover": d["recruitCarryover"],
                            "final": d["recruitCount"]},
                "competition": d["competition"], "fillCount": d["fillCount"],
                "cut": {
                    "50%컷": {"grade": d["cut50Grade"], "score": d["cut50Score"],
                              "pctAvg": d["pctAvg50"], "pct": d["pct50"]},
                    "70%컷": {"grade": d["cut70Grade"], "score": d["cut70Score"],
                              "pctAvg": d["pctAvg70"], "pct": d["pct70"]},
                },
                "maxScore": d["maxScore"],
                "confidence": d["confidence"], "note": d["note"],
                "src": {"file": d["sourceFile"], "url": d["sourceUrl"],
                        "retrievedAt": d["retrievedAt"],
                        "publisher": PUBLISHER},
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n += 1
    return n


# ── 앱용 JSON ───────────────────────────────────────────────────────
def median(vals):
    vals = [v for v in vals if v is not None]
    return st.median(vals) if vals else None


def build_blocks(rows):
    """대학 × 전형유형 집계. cutlines_2025.json과 같은 모양.

    집계 방식은 rebuild_cutlines.py와 동일하게 median(high+mid)를 쓴다.
    cutGradeAvg/cutScoreAvg는 원천에 '평균' 컷이 있을 때만 채운다 —
    어디가 CSV에는 평균이 없으므로 항상 null이다. 50%컷을 평균이라고 부르지 않는다
    (v1이 그렇게 해서 앱이 사용자에게 80%컷을 '평균'이라고 말하고 있었다).
    """
    by = defaultdict(list)
    for d in rows:
        if d["admissionType"]:
            by[(d["univId"], d["admissionType"])].append(d)

    out = defaultdict(dict)
    for (uid, atype), rs in by.items():
        used = [d for d in rs if d["confidence"] in USE_CONFIDENCE]
        if not used:
            continue

        g70 = median([d["cut70Grade"] for d in used])
        s70 = median([d["cut70Score"] for d in used])
        g50 = median([d["cut50Grade"] for d in used])
        s50 = median([d["cut50Score"] for d in used])
        p70 = median([d["pctAvg70"] for d in used])
        p50 = median([d["pctAvg50"] for d in used])

        by_type = {}
        if g50 is not None or s50 is not None:
            by_type["50%컷"] = {
                "grade": g50, "score": s50,
                "n": sum(1 for d in used
                         if d["cut50Grade"] is not None or d["cut50Score"] is not None)}
        if p50 is not None:
            by_type["백분위50%"] = {
                "grade": None, "score": p50,
                "n": sum(1 for d in used if d["pctAvg50"] is not None)}
        if p70 is not None:
            by_type["백분위70%"] = {
                "grade": None, "score": p70,
                "n": sum(1 for d in used if d["pctAvg70"] is not None)}

        n_val = sum(1 for d in used if any(
            d[k] is not None for k in
            ("cut50Grade", "cut50Score", "cut70Grade", "cut70Score", "pctAvg50", "pctAvg70")))
        if g70 is None and s70 is None and not by_type:
            continue

        confs = {d["confidence"] for d in used if d["confidence"] in USE_CONFIDENCE}
        files = sorted({d["sourceFile"] for d in used})
        urls = sorted({d["sourceUrl"] for d in used})
        programs = sorted({d["unit"] for d in used if d["unit"]})
        got = sorted({d["retrievedAt"] for d in used if d["retrievedAt"]})

        out[uid][atype] = {
            # ── cutlines_2025.json과 같은 4필드 ──
            "cutGradeAvg": None,        # 어디가 CSV에 '평균' 컷이 없다. 지어내지 않는다
            "cutGrade70": g70,
            "cutScoreAvg": None,
            "cutScore70": s70,
            "n": n_val,
            "confidence": "high" if confs == {"high"} else "mid",
            "byType": by_type,
            "src": {
                "csv": files,
                "url": urls,
                "retrievedAt": got[-1] if got else None,
                "publisher": PUBLISHER,
                "programs": len(programs),
                "method": "median(high+mid)",
                "year": YEAR,
                "gradeScale": GRADE_SCALE,
            },
        }
    return out


def export_app(rows):
    blocks = build_blocks(rows)
    doc = {
        "meta": {
            "year": YEAR,
            "gradeScale": GRADE_SCALE,
            "method": "median(high+mid) · 대학×전형유형 집계 · 학과 단위 원본은 "
                      f"v2/out/{PROGRAM_FILE.name}",
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "source": PUBLISHER,
            "note": "어디가 2027학년도 안내 페이지의 '2026학년도 전형 결과' 탭에서 받은 "
                    "대학별 CSV 197개. cutGradeAvg/cutScoreAvg는 원천에 '평균' 컷이 "
                    "없어 항상 null이다 — 50%컷은 byType['50%컷']에 있다.",
        },
    }
    doc.update({uid: v for uid, v in sorted(blocks.items())})
    size = C.jdump(doc, APP_FILE)
    return blocks, size


# ── 리포트 ──────────────────────────────────────────────────────────
def report(rows, files_done, ok, ng, blocks, stat):
    univ_all = len(C.load_universities())
    univs_csv = {d["univId"] for d in rows}
    has_val = {d["univId"] for d in rows if any(
        d[k] is not None for k in
        ("cut50Grade", "cut50Score", "cut70Grade", "cut70Score", "pctAvg50", "pctAvg70"))}
    n_val = sum(1 for d in rows if any(
        d[k] is not None for k in
        ("cut50Grade", "cut50Score", "cut70Grade", "cut70Score", "pctAvg50", "pctAvg70")))
    n_note = sum(1 for d in rows if d["note"])

    cat = Counter(d["admissionCategory"] for d in rows)
    blk = Counter(k.split(":", 1)[1] for k in stat if k.startswith("블록:")
                  for _ in range(stat[k]))
    ph = Counter(d["phase"] for d in rows)

    ngnames = sorted({r["대학명"] for r in ng} - {r["대학명"] for r in ok})

    L = [
        f"# {YEAR}학년도 전형결과(어디가 CSV) 적재 리포트", "",
        f"생성: {date.today().isoformat()} · `v2/parse_adiga_csv.py`", "",
        "## 학년도 검증", "",
        "manifest URL의 `searchSyr=2027`은 **2027학년도 안내 페이지** 주소이고, "
        "그 안의 `tsrdCmphSlcnArtclUpCd=30` 탭 제목이 **\"2026학년도 전형 결과\"**다.",
        "", "| 근거 | 확인 내용 |", "|---|---|",
        "| 원본 페이지 | 해당 URL에 \"2027학년도 대학별 전형 평가기준 및 전년도 결과공개 안내\" / "
        "\"Q 2026학년도 전형 결과\" 탭 존재 |",
        "| CSV 내부 표기 | 아신대 CSV에 \"2026학년도부터 '학생부교과전형'으로만 선발함\" — "
        "해당 정시 행 모집인원 0 |",
        "| 2025 대비 | 국민대 교과성적우수자 건축학부 2025=경쟁률 6.59·70%컷 2.38 / "
        "이 CSV=7.06·2.01 → 2025 아님 |",
        "| 외부 교차확인 | 세종대 지역균형 경영학부 70% 환산점수 987.05 = CSV 987.05 |",
        "| 외부 교차확인 | 가천대 학종 미디어커뮤니케이션 114.67 · 약학 48.17 · 의예 39.31 · "
        "한의예 35 = CSV 전부 일치 |",
        "| 논리 | 2027학년도 수시는 2026-09 현재 접수 중 → 2027 결과는 존재 불가 |",
        "", "## 커버리지", "",
        "| 항목 | 수 |", "|---|---|",
        f"| 대학 마스터 전체 | {univ_all} |",
        f"| CSV를 받은 대학(캠퍼스 합산 후 univId) | {len(univs_csv)} |",
        f"| CSV 파일 | {len(files_done)} |",
        f"| 컷 값이 하나라도 있는 대학 | {len(has_val)} |",
        f"| 학과 단위 행 | {len(rows):,} |",
        f"| 값이 있는 학과 행 | {n_val:,} ({n_val / max(len(rows), 1):.1%}) |",
        f"| '미제출' 문구가 붙은 행 | {n_note:,} ({n_note / max(len(rows), 1):.1%}) |",
        f"| 앱 집계 블록 | {sum(len(v) for v in blocks.values())} (대학 {len(blocks)}개) |",
        "", "### 전형 대분류별", "",
        "| 대분류 | 블록 | 학과 행 | 값 있는 행 | 앱 집계 블록 |", "|---|---|---|---|---|",
    ]
    valrows = [d for d in rows if any(
        d[k] is not None for k in
        ("cut50Grade", "cut50Score", "cut70Grade", "cut70Score", "pctAvg50", "pctAvg70"))]
    catval = Counter(d["admissionCategory"] for d in valrows)
    appblk = Counter(t for v in blocks.values() for t in v)
    for c in CATEGORIES:
        t = C.norm_admission_type(c) or c
        n = cat.get(c, 0)
        L.append(f"| {c} | {stat.get('블록:' + c, 0):,} | {n:,} | "
                 f"{catval.get(c, 0):,} ({catval.get(c, 0) / max(n, 1):.0%}) | "
                 f"{appblk.get(t, 0)} |")
    L += ["", "### 수시/정시", "", "| 구분 | 행 |", "|---|---|"]
    for k, v in ph.most_common():
        L.append(f"| {k or '(미상)'} | {v:,} |")

    # ── 2025학년도 대비 ──
    old = C.jload(C.APP_DATA / "cutlines_2025.json") if (
        C.APP_DATA / "cutlines_2025.json").exists() else {}
    new_ids, old_ids = set(blocks), set(old)
    L += ["", "### 2025학년도 대비", "", "| | 2025 | 2026 |", "|---|---|---|",
          f"| 앱 JSON 대학 | {len(old_ids)} | {len(new_ids)} |",
          f"| 앱 집계 블록 | {sum(len(v) for v in old.values())} | "
          f"{sum(len(v) for v in blocks.values())} |",
          f"| 학과 단위 행 | 14,274 | {len(rows):,} |", "",
          f"- 2026에 새로 생긴 대학 **{len(new_ids - old_ids)}개**",
          f"- 2025에는 있는데 2026에는 없는 대학 **{len(old_ids - new_ids)}개** "
          f"({', '.join(sorted(old_ids - new_ids))}) — 어디가에 항목이 없거나 전 전형 미제출이다. "
          "**2025 행은 그대로 둔다.**", ""]

    zero = sorted({d["univName"] for d in rows} - {d["univName"] for d in valrows})
    if zero:
        L += [f"### CSV는 있는데 컷 값이 하나도 없는 대학 {len(zero)}개", "",
              "전 전형이 '미제출'이다. 경쟁률·모집인원은 L1에 남아 있다 (`cut_type='미제출'`).",
              "", ", ".join(zero), ""]

    L += ["", f"## 어디가에서 못 구한 대학 {len(ngnames)}개", "",
          "manifest 사유: 어디가 2027 목록에서 대학명 대응 항목을 찾지 못함", ""]
    for i, n in enumerate(ngnames, 1):
        L += [f"{i}. {n}"]
    L += ["", "캠퍼스 일부만 실패: 강원대학교[제3·제4캠퍼스], 경동대학교[본교] "
          "(원본 표 0개 — 어디가 Ajax 응답에 표가 없음)", ""]

    L += ["## 주의", "",
          "- 어디가 전형결과 공개는 **학생부교과·학생부종합·수능위주 세 갈래뿐**이다. "
          "논술·실기 전형은 이 자료에 대분류로 존재하지 않는다.",
          "- `cutGradeAvg`/`cutScoreAvg`는 항상 `null`이다. 원천에 '평균' 컷이 없다. "
          "50%컷을 평균이라고 부르지 않는다.",
          "- 환산점수·등급·백분위의 `0.0`은 값이 아니라 빈칸 표시라 NULL로 뒀다.",
          "- 신경주대 22행의 환산점수 `9999.0`은 센티널이라 NULL + confidence=low로 뺐다.",
          f"- 2026학년도는 **9등급** 내신이다. 2028학년도(5등급) 지원자와 직접 비교 금지.",
          ""]
    REPORT_FILE.write_text("\n".join(L), encoding="utf-8")


# ── main ────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--to-db", action="store_true", help="L1(cutline)에 적재")
    ap.add_argument("--export", action="store_true", help="앱용 cutlines_2026.json 생성")
    ap.add_argument("--jsonl", action="store_true", help="학과 단위 JSONL 생성")
    a = ap.parse_args()

    rows, files_done, ok, ng, matcher, stat = collect()

    n_val = sum(1 for d in rows if any(
        d[k] is not None for k in
        ("cut50Grade", "cut50Score", "cut70Grade", "cut70Score", "pctAvg50", "pctAvg70")))
    n_note = sum(1 for d in rows if d["note"])

    print("═" * 66)
    print(f"  CSV {len(files_done)}개 → 학과 단위 {len(rows):,}행 "
          f"/ 대학 {len({d['univId'] for d in rows})}개")
    print(f"  값 있는 행 {n_val:,} · 미제출 문구 {n_note:,} · "
          f"값도 문구도 없음 {len(rows) - n_val - n_note:,}")
    for c in CATEGORIES:
        print(f"    {c:10} 블록 {stat.get('블록:' + c, 0):>5,}")
    if matcher.unmatched:
        print("  대학명 매칭 실패:", matcher.unmatched.most_common(10))
    for k, v in stat.items():
        if not k.startswith("블록:") and k != "파일 처리":
            print(f"    ⚠️ {k}: {v}")

    n_prog = write_programs(rows) if (a.jsonl or a.export or a.to_db) else 0
    if n_prog:
        print(f"  학과 단위 JSONL {n_prog:,}행 → {PROGRAM_FILE}")

    if a.to_db:
        s = to_db(rows, files_done)
        print("  ── L1 적재 ──")
        for k, v in s.most_common():
            print(f"    {k:24} {v:>8,}")

    blocks = {}
    if a.export:
        blocks, size = export_app(rows)
        print(f"  앱 JSON {sum(len(v) for v in blocks.values())}블록 "
              f"/ 대학 {len(blocks)}개 → {APP_FILE} ({size / 1024:.0f}KB)")
    else:
        blocks = build_blocks(rows)

    report(rows, files_done, ok, ng, blocks, stat)
    print(f"  리포트: {REPORT_FILE}")
    if not (a.to_db or a.export or a.jsonl):
        print("  (아무것도 쓰지 않았습니다 — --to-db / --export / --jsonl)")
    print("═" * 66)


if __name__ == "__main__":
    main()
