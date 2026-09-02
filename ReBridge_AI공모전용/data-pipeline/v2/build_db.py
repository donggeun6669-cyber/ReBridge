"""기존 자산을 L1 작업대(SQLite)에 적재한다.

넣는 것 (v1에서 살릴 수 있는 전부):
  universities.json          351개 대학          → university
  results_2025_clean.json    14,274행 (학과·출처 100%) → program + cutline
  admissions.json            1,007행             → admission + ged_eligibility
  comparative_2028.json      188대학             → ged_conversion

핵심: 원천에는 학과와 출처가 다 있는데 앱용 JSON을 만들면서 버려졌다.
      여기서는 버리지 않는다.

실행:  python3 v2/build_db.py --rebuild
"""

import argparse
import json
import re
from datetime import date

import common as C


# ── source_file 등록 ────────────────────────────────────────────────
class Sources:
    """파일명 → source_id. 같은 파일은 한 번만 등록한다."""

    def __init__(self, con):
        self.con = con
        self.cache = {}

    def get(self, *, kind, title, year=None, path=None, publisher=None,
            source_url=None, note=None):
        key = (kind, C.nfc(title))
        if key in self.cache:
            return self.cache[key]
        sha = None
        if path and path.exists():
            sha = C.sha256(path)
        else:
            path = None
        cur = self.con.execute(
            "SELECT source_id FROM source_file WHERE kind=? AND title=?",
            (kind, C.nfc(title)))
        row = cur.fetchone()
        if row:
            sid = row["source_id"]
        else:
            sid = self.con.execute(
                """INSERT INTO source_file
                   (kind, year, title, path, sha256, source_url, publisher, retrieved_at, note)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (kind, year, C.nfc(title), str(path) if path else None, sha,
                 source_url, publisher, date.today().isoformat(), note)).lastrowid
        self.cache[key] = sid
        return sid


# ── 대학 ────────────────────────────────────────────────────────────
def load_universities(con):
    us = C.load_universities()
    for u in us:
        con.execute(
            """INSERT OR REPLACE INTO university
               (univ_id,name,region,establishment,kind,office_url,lat,lng)
               VALUES (?,?,?,?,?,?,?,?)""",
            (u["univId"], C.nfc(u["name"]), u.get("region"), u.get("establishment"),
             u.get("kind"), u.get("admissionOfficeUrl") or None,
             u.get("lat"), u.get("lng")))
    return len(us)


# ── 모집단위 ────────────────────────────────────────────────────────
class Programs:
    def __init__(self, con):
        self.con = con
        self.cache = {}
        for r in con.execute("SELECT program_id, univ_id, name_key FROM program"):
            self.cache[(r["univ_id"], r["name_key"])] = r["program_id"]

    def get(self, univ_id, name):
        name = C.squash(name)
        if not name:
            return None
        k = C.key_name(name)
        if not k:
            return None
        hit = self.cache.get((univ_id, k))
        if hit:
            return hit
        pid = self.con.execute(
            "INSERT INTO program (univ_id,name,name_key) VALUES (?,?,?)",
            (univ_id, name, k)).lastrowid
        self.cache[(univ_id, k)] = pid
        return pid


# ── 입시결과(합격선) ────────────────────────────────────────────────
def load_results(con, src, progs, matcher):
    """results_2025_clean.json → cutline. 학과와 출처를 그대로 살린다."""
    path = C.PIPELINE / "results_2025_clean.json"
    rows = C.jload(path)

    known = {r["univ_id"] for r in con.execute("SELECT univ_id FROM university")}
    n_in = len(rows)
    n_out = 0
    skipped_univ = 0

    for r in rows:
        uid = r.get("univId")
        if uid not in known:
            uid = matcher.match(r.get("univName"))
        if not uid:
            skipped_univ += 1
            continue

        year = r.get("year") or 2025
        fname = C.nfc(r.get("sourceFile") or "알 수 없음")
        pdf = C.PDF_ROOT / "2025" / fname
        sid = src.get(kind="result", title=fname, year=year,
                      path=pdf if pdf.exists() else None,
                      publisher="한국대학교육협의회(대입정보포털)")

        pid = progs.get(uid, r.get("unit"))
        con.execute(
            """INSERT INTO cutline
               (univ_id,program_id,year,grade_scale,phase,admission_type,admission_name,
                cut_type,cut_grade,cut_score,recruit_count,competition,
                source_id,page,confidence,note)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (uid, pid, year, C.grade_scale(year),
             C.norm_phase(r.get("phase")),
             C.norm_admission_type(r.get("admissionType")) or C.squash(r.get("admissionType")) or None,
             C.squash(r.get("admissionName")) or None,
             C.squash(r.get("cutType")) or "미상",
             r.get("cutGrade"), r.get("cutScore"),
             r.get("recruitCount"), r.get("competition"),
             sid, r.get("sourcePage"), r.get("confidence") or "mid",
             C.squash(r.get("note")) or None))
        n_out += 1

    return n_in, n_out, skipped_univ


# ── 전형 + 검정고시 지원가부 ────────────────────────────────────────
_SRC_PDF = re.compile(r"\(([^()]*\.pdf)\)\s*$")
_SRC_PAGE = re.compile(r"\bp\.?\s*(\d+)")


def _parse_admission_source(s):
    """'중앙대학교 2028 시행계획 p.6 (중앙대…_2028_시행계획(1차수).pdf)'
       → ('중앙대…_2028_시행계획(1차수).pdf', 6)"""
    s = C.nfc(s or "")
    m = _SRC_PDF.search(s)
    fname = m.group(1) if m else None
    mp = _SRC_PAGE.search(s)
    return fname, (int(mp.group(1)) if mp else None)


