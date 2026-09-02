"""Phase B+C — 시행계획에서 검정고시 지원자격과 비교내신 환산표를 뽑는다.

`추출방법_확정.md`의 확정 파이프라인을 따른다. LLM을 쓰지 않는다(비용 0).
  Phase B  키워드로 근거 페이지만 좁힌다 (30쪽 → 5~10쪽)
  Phase C  좁힌 페이지에서 규칙(정규식·표 구조)으로 구조화

## 무엇을 뽑나 — 우선순위 두 개에 집중한다
  ① 비교내신 환산표  앱의 심장. v1은 188개 대학의 원문만 갖고 있고
                     실제 계산 가능한 표는 10개뿐이었다.
  ② 검정고시 지원자격 판정 + **근거 원문 발췌**. 사람이 검증할 때 발췌가 전부다.

전형(admission) 구조 파싱은 여기서 하지 않는다. 대학마다 표 모양이 달라
규칙만으로는 오차가 크고, 틀린 전형 정보는 없는 것보다 나쁘다.
→ 근거 페이지를 좁혀 놓았으니 그 위에서 따로 진행한다.

실행:
  python3 v2/extract_text.py --year 2028      # 먼저 텍스트화
  python3 v2/ingest_plans.py --year 2028      # 추출만 (JSONL + 리포트)
  python3 v2/ingest_plans.py --year 2028 --to-db   # L1에 적재까지
"""

import argparse
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

import common as C

# ── Phase B: 근거 페이지 키워드 ─────────────────────────────────────
KEYWORDS = {
    "ged": re.compile(
        r"검정고시|고등학교\s*졸업.{0,6}(예정)?자|동등\s*이상의?\s*학력|학력\s*인정"),
    "conversion": re.compile(
        r"비교\s*내신|환산\s*(점수|등급|표)|검정고시\s*(성적|점수).{0,12}(환산|반영)|"
        r"학교생활기록부\s*(미보유|없는)"),
    "csat_min": re.compile(r"수능\s*최저|최저\s*학력\s*기준"),
    "recruit": re.compile(r"모집\s*인원|모집\s*단위"),
}

# ── Phase C: 검정고시 지원 가부 판정 ────────────────────────────────
# 한국 시행계획의 표준 문구. 이 문구가 있으면 검정고시 포함 = 지원 가능.
RE_STANDARD_OK = re.compile(
    r"고등학교\s*졸업\s*(예정)?자?\s*(및|또는|과)?\s*.{0,20}"
    r"(법령|법률)에\s*(의|따라).{0,20}동등\s*이상의?\s*학력")
RE_EXPLICIT_OK = re.compile(r"검정고시\s*(출신|합격)자?.{0,20}(지원\s*가능|지원할\s*수\s*있)")
RE_DENY = re.compile(
    r"검정고시\s*(출신|합격)자?.{0,25}(지원\s*(할\s*수\s*없|불가|제외)|지원자격.{0,6}없)")
RE_COND = re.compile(
    r"검정고시\s*(출신|합격)자?.{0,40}"
    r"(제한|한하여|경우에\s*한|별도|불인정|산출\s*불가|지원\s*자격을\s*인정하지)")

# 실제 시행계획에서 가장 흔한 형태 — 지원 가능한 출신 유형을 **나열**하는 문장 안에
# '검정고시 출신자'가 끼어 있다. 문장형이 아니라 목록형이라 위 규칙에 안 걸렸다.
#   예) "…고등기술학교, 검정고시 출신자 등 ※ 「학교폭력예방…"
#   예) "…평생교육시설, 교과교육 소년원의 교육과정, 고등기술학교, 검정고시 출신자 등"
RE_LIST_OK = re.compile(r"[,、]\s*검정고시\s*(출신자|합격자|출신|합격)\s*(등|,|및|\)|$)")

# 표로 지원 가부를 표시하는 대학이 있다(행: 출신고교 유형, 열: 전형).
#   예) "검정고시 합격자 - - - - -"  ← 대시는 해당 전형 지원 불가라는 뜻
# 표는 전형별로 갈리므로 자동 판정하지 않고 '확인필요'로 빼서 사람이 본다.
RE_TABLE_FORM = re.compile(r"검정고시\s*(합격자|출신자)\s*(?:[-–—○×⃝\s]{4,})")

