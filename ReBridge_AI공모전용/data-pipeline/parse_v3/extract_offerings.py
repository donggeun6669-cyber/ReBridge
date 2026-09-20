"""모집인원표 → offerings.jsonl (Python 자동 추출).

    python3 extract_offerings.py [--univ id,id] [--doc doc:…] [--limit N] [--force] [--dry]

무엇을 하는가
  요강·시행계획 PDF 에서 '모집단위 × 전형' 모집인원표를 찾아, 표의 칸 하나하나를
  `AGENT_CONTRACT.md` 의 offerings.jsonl 형식으로 바꾼다. 결과는 `work/auto_out/<추출기ID>/<univId>/`
  에 쓰고, 정본 반영은 기존 `merge_agent.py` 하나로만 한다(병합 경로를 늘리지 않는다).

무엇을 하지 않는가
  - 표를 못 읽거나 구조가 확실하지 않으면 **값을 만들지 않는다.** 예외 큐(`work/auto_out/_exceptions.jsonl`)에
    문서·쪽·실패 사유를 남기고 넘어간다. 사람이나 에이전트가 그 쪽만 보면 된다.
  - 합계·소계 행/열은 모집단위 행으로 만들지 않는다. 대신 **검산용**으로 따로 모아, 추출한 값의 합과 비교한다.
  - 빈칸은 버리고, '-' 는 인원 미상으로 남긴다. '0' 은 '뽑지 않음'이라는 뜻이므로 그대로 기록한다.

왜 이렇게 하는가
  2026-09-20 시점에 요강 쪽 자료는 전 대학의 6% 뿐이었고, 전부 에이전트가 한 줄씩 읽어 만든 것이었다.
  모집인원표는 기계가 읽을 수 있는 가장 규칙적인 표이므로 여기부터 Python 으로 돌린다.
"""

import argparse
import json
import re
import warnings
from collections import Counter

warnings.filterwarnings("ignore")

from common import WORK, PARSER_VERSION, RAW, connect, log, text_db
import parse_results as PR

EXTRACTOR = "extract_offerings " + PARSER_VERSION
AGENT_ID = "PY-OFF"                      # merge_agent 에 넘길 때 쓰는 이름
OUT_DIR = WORK / "auto_out" / AGENT_ID
EXC_PATH = WORK / "auto_out" / "_exceptions.jsonl"

# ── 표를 알아보는 말들 ─────────────────────────────────────────────
PROGRAM_HDR = re.compile(r"모집\s*단위|학과|학부|전공|계열|모집\s*학과")
SEATS_HDR = re.compile(r"모집\s*인원|인원|정원|명$|선발\s*인원")
TOTAL_WORD = re.compile(r"^\s*(합\s*계|소\s*계|총\s*계|계|총\s*합|전\s*체)\s*$")
QUOTA_IN = re.compile(r"정원\s*내")
QUOTA_OUT = re.compile(r"정원\s*외")
PHASE_SU = re.compile(r"수시")
PHASE_JEONG = re.compile(r"정시")
ROUND_PAT = re.compile(r"([12])\s*차")
GROUP_PAT = re.compile(r"([가나다])\s*군")
# 모집단위가 아닌 행 이름(구분 열에 흔히 오는 말)
NOT_PROGRAM_ROW = re.compile(r"^\s*(구\s*분|계열|모집\s*시기|학\s*제|주\s*야|비\s*고|번\s*호|연\s*번|순\s*번)\s*$")
# 전형 이름으로 보기 어려운 열 제목
# 전형 이름이 아니라 '인원' 자체를 뜻하는 열 제목(학과 총정원 포함). 이런 열은 전형으로 만들지 않는다.
ONLY_SEATS = re.compile(r"^\s*((입학|모집|총|전체)\s*)?(모집\s*인원|선발\s*인원|인\s*원|정\s*원|모집|계)\s*(\(\s*명\s*\)|명)?\s*$")
NOT_ADMISSION = re.compile(r"^\s*(모집\s*단위|학과|학부|전공|구\s*분|계\s*열|비\s*고|번\s*호|연\s*번|합\s*계|소\s*계|계)\s*$")