def load_admissions(con, src, matcher):
    rows = C.jload(C.APP_DATA / "admissions.json")
    doctrine = src.get(
        kind="doctrine", year=2028,
        title="2028학년도 대학입학전형 기본사항(KCUE)",
        publisher="한국대학교육협의회",
        note="대학별 실데이터가 아니라 전체에 적용되는 원칙. status=baseline 행의 근거.")

    n_out = n_ged = 0
    for r in rows:
        uid = r["univId"]
        status = r.get("status") or "confirmed"
        fname, page = _parse_admission_source(r.get("source"))
        if fname:
            pdf = C.PDF_ROOT / "2028" / fname
            sid = src.get(kind="plan", title=fname, year=2028,
                          path=pdf if pdf.exists() else None,
                          publisher="개별 대학 입학처")
            conf = "high"
        else:
            sid, page, conf = doctrine, None, "low"

        name = C.squash(r.get("admissionName"))
        try:
            aid = con.execute(
                """INSERT INTO admission
                   (univ_id,year,phase,type,name,name_key,source_id,page,confidence,status)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (uid, 2028, C.norm_phase(r.get("phase")),
                 C.norm_admission_type(r.get("admissionType")) or C.squash(r.get("admissionType")),
                 name, C.key_name(name), sid, page, conf,
                 "baseline" if status == "baseline" else "confirmed")).lastrowid
        except Exception:
            continue        # 같은 (대학,연도,차수,유형,전형명) 중복 → 첫 행만
        n_out += 1

        if r.get("gedEligible"):
            con.execute(
                """INSERT INTO ged_eligibility
                   (admission_id,eligible,reason,reflection,source_id,page,confidence)
                   VALUES (?,?,?,?,?,?,?)""",
                (aid, C.squash(r["gedEligible"]),
                 C.squash(r.get("gedIneligibleReason")) or None,
                 C.squash(r.get("gedReflection")) or None,
                 sid, page, conf))
            n_ged += 1

    return len(rows), n_out, n_ged


# ── 비교내신 ────────────────────────────────────────────────────────
def load_comparative(con, src):
    data = C.jload(C.APP_DATA / "comparative_2028.json")
    n_raw = n_table = 0
    for uid, v in data.items():
        fname, page = _parse_admission_source(v.get("source"))
        if not fname:
            m = re.search(r"([^\s(]+\.pdf)", C.nfc(v.get("source") or ""))
            fname = m.group(1) if m else None
        if fname:
            pdf = C.PDF_ROOT / "2028" / fname
            sid = src.get(kind="plan", title=fname, year=2028,
                          path=pdf if pdf.exists() else None,
                          publisher="개별 대학 입학처")
        else:
            sid = src.get(kind="plan", year=2028,
                          title=C.squash(v.get("source")) or "출처 미상(2028 시행계획)",
                          publisher="개별 대학 입학처",
                          note="원문 source 문자열에서 파일명을 못 뽑음. 재확인 필요")
        conv = v.get("conversion")
        con.execute(
            """INSERT OR REPLACE INTO ged_conversion
               (univ_id,year,admission_id,raw_text,raw_type,table_json,table_type,
                max_score,min_score,source_id,page,confidence)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (uid, 2028, None,
             v.get("comparativeGrade"), v.get("comparativeGradeType"),
             json.dumps(conv, ensure_ascii=False) if conv else None,
             (conv or {}).get("type"),
             (conv or {}).get("maxScore"), (conv or {}).get("minScore"),
             sid, page, "high" if conv else "low"))
        n_raw += 1
        if conv:
            n_table += 1
    return n_raw, n_table


# ── main ────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rebuild", action="store_true", help="DB를 지우고 처음부터")
    args = ap.parse_args()

    con = C.init_db(drop=args.rebuild)
    src = Sources(con)
    matcher = C.UnivMatcher()

    print("═" * 62)
    n = load_universities(con)
    print(f"university        {n:>7}개")

    progs = Programs(con)
    a, b, skip = load_results(con, src, progs, matcher)
    npg = con.execute("SELECT COUNT(*) c FROM program").fetchone()["c"]
    print(f"cutline           {b:>7}행  (원천 {a}, 대학매칭 실패 {skip})")
    print(f"program(학과)     {npg:>7}개  ← v1에 없던 축")

    a, b, g = load_admissions(con, src, matcher)
    print(f"admission         {b:>7}행  (원천 {a})")
    print(f"ged_eligibility   {g:>7}행")

    a, b = load_comparative(con, src)
    print(f"ged_conversion    {a:>7}행  (계산 가능한 표 {b}개)")

    nsrc = con.execute("SELECT COUNT(*) c FROM source_file").fetchone()["c"]
    print(f"source_file       {nsrc:>7}건")

    con.execute(
        "INSERT INTO ingest_log (ran_at,script,target,rows_in,rows_out,note) VALUES (?,?,?,?,?,?)",
        (date.today().isoformat(), "build_db.py", "v1 자산 전체", None, None,
         "universities/results_2025_clean/admissions/comparative_2028"))
    con.commit()

    if matcher.unmatched:
        print("\n대학명 매칭 실패 상위:")
        for nm, c in matcher.unmatched.most_common(10):
            print(f"   {c:>5}  {nm}")

    print("═" * 62)
    print(f"DB: {C.DB_PATH}")


if __name__ == "__main__":
    main()