# 등급 표에서 걸러야 할 잡음 (연도·페이지·전화번호 등)
RE_NUM = re.compile(r"^-?\d{1,4}(\.\d{1,3})?$")


def load_pages(year, uid_file):
    with open(uid_file, encoding="utf-8") as f:
        return [json.loads(l) for l in f]


# ── ① 검정고시 지원자격 ─────────────────────────────────────────────
def judge_ged(pages):
    """지원자격 문구로 가부를 판정하고 근거 원문을 함께 돌려준다."""
    hits = []
    for p in pages:
        t = C.squash(p["text"])
        if not KEYWORDS["ged"].search(t):
            continue
        for label, rx in (("불가", RE_DENY), ("조건부", RE_COND),
                          ("확인필요", RE_TABLE_FORM),
                          ("가능", RE_EXPLICIT_OK), ("가능", RE_STANDARD_OK),
                          ("가능", RE_LIST_OK)):
            mm = rx.search(t)
            if mm:
                s = max(0, mm.start() - 80)
                hits.append({
                    "eligible": label,
                    "page": p["page"],
                    "quote": t[s:mm.end() + 110].strip(),
                    "rule": rx.pattern[:30],
                })
                break
    if not hits:
        return None
    # 강한 판정을 우선한다. 제한 문구를 놓치면 학생이 헛되이 지원한다.
    # '확인필요'를 '가능'보다 앞에 두는 이유도 같다 — 표로 갈리는 대학은 사람이 봐야 한다.
    for label in ("불가", "조건부", "확인필요", "가능"):
        for h in hits:
            if h["eligible"] == label:
                h["allHits"] = len(hits)
                h["confidence"] = ("low" if label == "확인필요"
                                   else "high" if label != "가능" or len(hits) > 1
                                   else "mid")
                return h
    return None


# ── ② 비교내신 환산표 ───────────────────────────────────────────────
def conversion_pages(pages):
    """환산표가 있을 법한 페이지만 남긴다."""
    return [p for p in pages if KEYWORDS["conversion"].search(C.squash(p["text"]))]


# ── 가로 방향 환산표 (실제 시행계획에서 가장 흔한 형태) ────────────
#
# 2026-09-02 원문 확인 결과, 환산표는 세로가 아니라 **가로**로 적혀 있다.
#   "석차등급 1 2 3 4 5 6 7 8 9 … 백점만점성적 - 100 95이상 90이상 …"
#   "교과등급 1등급 2등급 … 9등급  성취도 환산 반영점수 500 500 481 471 …"
# PDF에서 뽑은 텍스트는 줄이 뭉개지므로, 표 추출기보다 이 패턴이 훨씬 잘 맞는다.
RE_GRADE_SEQ = re.compile(
    r"(석차\s*등급|교과\s*등급|등급)\s*((?:[1-9]\s*(?:등급)?[\s,]+){2,8}[1-9]\s*(?:등급)?)")
RE_SCORE_SEQ = re.compile(
    r"(반영\s*점수|환산\s*점수|환산\s*반영\s*점수|배점|점수)\s*"
    r"((?:\d{1,4}(?:\.\d{1,2})?[\s,]+){2,8}\d{1,4}(?:\.\d{1,2})?)")


def _nums(s):
    return [float(x) for x in re.findall(r"\d{1,4}(?:\.\d{1,2})?", s)]


def parse_inline_grade_table(text):
    """페이지 텍스트에서 '등급 나열 + 점수 나열' 쌍을 찾아 환산표로 만든다."""
    t = C.squash(text)
    best = None
    for gm in RE_GRADE_SEQ.finditer(t):
        grades = _nums(gm.group(2))
        if len(grades) < 3 or grades != sorted(grades):
            continue
        if len(set(grades)) != len(grades) or max(grades) > 9:
            continue
        # 등급 나열 바로 뒤 구간에서 같은 개수의 점수 나열을 찾는다
        window = t[gm.end():gm.end() + 600]
        for sm in RE_SCORE_SEQ.finditer(window):
            scores = _nums(sm.group(2))
            if len(scores) != len(grades):
                continue
            if len(set(scores)) < 2:            # 전부 같은 값이면 표가 아니다
                continue
            table = [{"grade": g, "score": s} for g, s in zip(grades, scores)]
            mono = all(a >= b for a, b in zip(scores, scores[1:]))
            cand = {
                "type": "grade_table",
                "gradeTable": table,
                "maxScore": max(scores),
                "minScore": min(scores),
                "monotonic": mono,
                "label": C.squash(sm.group(1)),
                "gradeScaleSeen": int(max(grades)),
            }
            if best is None or len(table) > len(best["gradeTable"]) or (
                    mono and not best["monotonic"]):
                best = cand
            break
    return best