def norm(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def is_int_cell(s):
    s = (s or "").strip()
    return bool(re.fullmatch(r"\d{1,4}", s.replace(",", "")))


def looks_program(s):
    s = norm(s)
    if not s or NOT_PROGRAM_ROW.match(s) or TOTAL_WORD.match(s):
        return False
    if is_int_cell(s):
        return False
    return len(s) >= 2


def score_table(grid):
    """이 표가 '모집단위 × 전형 모집인원표' 인가. 0~100."""
    if len(grid) < 3:
        return 0, "행이 3개 미만"
    ncol = max(len(r) for r in grid)
    if ncol < 3:
        return 0, "열이 3개 미만"
    nh, headers = PR.split_headers(grid)
    body = grid[nh:]
    if not body:
        return 0, "머리글만 있고 자료 행이 없음"
    head_txt = " ".join(h or "" for h in headers)
    s = 0
    if PROGRAM_HDR.search(head_txt):
        s += 35
    if SEATS_HDR.search(head_txt):
        s += 20
    # 숫자 칸 비율
    cells = [PR.cell_str(c) for r in body for c in r]
    ints = sum(1 for c in cells if is_int_cell(c))
    if cells and ints / len(cells) >= 0.25:
        s += 25
    elif cells and ints / len(cells) >= 0.12:
        s += 12
    # 모집단위처럼 생긴 행 이름이 여러 개
    first_texts = [PR.cell_str(r[0]) if r else "" for r in body]
    progs = sum(1 for t in first_texts if looks_program(t))
    if progs >= 3:
        s += 20
    elif progs >= 1:
        s += 8
    return s, f"머리글={head_txt[:60]!r} 숫자비율={ints}/{len(cells)} 모집단위행={progs}"


def pick_program_col(headers, body):
    """모집단위 이름이 들어 있는 열 번호. 못 찾으면 None.

    핵심은 **값이 서로 다른 정도**다. '계열'(인문/자연) 열은 같은 값이 반복되지만
    학과 열은 값이 거의 다 다르다. 이걸 안 보면 서울과기대처럼 '자연'이 학과명으로 들어간다.
    """
    ncol = len(headers)
    best, best_score = None, 0
    for j in range(ncol):
        vals = [norm(PR.cell_str(r[j])) if j < len(r) else "" for r in body]
        nonempty = [v for v in vals if v]
        if len(nonempty) < 2:
            continue
        prog = sum(1 for v in nonempty if looks_program(v))
        if prog / len(nonempty) < 0.6:
            continue
        distinct = len({v for v in nonempty if looks_program(v)})
        uniq = distinct / max(prog, 1)
        if uniq < 0.5:                      # 같은 값이 절반 넘게 반복되면 학과 열이 아니다
            continue
        sc = prog * uniq + (25 if PROGRAM_HDR.search(headers[j] or "") else 0) - j
        if sc > best_score:
            best, best_score = j, sc
    return best


def admission_of(header_path):
    """열 제목에서 전형 이름·정원구분을 뽑는다. 원문 표기를 그대로 쓴다."""
    parts = [p.strip() for p in (header_path or "").split(" > ") if p and p.strip()]
    quota = None
    keep = []
    for p in parts:
        if QUOTA_OUT.search(p):
            quota = "정원외"
        elif QUOTA_IN.search(p):
            quota = "정원내"
        if NOT_ADMISSION.match(p) or SEATS_HDR.fullmatch(p.strip()):
            continue
        keep.append(p)
    # '모집인원', '모집인원(명)', '인원' 처럼 인원 자체를 뜻하는 토막은 앞뒤 어디에 있든 전형 이름이 아니다
    keep = [k for k in keep if not ONLY_SEATS.match(k)]
    name = " ".join(keep).strip() or None
    return name, quota


def page_ctx(text, doc_scope):
    """쪽 글자에서 수시/정시·차수·군을 읽는다. 없으면 문서 단위 값을 쓴다."""
    phase = doc_scope
    if PHASE_JEONG.search(text or "") and not PHASE_SU.search(text or ""):
        phase = "정시"
    elif PHASE_SU.search(text or "") and not PHASE_JEONG.search(text or ""):
        phase = "수시"
    m = ROUND_PAT.search(text or "")
    rnd = (f"{'수시' if phase == '수시' else '정시'}{m.group(1)}차") if m and phase else None
    g = GROUP_PAT.search(text or "")
    grp = f"{g.group(1)}군" if g and phase == "정시" else None
    return phase, rnd, grp


def row_text(page, table, ri):
    """그 행의 실제 원문 한 줄(근거용). 표 좌표로 잘라 읽는다."""
    try:
        r = table.rows[ri]
        x0, top, x1, bottom = r.bbox
        t = page.crop((max(x0 - 1, 0), max(top - 1, 0), min(x1 + 1, page.width), min(bottom + 1, page.height))).extract_text()
        return norm(t)[:400] or None
    except Exception:  # noqa: BLE001
        return None


def extract_doc(pdf, did, uid, years, doc_scope, doc_status, tdb, exc, fallback_year=None):
    """한 문서에서 모집전형 레코드 목록과 검산 정보를 만든다."""
    out, checks, st_skip = [], [], []
    pages = {pi: t for pi, t in tdb.execute("SELECT page_index, text FROM page_text WHERE document_id=?", (did,))}
    cand = [pi for pi, t in pages.items() if t and PROGRAM_HDR.search(t) and SEATS_HDR.search(t)]
    for pi in sorted(cand):
        if pi >= len(pdf.pages):
            continue
        page = pdf.pages[pi]
        try:
            tables = page.find_tables()
        except Exception as e:  # noqa: BLE001
            exc.append({"document_id": did, "university_id": uid, "page_index": pi,
                        "failure": "표 찾기 실패", "detail": str(e)[:200], "extractor": EXTRACTOR})
            continue
        if not tables:
            exc.append({"document_id": did, "university_id": uid, "page_index": pi,
                        "failure": "표를 못 찾음(선 없는 표일 수 있음)", "extractor": EXTRACTOR})
            continue
        ptext = pages.get(pi, "")
        phase, rnd, grp = page_ctx(ptext[:1200], doc_scope)
        year = (PR.year_for(years, PR.detect_years(ptext)) if years else None) or fallback_year
        for ti, table in enumerate(tables):
            grid = table.extract()
            if not grid:
                continue
            sc, why = score_table(grid)
            if sc < 60:
                continue
            nh, headers = PR.split_headers(grid)
            body = grid[nh:]
            pcol = pick_program_col(headers, body)
            if pcol is None:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "모집단위 열을 못 찾음", "detail": why, "extractor": EXTRACTOR})
                continue
            # 전형 열·합계 열 나누기
            adm_cols, tot_cols = {}, []
            for j in range(len(headers)):
                if j == pcol:
                    continue
                hp = headers[j]
                last = (hp or "").split(" > ")[-1]
                if TOTAL_WORD.search(last) or any(TOTAL_WORD.match(x.strip()) for x in (hp or "").split(" > ")):
                    tot_cols.append(j)
                    continue
                name, quota = admission_of(hp)
                if name and not re.fullmatch(r"[\d\s,.·\-—()]+", name):
                    adm_cols[j] = (name, quota)
            if not adm_cols:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "전형 열을 못 찾음", "detail": why, "extractor": EXTRACTOR})
                continue

            # ── 검산: 행마다 '각 전형 인원의 합 == 그 행의 계' 인지 본다 ──
            rows_ok, rows_bad, no_total = 0, 0, 0
            cand_rows = []
            for ri, r in enumerate(body):
                prog = norm(PR.cell_str(r[pcol]) if pcol < len(r) else "")
                if not prog or NOT_PROGRAM_ROW.match(prog):
                    continue
                # 합계 행의 '합계'가 학과 열이 아니라 다른 열(구분 열 등)에 있을 수 있다
                is_total_row = bool(TOTAL_WORD.match(prog)) or any(
                    TOTAL_WORD.match(norm(PR.cell_str(c))) for c in r[:max(pcol, 1) + 1])
                cells = {}
                for j in adm_cols:
                    v = norm(PR.cell_str(r[j]) if j < len(r) else "")
                    if v:
                        cells[j] = v
                nums = [int(v.replace(",", "")) for v in cells.values() if is_int_cell(v)]
                tot = None
                for j in tot_cols:
                    v = norm(PR.cell_str(r[j]) if j < len(r) else "")
                    if is_int_cell(v):
                        tot = int(v.replace(",", ""))
                        break
                if tot is None:
                    no_total += 1
                elif nums and sum(nums) == tot:
                    rows_ok += 1
                elif nums:
                    rows_bad += 1
                cand_rows.append((ri, r, prog, is_total_row, cells))

            # ── 검산 2: '계' 열이 없으면 맨 아래 **합계 행**으로 세로 검산한다 ──
            if rows_ok + rows_bad < 2:
                tot_row = next((c for c in cand_rows if c[3]), None)      # is_total_row
                if tot_row:
                    col_ok = col_bad = 0
                    for j in adm_cols:
                        tv = norm(PR.cell_str(tot_row[1][j]) if j < len(tot_row[1]) else "")
                        if not is_int_cell(tv):
                            continue
                        colsum = 0
                        for ri2, r2, prog2, istot2, cells2 in cand_rows:
                            if istot2:
                                continue
                            v2 = cells2.get(j, "")
                            if is_int_cell(v2):
                                colsum += int(v2.replace(",", ""))
                        if colsum == int(tv.replace(",", "")):
                            col_ok += 1
                        else:
                            col_bad += 1
                    if col_ok + col_bad >= 2:
                        rows_ok, rows_bad = col_ok, col_bad
                        why = f"세로(합계 행) 검산 {col_ok}/{col_ok + col_bad}. " + why

            checked = rows_ok + rows_bad
            if checked < 2:
                # 검산할 '계' 열이 없다 → 표가 제대로 읽혔는지 기계가 확인할 방법이 없다.
                # 값을 만들지 않고 예외 큐로 보낸다(사람·에이전트가 그 쪽만 보면 된다).
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "검산할 합계 열이 없어 기계 추출로 확정할 수 없음",
                            "detail": f"전형 열 {len(adm_cols)}개, 자료 행 {len(cand_rows)}개. {why}",
                            "extractor": EXTRACTOR})
                st_skip.append(len(cand_rows) * max(len(adm_cols), 1))
                continue
            if rows_ok / checked < 0.8:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "행 합계가 맞지 않음 — 표가 어긋났을 수 있어 값을 만들지 않음",
                            "detail": f"검산 {rows_ok}/{checked} 일치. {why}", "extractor": EXTRACTOR})
                continue
            verified = True

            made = 0
            for ri, r, prog, is_total_row, cells in cand_rows:
                raw = row_text(page, table, ri + nh)
                for j, v in cells.items():
                    if not (is_int_cell(v) or v in ("-", "－", "‑")):
                        continue
                    name, quota = adm_cols[j]
                    seats = int(v.replace(",", "")) if is_int_cell(v) else None
                    if is_total_row:
                        checks.append({"page_index": pi, "table": ti, "admission": name,
                                       "quota_type": quota, "seats": seats, "label": prog})
                        continue
                    out.append({
                        "key": f"auto_p{pi}_t{ti}_r{ri}_c{j}",
                        "academic_year": year,
                        # 행 합계로 검산된 표만 confirmed. 검산할 합계가 없으면 pending(사람이 확인해야 한다).
                        "value_status": ("confirmed" if (verified and seats is not None) else "pending"),
                        "note": (f"[기계 추출 {EXTRACTOR}] "
                                 + (f"행 합계 검산 {rows_ok}/{checked} 일치" if checked >= 2
                                    else "검산할 합계 열이 없어 사람 확인 필요")),
                        "phase": phase, "round": rnd, "admission_group": grp,
                        "admission_name_raw": name, "quota_type": quota,
                        "program_name_raw": prog,
                        "seats_planned": seats, "seats_raw": v,
                        "document_status": doc_status,
                        "evidence": [{"document_id": did, "page_index": pi,
                                      "fields": ["seats_planned", "program_name_raw", "admission_name_raw"],
                                      "header_path": headers[j] if j < len(headers) else None,
                                      "row_label": prog, "raw_text": raw or f"{prog} {v}"}],
                    })
                    made += 1
            if made == 0:
                exc.append({"document_id": did, "university_id": uid, "page_index": pi, "table": ti,
                            "failure": "표는 찾았으나 값 행을 못 만듦", "detail": why, "extractor": EXTRACTOR})
    return out, checks, st_skip