def parse_grade_table(rows):
    """표(행 리스트) → grade_table 후보.

    '등급'과 '점수(또는 환산점수)' 두 축이 잡히면 표로 인정한다.
    등급은 1~9(2027 이하) 또는 1~5(2028 이후) 범위여야 한다.
    """
    out = []
    for r in rows:
        cells = [C.squash(c) for c in r if c is not None]
        nums = [c for c in cells if RE_NUM.match(c)]
        if len(nums) < 2:
            continue
        grade = None
        score = None
        for n in nums:
            v = float(n)
            if grade is None and 1 <= v <= 9 and (v == int(v) or len(n.split(".")[-1]) <= 2):
                grade = v
            elif v >= 10:
                score = max(score, v) if score is not None else v
        if grade is not None and score is not None:
            out.append({"grade": grade, "score": score})
    # 등급이 중복 없이 3개 이상 늘어서야 표로 본다
    seen = {}
    for e in out:
        seen.setdefault(e["grade"], e["score"])
    if len(seen) < 3:
        return None
    table = [{"grade": g, "score": s} for g, s in sorted(seen.items())]
    # 등급이 올라갈수록 점수가 내려가야 정상(단조성 검사)
    scores = [t["score"] for t in table]
    monotonic = all(a >= b for a, b in zip(scores, scores[1:]))
    return {
        "type": "grade_table",
        "gradeTable": table,
        "maxScore": max(scores),
        "minScore": min(scores),
        "monotonic": monotonic,
    }


def extract_conversion(pdf_path, cand_pages, pages_by_no):
    """1차는 텍스트 가로표(빠르고 잘 맞음), 안 잡히면 pdfplumber 표 추출로 보강."""
    best = None
    for pno in cand_pages:
        cand = parse_inline_grade_table(pages_by_no.get(pno, ""))
        if cand and (best is None or len(cand["gradeTable"]) > len(best["gradeTable"])):
            cand["page"] = pno
            cand["how"] = "inline"
            best = cand
    if best:
        return best

    if not cand_pages or not pdf_path or not Path(pdf_path).exists():
        return None
    import pdfplumber
    with pdfplumber.open(pdf_path) as pdf:
        for pno in cand_pages[:12]:                    # 후보가 많아도 12쪽까지만
            if pno > len(pdf.pages):
                continue
            try:
                tables = pdf.pages[pno - 1].extract_tables()
            except Exception:
                continue
            for t in tables or []:
                cand = parse_grade_table(t)
                if cand and (best is None or
                             len(cand["gradeTable"]) > len(best["gradeTable"])):
                    cand["page"] = pno
                    cand["how"] = "table"
                    best = cand
    return best


# ── main ────────────────────────────────────────────────────────────
def run(year, to_db=False, limit=None):
    text_dir = C.OUT / "text" / str(year)
    man_path = text_dir / "_manifest.json"
    if not man_path.exists():
        raise SystemExit(f"먼저 실행하세요: python3 v2/extract_text.py --year {year}")
    man = C.jload(man_path)
    items = [i for i in man["items"] if not i.get("cached")] or man["items"]
    if limit:
        items = items[:limit]

    matcher = C.UnivMatcher()
    out_dir = C.OUT / f"plans_{year}"
    out_dir.mkdir(parents=True, exist_ok=True)

    ged_rows, conv_rows, ev_rows = [], [], []
    stat = Counter()

    for it in items:
        uid = it["univId"]
        jf = text_dir / f"{uid}.jsonl"
        if not jf.exists():
            cands = sorted(text_dir.glob(f"{uid}_*.jsonl"))
            if not cands:
                continue
            jf = cands[0]
        pages = load_pages(year, jf)
        stat["대학"] += 1

        # Phase B — 근거 페이지 좁히기
        ev = {k: [p["page"] for p in pages if rx.search(C.squash(p["text"]))]
              for k, rx in KEYWORDS.items()}
        ev_rows.append({"univId": uid, "univ": it.get("univ"), "file": it.get("file"),
                        "pages": len(pages), "evidence": ev})

        # Phase C ① 검정고시
        g = judge_ged(pages)
        if g:
            stat[f"ged:{g['eligible']}"] += 1
            ged_rows.append({"univId": uid, "univ": it.get("univ"), "year": year,
                             "file": it.get("file"), **g})
        else:
            stat["ged:판정불가"] += 1

        # Phase C ② 환산표
        cp = [p["page"] for p in conversion_pages(pages)]
        if cp:
            stat["환산 후보페이지 있음"] += 1
            by_no = {p["page"]: p["text"] for p in pages}
            conv = extract_conversion(it.get("path"), cp, by_no)
            if conv:
                stat["환산표 추출 성공"] += 1
                if not conv["monotonic"]:
                    stat["환산표 단조성 경고"] += 1
                conv_rows.append({"univId": uid, "univ": it.get("univ"), "year": year,
                                  "file": it.get("file"), "candPages": cp[:8], **conv})

    def dump(rows, name):
        p = out_dir / name
        with open(p, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        return p

    dump(ged_rows, "ged.jsonl")
    dump(conv_rows, "conversion.jsonl")
    dump(ev_rows, "evidence_pages.jsonl")

    print("═" * 62)
    for k, v in stat.most_common():
        print(f"  {k:24} {v:>5}")
    print("═" * 62)
    print(f"  → {out_dir}")

    if to_db:
        n = promote(year, ged_rows, conv_rows, matcher)
        print(f"  L1 적재: 환산표 {n} 건")
    return ged_rows, conv_rows, stat


def promote(year, ged_rows, conv_rows, matcher):
    """추출 결과를 L1에 넣는다. 환산표는 대학 단위로(전형별 구분은 다음 단계)."""
    con = C.connect()
    n = 0
    for r in conv_rows:
        sid = con.execute(
            "SELECT source_id FROM source_file WHERE kind='plan' AND title=?",
            (C.nfc(r["file"]),)).fetchone()
        if sid is None:
            sid = con.execute(
                """INSERT INTO source_file (kind,year,title,publisher,retrieved_at)
                   VALUES ('plan',?,?,?,?)""",
                (year, C.nfc(r["file"]), "개별 대학 입학처",
                 date.today().isoformat())).lastrowid
        else:
            sid = sid["source_id"]
        table_json = json.dumps(
            {"type": r["type"], "gradeTable": r["gradeTable"],
             "maxScore": r["maxScore"], "minScore": r["minScore"]},
            ensure_ascii=False)
        conf = "mid" if r["monotonic"] else "low"

        # 이미 v1 원문(raw_text)이 들어 있는 대학이면 **덮어쓰지 않고 표만 채운다.**
        # 원문과 표는 서로를 대체하지 않는다 — 원문은 사람이 검증할 때 쓴다.
        exist = con.execute(
            "SELECT conversion_id FROM ged_conversion "
            "WHERE univ_id=? AND year=? AND admission_id IS NULL",
            (r["univId"], year)).fetchone()
        if exist:
            con.execute(
                """UPDATE ged_conversion
                   SET table_json=?, table_type=?, max_score=?, min_score=?,
                       source_id=?, page=?, confidence=?
                   WHERE conversion_id=?""",
                (table_json, r["type"], r["maxScore"], r["minScore"],
                 sid, r.get("page"), conf, exist["conversion_id"]))
        else:
            con.execute(
                """INSERT INTO ged_conversion
                   (univ_id,year,admission_id,raw_text,raw_type,table_json,table_type,
                    max_score,min_score,source_id,page,confidence)
                   VALUES (?,?,NULL,NULL,'numeric_table',?,?,?,?,?,?,?)""",
                (r["univId"], year, table_json, r["type"],
                 r["maxScore"], r["minScore"], sid, r.get("page"), conf))
        n += 1
    con.execute(
        "INSERT INTO ingest_log (ran_at,script,target,rows_out,note) VALUES (?,?,?,?,?)",
        (date.today().isoformat(), "ingest_plans.py", f"{year} 시행계획", n,
         f"ged {len(ged_rows)} / conversion {len(conv_rows)}"))
    con.commit()
    return n


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--to-db", action="store_true")
    ap.add_argument("--limit", type=int, help="일부만 돌려보기")
    a = ap.parse_args()
    run(a.year, a.to_db, a.limit)