def reconcile(rows, checks):
    """인쇄된 합계와 추출한 값의 합을 비교한다. 맞지 않으면 그대로 보고한다(값을 고치지 않는다)."""
    got = Counter()
    for r in rows:
        if r["seats_planned"] is not None:
            got[(r["evidence"][0]["page_index"], r["admission_name_raw"], r["quota_type"])] += r["seats_planned"]
    res = []
    for c in checks:
        if c["seats"] is None:
            continue
        k = (c["page_index"], c["admission"], c["quota_type"])
        res.append({"쪽": c["page_index"], "전형": c["admission"], "정원구분": c["quota_type"],
                    "인쇄된합계": c["seats"], "추출합": got.get(k, 0), "일치": got.get(k, 0) == c["seats"]})
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--univ"); ap.add_argument("--doc")
    ap.add_argument("--limit", type=int); ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry", action="store_true", help="파일을 쓰지 않고 결과 수만 본다")
    a = ap.parse_args()
    import pdfplumber
    con, tdb = connect(), text_db()
    q = """SELECT DISTINCT f.document_id, f.university_id, f.raw_path, d.document_type, d.admission_scope,
                  d.academic_years_detected, d.academic_years_claimed
           FROM document_file f JOIN document d USING(document_id) JOIN university_campus u ON u.university_id=f.university_id
           WHERE d.document_type IN ('모집요강','시행계획') AND u.in_target=1 AND f.is_original_format_archive=0
             AND lower(f.raw_path) LIKE '%.pdf'"""
    docs = list(con.execute(q))
    if a.univ:
        keep = set(a.univ.split(","))
        docs = [d for d in docs if d["university_id"] in keep]
    if a.doc:
        docs = [d for d in docs if d["document_id"] == a.doc]
    if a.limit:
        docs = docs[:a.limit]

    st = Counter()
    exc = []
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fresh = set()        # 이번 실행에서 처음 쓰는 대학 → 이전 결과를 비우고 새로 쓴다(다시 돌려도 중복되지 않게)
    for d in docs:
        did, uid = d["document_id"], d["university_id"]
        if not a.force and con.execute(
                "SELECT 1 FROM processing_log WHERE document_id=? AND stage='auto_offerings' AND parser_version=?",
                (did, PARSER_VERSION)).fetchone():
            st["건너뜀(이미 처리)"] += 1
            continue
        path = RAW / d["raw_path"]
        if not path.exists():
            exc.append({"document_id": did, "university_id": uid, "failure": "파일 없음", "extractor": EXTRACTOR})
            st["파일 없음"] += 1
            continue
        years = json.loads(d["academic_years_detected"] or "[]") or json.loads(d["academic_years_claimed"] or "[]")
        scope = {"수시": "수시", "정시": "정시"}.get(d["admission_scope"])
        status = "시행계획" if d["document_type"] == "시행계획" else "확정요강"
        # RAW 는 '2027/대학이름/…' 처럼 학년도 폴더로 나뉘어 있다. 본문에서 연도를 못 읽으면 이것을 쓴다.
        mfy = re.match(r"(20\d\d)/", d["raw_path"] or "")
        fallback = (int(years[0]) if len(years) == 1 else None) or (int(mfy.group(1)) if mfy else None)
        try:
            with pdfplumber.open(path) as pdf:
                rows, checks, skipped = extract_doc(pdf, did, uid, years, scope, status, tdb, exc, fallback)
        except Exception as e:  # noqa: BLE001
            exc.append({"document_id": did, "university_id": uid, "failure": "PDF 열기 실패",
                        "detail": str(e)[:200], "extractor": EXTRACTOR})
            st["열기 실패"] += 1
            continue
        rec = reconcile(rows, checks)
        st["문서"] += 1
        st["레코드"] += len(rows)
        st["검산불가로 버린 칸"] += sum(skipped)
        st["합계대조 일치"] += sum(1 for x in rec if x["일치"])
        st["합계대조 불일치"] += sum(1 for x in rec if not x["일치"])
        if rows and not a.dry:
            ud = OUT_DIR / uid
            ud.mkdir(parents=True, exist_ok=True)
            if uid not in fresh:
                (ud / "offerings.jsonl").unlink(missing_ok=True)
                fresh.add(uid)
            with (ud / "offerings.jsonl").open("a", encoding="utf-8") as f:
                for r in rows:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            (ud / "_reconcile.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
        if not a.dry:
            log(con, did, "auto_offerings", "done" if rows else "partial",
                f"{uid}: 모집전형 {len(rows)}건, 합계대조 {sum(1 for x in rec if x['일치'])}/{len(rec)}")
            con.commit()
    if not a.dry:
        EXC_PATH.parent.mkdir(parents=True, exist_ok=True)
        with EXC_PATH.open("a", encoding="utf-8") as f:
            for e in exc:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
    st["예외"] = len(exc)
    print(dict(st))
    if exc:
        c = Counter(e["failure"] for e in exc)
        print("예외 사유:", c.most_common())


if __name__ == "__main__":
    main()
