"""에이전트 출력(work/agent_out/<ID>/<univId>/*.jsonl) → 검증 → 정본 DB 병합.

    python3 merge_agent.py <AGENT_ID> [--univ id,id] [--model Sonnet]

검증
  1. 근거 원문 대조: evidence.raw_text 가 그 문서·쪽의 텍스트층 또는 OCR 에 실제로 있는지(공백 무시).
     전부 있으면 text_match, 80% 이상 조각이 있으면 text_match_partial, 이미지 판독만이면 render_only.
     근거가 하나도 확인되지 않으면 레코드는 review_status=held, value_status=pending.
  2. 형식: 열거값(ged_acceptance·input_score_kind·calc_approval·value_status…)·숫자.
  3. 환산규칙: 적용범위 미확인·입력 점수 종류 불명·구간 겹침/역전이면 calc_approval 을 approved 로 두지 않는다.
  4. 같은 에이전트·대학을 다시 병합하면 이전 병합 행을 지우고 다시 넣는다(중복 없음).
에이전트가 추출한 값은 review_status=agent_extracted. 메인이 원문을 직접 본 레코드만 trial_check.py 에서 main_crosschecked 로 올린다.
"""

import argparse
import json
import re
from collections import Counter

from common import AGENT_DIR, PARSER_VERSION, connect, text_db, h, jdump, now

ENUM = {
    "value_status": {"confirmed", "not_published", "not_applicable", "not_found", "unreadable", "conflict", "pending"},
    "ged_acceptance": {"가능", "불가", "조건부", "미확인"},
    "input_score_kind": {"ged_subject", "ged_average", "school_record", "practical", "essay", "csat", "unknown"},
    "calc_approval": {"approved", "blocked", "pending"},
    "scope_status": {"confirmed", "partial", "pending"},
    "minimum_exists": {"yes", "no", "unknown"},
}
TABLES = ["offerings", "eligibility", "evaluation", "conversion", "csat_minimum", "schedule", "documents"]

# 파일 종류별로 **읽는 이름**. 여기 없는 이름이 들어오면 그 레코드는 병합하지 않고 문제로 보고한다.
# (예전에는 모르는 이름을 조용히 무시해서, 전형명이 빈 채로 여러 행이 서로 덮어써진 적이 있다 — 2026-09-20 광운대·광신대·공주교대)
_COMMON = {"key", "academic_year", "value_status", "note", "evidence"}
FIELDS = {
    "offerings": _COMMON | {"phase", "round", "admission_group", "campus_name", "admission_name_raw", "admission_type",
                            "quota_type", "special_category", "program_name_raw", "college_name", "major_group",
                            "seats_planned", "seats_raw", "seat_group", "document_status", "raw_text"},
    "eligibility": _COMMON | {"scope_level", "admission_name_raw", "program_name_raw", "ged_acceptance",
                              "ged_acceptance_basis", "educational_equivalence", "raw_requirement", "conditions", "raw_text"},
    "evaluation": _COMMON | {"admission_name_raw", "program_scope", "stage_order", "selection_multiplier", "component",
                             "assessment_mode", "nominal_weight", "nominal_weight_num", "max_points", "base_points",
                             "prior_stage_carryover", "applicant_group", "rubric_domains", "interview_format",
                             "tie_break_order", "raw_text"},
    "conversion": _COMMON | {"input_score_kind", "output_score_kind", "scope_phase", "scope_admissions", "scope_programs",
                             "scope_applicants", "scope_stage", "scope_status", "conversion_method", "included_subjects",
                             "excluded_subjects", "elective_policy", "exemption_policy", "retake_policy", "formula_raw",
                             "formula_structured", "operation_order", "rounding_stage", "rounding_mode", "decimal_places",
                             "grade_scale", "score_min", "score_max", "attendance_substitution", "nonacademic_substitution",
                             "calc_approval", "calc_block_reason", "items", "raw_text"},
    "csat_minimum": _COMMON | {"scope_admission", "scope_programs", "minimum_exists", "test_participation_required",
                               "required_domains", "candidate_domains", "domain_count", "grade_sum_limit", "per_domain_limit",
                               "inquiry_as_one_domain", "averaging_rule", "mandatory_math_choice", "inquiry_category",
                               "english_condition", "history_condition", "logical_expression", "exceptions", "raw_text",
                               "calc_approval", "calc_block_reason"},
    "schedule": _COMMON | {"scope", "event_type", "start_at", "end_at", "date_precision", "confirmed_or_expected",
                           "deadline_basis", "raw_text"},
    "documents": _COMMON | {"scope", "applicant_condition", "document_name_raw", "required_or_optional", "issuing_authority",
                            "submission_channel", "online_provision_range", "substitute_form", "max_pages", "max_activities",
                            "max_characters", "activity_period_rule", "prohibited_content", "due_text", "raw_text"},
}

# 이름이 다른 인계 출력물을 규약 이름으로 옮긴다. **뜻이 같다고 확인한 것만** 적는다(추측 금지).
# 출처: Antigravity A1 묶음(광운대 kw·광신대 uA0000073·공주교대 uA0000251) offerings.jsonl, 2026-09-20 확인.
ALIAS = {
    "offerings": {"admission_phase": "phase", "admission_name": "admission_name_raw", "general_type": "admission_type",
                  "department_name": "program_name_raw", "major_name": "major_group",
                  "quota_confirmed": "seats_planned", "quota_raw": "seats_raw", "shared_quota": "seat_group"},
    "eligibility": {"qualification_details": "raw_requirement"},
    "schedule": {"admission_phase": "scope", "start_date": "start_at", "end_date": "end_at"},
    "csat_minimum": {"admission_name_raw": "scope_admission", "program_scope": "scope_programs"},
    "documents": {"required_document_name": "document_name_raw", "submission_method": "submission_channel",
                  "is_mandatory": "required_or_optional", "applicant_group": "applicant_condition"},
}

# 규약에 자리가 없는 이름. **버리지 않고** extension_fact 에 원문과 함께 남긴다(값이 비어 있으면 그냥 넘어간다).
EXTRA = {
    "eligibility": {"min_score", "max_score", "grade_limit", "passing_cutoff_date", "prohibited_conditions"},
    "schedule": {"event_target"},
    "documents": {"admission_phase", "admission_name_raw"},
    "offerings": set(), "evaluation": set(), "conversion": set(), "csat_minimum": set(),
}

# 레코드에 반드시 있어야 하는 이름. 없으면 병합하지 않는다.
# 모집전형은 '전형명 또는 모집단위' 중 하나는 있어야 한다(둘 다 없으면 무엇에 대한 행인지 알 수 없다).
# 전형명이 없는 행은 '이 모집단위는 이 시기에 선발하지 않음(0명)' 같은 경우가 있어 버리지 않는다.
REQUIRED = {"offerings": [], "eligibility": [], "evaluation": ["component"],
            "conversion": ["input_score_kind"], "csat_minimum": ["minimum_exists"], "schedule": ["event_type"],
            "documents": ["document_name_raw"]}

# 모집단위 칸에 이런 말이 적혀 있으면 학과가 아니라 '전형 전체' 행이다(schema: program_id NULL = 모집단위 미분리).
NOT_A_PROGRAM = {"대학전체", "전체", "전학과", "해당없음", "계", "합계", "소계", "총계", "-", ""}

# 파일 → 정본에서 세는 대표 테이블(넣은 행 수를 원본 줄 수와 맞춰 보기 위함)
MAIN_TABLE = {"offerings": "offering", "eligibility": "eligibility_rule", "evaluation": "evaluation_component",
              "conversion": "conversion_rule", "csat_minimum": "csat_minimum", "schedule": "schedule_event",
              "documents": "document_requirement"}


def normalize_record(tname, rec, uid, problems):
    """이름을 규약 이름으로 맞추고, 모르는 이름·빠진 필수 이름이 있으면 거부한다. 반환: (레코드 or None)"""
    out, renamed = {}, []
    for k, v in rec.items():
        nk = ALIAS.get(tname, {}).get(k, k)
        if nk != k:
            renamed.append(f"{k}→{nk}")
        if nk in out and out[nk] != v:
            problems.append((uid, tname, rec.get("key"), f"이름 변환 충돌: {k}→{nk} 가 이미 있다"))
            return None
        out[nk] = v
    extra = {k: out.pop(k) for k in list(out) if k in EXTRA[tname]}
    unknown = sorted(k for k in out if k not in FIELDS[tname])
    if unknown:
        problems.append((uid, tname, rec.get("key"), f"모르는 필드 {unknown} — 규약 이름이 아니라 병합하지 않음"))
        return None
    if tname == "offerings" and not out.get("admission_name_raw") and not out.get("program_name_raw"):
        problems.append((uid, tname, rec.get("key"), "전형명·모집단위가 둘 다 없음 — 무엇에 대한 행인지 알 수 없어 병합하지 않음"))
        return None
    missing = [k for k in REQUIRED[tname] if out.get(k) in (None, "")]
    if missing:
        problems.append((uid, tname, rec.get("key"), f"필수 필드 없음 {missing} — 병합하지 않음"))
        return None
    if renamed:
        out["note"] = ((out.get("note") or "") + f" [병합 시 이름 변환: {', '.join(renamed)}]").strip()
    # 제출서류의 적용 범위는 '수시/정시' 와 '전형명' 두 칸으로 나뉘어 온 적이 있다 → 기존 표기 방식대로 이어 붙인다.
    if tname == "documents" and not out.get("scope"):
        ph, an = extra.get("admission_phase"), extra.get("admission_name_raw")
        if ph or an:
            out["scope"] = " ".join(x for x in (ph, an) if x)
            out["note"] = ((out.get("note") or "") + f" [적용범위는 '{ph}' + '{an}' 을 이어 붙인 것]").strip()
    out["_extra"] = {k: v for k, v in extra.items() if v not in (None, "", [], {})}
    if tname == "offerings" and str(out.get("program_name_raw") or "").strip() in NOT_A_PROGRAM:
        if out.get("program_name_raw"):
            out["note"] = ((out.get("note") or "") + f" [모집단위 칸이 '{out['program_name_raw']}' 이라 전형 전체 행으로 봄]").strip()
        out["program_name_raw"] = None
    return out



# 원문 PDF 와 에이전트가 적은 글자가 '같은 글자의 다른 모양'인 경우(둥근따옴표↔곧은따옴표, 각종 붙임표·가운뎃점,
# 전각 괄호 등)는 같게 본다. 뜻이 달라지는 글자는 건드리지 않는다.
_SAME = str.maketrans({
    "\u2018": "'", "\u2019": "'", "\u201b": "'", "\u2032": "'", "\u00b4": "'", "\uff07": "'",
    "\u201c": '"', "\u201d": '"', "\u201f": '"', "\u2033": '"', "\uff02": '"',
    "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-", "\u2015": "-",
    "\u2212": "-", "\uff0d": "-", "\u30fc": "-",
    "\u00b7": "\u00b7", "\u2022": "\u00b7", "\u30fb": "\u00b7", "\uff65": "\u00b7", "\u2219": "\u00b7",
    "\uff08": "(", "\uff09": ")", "\uff0c": ",", "\uff1a": ":", "\uff1b": ";", "\uff5e": "~", "\u301c": "~",
})


def norm(s):
    return re.sub(r"\s+", "", (s or "").translate(_SAME))


class Verifier:
    def __init__(self):
        self.tdb = text_db()
        self.has_ocr = self.tdb.execute("SELECT name FROM sqlite_master WHERE name='page_ocr'").fetchone()
        self.cache = {}

    def page(self, did, pi):
        k = (did, pi)
        if k not in self.cache:
            t = self.tdb.execute("SELECT text FROM page_text WHERE document_id=? AND page_index=?", (did, pi)).fetchone()
            o = self.tdb.execute("SELECT text FROM page_ocr WHERE document_id=? AND page_index=?", (did, pi)).fetchone() if self.has_ocr else None
            self.cache[k] = norm((t[0] if t else "") + (o[0] if o else ""))
        return self.cache[k]

    def check(self, ev):
        did, pi, raw = ev.get("document_id"), ev.get("page_index"), ev.get("raw_text") or ""
        if ev.get("render_only"):
            return "render_only"
        if not did or pi is None or not raw.strip():
            return "missing"
        try:
            pi = int(pi)
        except (TypeError, ValueError):
            return "missing"
        page = self.page(did, pi)
        r = norm(raw)
        if not page:
            return "no_page_text"
        if r in page:
            return "text_match"
        # 긴 조항을 '…' 로 줄이거나 여러 줄을 모아 인용한 경우: 조각마다 원문에 있는지 + 원문과 같은 순서인지 본다.
        # 조각 하나라도 없거나 순서가 다르면 통과가 아니다(줄임표·줄바꿈이 검사를 무르게 만들지 않는다).
        parts = [norm(x) for x in re.split(r"\.{3}|…|[\r\n]+", raw)]
        parts = [x for x in parts if len(x) >= 6]
        if len(parts) >= 2 and sum(len(x) for x in parts) >= 20:
            at, ok = 0, True
            for x in parts:
                j = page.find(x, at)
                if j < 0:
                    ok = False
                    break
                at = j + len(x)
            if ok:
                return "text_match_elided"
        # 표의 여러 칸을 한 줄로 모아 적은 인용: 칸마다 같은 쪽에 그대로 있는지 본다.
        # 칸이 전부 원문에 있어도 '어느 행의 어느 칸인지'까지 확인된 것은 아니므로 따로 표시해 남긴다.
        toks = [norm(x) for x in re.split(r"[\s\r\n]+", raw)]
        toks = [x for x in toks if len(x) >= 4]
        if len(toks) >= 2 and sum(len(x) for x in toks) >= 12 and all(x in page for x in toks):
            return "text_match_cells"
        segs = [r[i:i + 12] for i in range(0, max(len(r) - 11, 1), 12)]
        found = sum(1 for s in segs if s in page)
        if segs and found / len(segs) >= 0.8:
            return "text_match_partial"
        # 이웃 쪽(0/1 기준 혼동) — 맞으면 쪽 번호가 틀린 것이라 따로 표시
        for d in (-1, 1):
            if r and r in self.page(did, pi + d):
                return f"text_match_offset{d:+d}"
        return "not_found"


def num(x):
    if x is None or x == "":
        return None
    if isinstance(x, (int, float)):
        return float(x)
    m = re.search(r"-?\d+(\.\d+)?", str(x).replace(",", ""))
    return float(m.group(0)) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("agent")
    ap.add_argument("--univ")
    ap.add_argument("--model", default="Sonnet")
    a = ap.parse_args()
    con = connect()
    con.execute("""CREATE TABLE IF NOT EXISTS merge_log (agent TEXT, university_id TEXT, record_table TEXT, record_id TEXT,
                   merged_at TEXT, PRIMARY KEY(agent, university_id, record_table, record_id))""")
    ver = Verifier()
    reviewer = f"agent:{a.agent}({a.model})"
    base = AGENT_DIR / a.agent
    # 대학 폴더만 본다(에이전트가 만든 도구 스크립트·__pycache__ 는 제외)
    known = {r[0] for r in con.execute("SELECT DISTINCT university_id FROM university_campus")}
    univs = sorted(p.name for p in base.iterdir() if p.is_dir() and p.name in known) if base.exists() else []
    skipped = sorted(p.name for p in base.iterdir() if p.is_dir() and p.name not in known) if base.exists() else []
    if skipped:
        print("대학 폴더가 아니라 건너뜀:", skipped)
    if a.univ:
        univs = [u for u in univs if u in a.univ.split(",")]
    report = Counter()
    problems = []
    recon = {}   # (대학, 파일) → 원본 줄 수 / 병합 시도 / 정본 행 수
    for uid in univs:
        # 이전 병합 지우기
        for tbl, rid in con.execute("SELECT record_table, record_id FROM merge_log WHERE agent=? AND university_id=?", (a.agent, uid)).fetchall():
            con.execute(f"DELETE FROM {tbl} WHERE rowid IN (SELECT rowid FROM {tbl} WHERE {pk(tbl)}=?)", (rid,))
            con.execute("DELETE FROM evidence WHERE target_table=? AND target_record_id=?", (tbl, rid))
        con.execute("DELETE FROM merge_log WHERE agent=? AND university_id=?", (a.agent, uid))

        tracked = []

        def track(tbl, rid):
            tracked.append((tbl, rid))
            con.execute("INSERT OR REPLACE INTO merge_log VALUES (?,?,?,?,?)", (a.agent, uid, tbl, rid, now()))

        def add_evidence(tbl, rid, rec):
            states = []
            for i, ev in enumerate(rec.get("evidence") or []):
                s = ver.check(ev)
                states.append(s)
                did = ev.get("document_id")
                if not did or not con.execute("SELECT 1 FROM document WHERE document_id=?", (did,)).fetchone():
                    problems.append((uid, tbl, rid, f"근거 문서 ID 없음/틀림: {did}"))
                    continue
                con.execute("""INSERT OR REPLACE INTO evidence (evidence_id, document_id, target_table, target_record_id, target_field,
                    page_index, printed_page_label, table_title, header_path, row_label, column_label, raw_text, footnote_text,
                    value_status, extraction_method, extractor_version, review_status, reviewer, reviewed_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                            ("ev:" + h(tbl, rid, i), did, tbl, rid, ",".join(ev.get("fields") or []) or None,
                             ev.get("page_index"), txt(ev.get("printed_page_label")), txt(ev.get("table_title")), txt(ev.get("header_path")),
                             txt(ev.get("row_label")), txt(ev.get("column_label")), txt(ev.get("raw_text")) or "", txt(ev.get("footnote_text")),
                             "confirmed" if s.startswith("text_match") else "pending",
                             "render_read" if s == "render_only" else "agent_read", f"{reviewer} → merge_agent {PARSER_VERSION}",
                             "auto_validated" if s in ("text_match", "text_match_partial", "text_match_elided") else
                             ("auto_validated" if s == "text_match_cells" else "held"), reviewer, now()))
            ok = any(s in ("text_match", "text_match_partial", "text_match_elided", "text_match_cells") for s in states)
            report[f"evidence:{'ok' if ok else ('render_only' if 'render_only' in states else 'unverified')}"] += 1
            if any(s.startswith("text_match_offset") for s in states):
                problems.append((uid, tbl, rid, f"쪽 번호 한 칸 어긋남 의심: {states}"))
            if not ok and "render_only" not in states:
                problems.append((uid, tbl, rid, f"근거 원문 확인 안 됨: {states}"))
            return ok, states

        def status_of(rec, ok, states):
            vs = rec.get("value_status") or "pending"
            if vs not in ENUM["value_status"]:
                problems.append((uid, "?", "?", f"value_status 이상값 {vs}"))
                vs = "pending"
            if not ok:
                return ("pending" if vs == "confirmed" else vs), ("held" if "render_only" not in states else "agent_extracted")
            return vs, "agent_extracted"

        d = base / uid
        for tname in TABLES:
            f = d / f"{tname}.jsonl"
            if not f.exists():
                report[f"missing_file:{tname}"] += 1
                continue
            mt = MAIN_TABLE[tname]
            before = con.execute("SELECT count(*) FROM merge_log WHERE agent=? AND university_id=? AND record_table=?",
                                 (a.agent, uid, mt)).fetchone()[0]
            lines = [x for x in f.read_text(encoding="utf-8").splitlines() if x.strip()]
            accepted = 0
            base_slots, dup_same = {}, 0
            for ln, line in enumerate(lines, 1):
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError as e:
                    problems.append((uid, tname, f"line{ln}", f"JSON 오류 {e}"))
                    continue
                rec = normalize_record(tname, rec, uid, problems)
                if rec is None:
                    continue
                year = int(rec.get("academic_year") or 0) or None
                first_doc = (rec.get("evidence") or [{}])[0].get("document_id")
                try:
                    tracked.clear()
                    merge_one(con, uid, year, tname, rec, first_doc, add_evidence, status_of, track, problems, report)
                    base_rid = next((x for t, x in tracked if t == mt), None)
                    canon = jdump({k: v for k, v in sorted(rec.items()) if k not in ("evidence", "note", "key", "_dup")})
                    slots = base_slots.get(base_rid)
                    if slots is None:
                        base_slots[base_rid] = [(canon, rec)]    # 이 열쇠를 처음 쓴 레코드
                    else:
                        # 방금 merge_one 이 첫 번째 주인의 자리를 덮어썼다 → 먼저 되살린다.
                        first_rec = slots[0][1]
                        merge_one(con, uid, year, tname, first_rec,
                                  (first_rec.get("evidence") or [{}])[0].get("document_id"),
                                  add_evidence, status_of, track, problems, report)
                        if any(c == canon for c, _ in slots):
                            report[f"같은내용중복:{tname}"] += 1   # 참 중복 — 한 행으로 합치는 것이 맞다
                            dup_same += 1
                        else:
                            # 내용이 다른데 같은 열쇠다 → 몇 번째든 새 순번을 받아 따로 보존한다.
                            seq = len(slots) + 1
                            rec["_dup"] = seq
                            tracked.clear()
                            merge_one(con, uid, year, tname, rec, first_doc, add_evidence, status_of, track, problems, report)
                            slots.append((canon, rec))
                            problems.append((uid, tname, rec.get("key"),
                                             f"자연키 충돌(내용은 다름) — 순번 {seq} 을 붙여 {seq}개 행 모두 보존함. 열쇠 칸 확인 필요"))
                            report[f"키충돌보존:{tname}"] += 1
                    accepted += 1
                    ext = rec.get("_extra") or {}
                    if ext:
                        prid = next((x for t, x in tracked if t == mt), None)
                        for k, v in ext.items():
                            con.execute("INSERT OR REPLACE INTO extension_fact VALUES (?,?,?,?,?,?,?)",
                                        ("ext:" + h(mt, prid or rec.get("key"), k), mt, prid, k, sj(v),
                                         rec.get("raw_text") or rec.get("note") or "(원문 조각 없음)", "pending"))
                            report["extension_fact"] += 1
                except Exception as e:  # noqa: BLE001
                    problems.append((uid, tname, rec.get("key"), f"병합 오류 {type(e).__name__}: {e}"))
            after = con.execute("SELECT count(*) FROM merge_log WHERE agent=? AND university_id=? AND record_table=?",
                                (a.agent, uid, mt)).fetchone()[0]
            stored = after - before
            recon[(uid, tname)] = {"원본줄": len(lines), "병합시도": accepted, "정본행": stored, "같은내용중복": dup_same}
            if stored != accepted - dup_same:
                problems.append((uid, tname, "-",
                                 f"행 수 불일치: 원본 {len(lines)}줄 중 {accepted}줄을 넣었고 같은내용중복 {dup_same}줄인데 정본에는 {stored}행 "
                                 f"— 자연키가 겹쳐 덮어썼을 수 있다(원본 보존됨, 열쇠 확인 필요)"))
            elif accepted != len(lines):
                problems.append((uid, tname, "-", f"거부된 줄 {len(lines) - accepted}개(위 사유 참조)"))
        con.commit()
    out = AGENT_DIR / a.agent / "_merge_report.json"
    recon_out = {f"{k[0]}/{k[1]}": v for k, v in sorted(recon.items())}
    lost = {k: v for k, v in recon_out.items() if v["정본행"] != v["원본줄"] - v["같은내용중복"]}
    out.write_text(json.dumps({"counts": report, "problems": problems, "행수대조": recon_out},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print(dict(report))
    print("문제", len(problems), "→", out)
    tot_src = sum(v["원본줄"] - v["같은내용중복"] for v in recon_out.values())
    tot_db = sum(v["정본행"] for v in recon_out.values())
    print(f"행 수 대조: 원본(같은내용중복 제외) {tot_src}줄 → 정본 {tot_db}행" + ("  ✔ 일치" if tot_src == tot_db else f"  ✘ {tot_src - tot_db}줄 안 들어감"))
    for k, v in sorted(lost.items(), key=lambda x: x[1]["정본행"] - x[1]["원본줄"])[:15]:
        print(f"   {k}: 원본 {v['원본줄']} / 시도 {v['병합시도']} / 같은내용중복 {v['같은내용중복']} / 정본 {v['정본행']}")


def pk(tbl):
    return {"offering": "offering_id", "program": "program_id", "eligibility_rule": "eligibility_rule_id",
            "eligibility_condition": "condition_id", "evaluation_component": "component_id",
            "conversion_rule": "conversion_rule_id", "conversion_item": "item_id", "csat_minimum": "minimum_rule_id",
            "schedule_event": "event_id", "document_requirement": "requirement_id", "extension_fact": "fact_id"}[tbl]


def hdup(dup, *a):
    """레코드 ID. 자연키가 겹쳐 순번이 붙은 경우에만 뒤에 '#N' 을 더한다."""
    x = h(*a)
    return f"{x}#{dup}" if dup else x


def merge_one(con, uid, year, tname, r, did, add_evidence, status_of, track, problems, report):
    g = r.get
    # 같은 자연키가 겹쳤을 때만 ID 뒤에 순번을 붙인다. 평소에는 기존 ID 와 똑같다.
    h = (lambda *a, _d=r.get("_dup"): hdup(_d, *a))
    if tname == "offerings":
        prog_id = None
        if g("program_name_raw"):
            prog_id = "prog:" + hdup(None, uid, year, g("campus_name"), g("program_name_raw"))
            con.execute("""INSERT OR IGNORE INTO program (program_id, academic_year, university_id, campus_id, program_name_raw,
                college_name, major_group, value_status, review_status) VALUES (?,?,?,?,?,?,?,?,?)""",
                        (prog_id, year, uid, g("campus_name"), g("program_name_raw"), g("college_name"), g("major_group"),
                         "confirmed", "agent_extracted"))
            track("program", prog_id)
        # 열쇠가 좁으면 서로 다른 행이 같은 ID 가 되어 INSERT OR REPLACE 로 덮어써진다.
        # (2026-09-20: 계명대 '일반전형' 818명 행이 905명 행에 덮어써진 사례) → 구분되는 칸을 모두 넣는다.
        rid = "off:" + h(uid, year, g("phase"), g("round"), g("admission_group"), g("campus_name"), g("admission_name_raw"),
                         g("program_name_raw"), g("quota_type"), g("admission_type"), g("special_category"),
                         g("college_name"), g("major_group"), g("seat_group"), did)
        ok, st = add_evidence("offering", rid, r)
        vs, rs = status_of(r, ok, st)
        seats = g("seats_planned")
        con.execute("""INSERT OR REPLACE INTO offering (offering_id, academic_year, university_id, campus_id, program_id, phase, round,
            admission_group, admission_name_raw, admission_type, quota_type, special_category, seats_planned, seats_raw,
            seat_group_id, document_id, document_status, value_status, review_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (rid, year, uid, g("campus_name"), prog_id, g("phase"), g("round"), g("admission_group"),
                     g("admission_name_raw") or "(전형명 없음)", g("admission_type"), g("quota_type"), g("special_category"),
                     int(seats) if isinstance(seats, (int, float)) else (int(num(seats)) if num(seats) is not None and re.fullmatch(r"\s*\d+\s*", str(seats)) else None),
                     g("seats_raw") if g("seats_raw") is not None else (None if seats is None else str(seats)),
                     ("sg:" + h(uid, year, g("seat_group"))) if g("seat_group") else None, did, g("document_status"), vs, rs))
        track("offering", rid)
        report["offering"] += 1
    elif tname == "eligibility":
        ga = g("ged_acceptance") or "미확인"
        if ga not in ENUM["ged_acceptance"]:
            problems.append((uid, tname, g("key"), f"ged_acceptance 이상값 {ga}")); ga = "미확인"
        rid = "elig:" + h(uid, year, g("scope_level"), g("admission_name_raw"), g("program_name_raw"), did)
        ok, st = add_evidence("eligibility_rule", rid, r)
        vs, rs = status_of(r, ok, st)
        con.execute("""INSERT OR REPLACE INTO eligibility_rule (eligibility_rule_id, university_id, academic_year, scope_level, offering_id,
            admission_name_raw, ged_acceptance, ged_acceptance_basis, educational_equivalence, raw_requirement, document_id,
            value_status, review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (rid, uid, year, g("scope_level") or "admission", None, g("admission_name_raw"), ga, g("ged_acceptance_basis"),
                     g("educational_equivalence"), g("raw_requirement"), did, vs, rs))
        track("eligibility_rule", rid)
        keymap = {}
        for c in g("conditions") or []:
            keymap[c.get("ckey")] = "cond:" + h(rid, c.get("ckey"))
        for c in g("conditions") or []:
            cid = keymap[c.get("ckey")]
            con.execute("""INSERT OR REPLACE INTO eligibility_condition (condition_id, eligibility_rule_id, parent_group, logical_operator,
                condition_type, comparator, value, qualification_deadline, allowed_exam_sessions, minimum_semesters,
                recommendation_required, raw_text, value_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (cid, rid, keymap.get(c.get("parent")), c.get("op"), c.get("type") or "기타", c.get("comparator"),
                         None if c.get("value") is None else str(c.get("value")), c.get("qualification_deadline"),
                         c.get("allowed_exam_sessions"), c.get("minimum_semesters"),
                         None if c.get("recommendation_required") is None else int(bool(c.get("recommendation_required"))),
                         c.get("raw_text") or "", vs))
            track("eligibility_condition", cid)
        report["eligibility_rule"] += 1
    elif tname == "evaluation":
        erid = "evr:" + h(uid, year, g("admission_name_raw"), g("program_scope"), did)
        rid = "evc:" + h(erid, g("stage_order"), g("component"), g("applicant_group"), g("key"))
        ok, st = add_evidence("evaluation_component", rid, r)
        vs, rs = status_of(r, ok, st)
        con.execute("""INSERT OR REPLACE INTO evaluation_component (component_id, evaluation_rule_id, university_id, academic_year, scope_level,
            admission_name_raw, stage_order, selection_multiplier, component, assessment_mode, nominal_weight, nominal_weight_num,
            max_points, base_points, prior_stage_carryover, applicant_group, rubric_domains, interview_format, tie_break_order,
            raw_text, value_status, review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (rid, erid, uid, year, "admission" if not g("program_scope") else "offering", g("admission_name_raw"),
                     g("stage_order"), g("selection_multiplier"), g("component") or "기타", g("assessment_mode"),
                     None if g("nominal_weight") is None else str(g("nominal_weight")), num(g("nominal_weight_num")),
                     num(g("max_points")), num(g("base_points")), g("prior_stage_carryover"), g("applicant_group"),
                     None if g("rubric_domains") is None else (g("rubric_domains") if isinstance(g("rubric_domains"), str) else jdump(g("rubric_domains"))),
                     g("interview_format"), None if g("tie_break_order") is None else str(g("tie_break_order")), g("raw_text"), vs, rs))
        track("evaluation_component", rid)
        report["evaluation_component"] += 1
    elif tname == "conversion":
        kind = g("input_score_kind") or "unknown"
        if kind not in ENUM["input_score_kind"]:
            problems.append((uid, tname, g("key"), f"input_score_kind 이상값 {kind}")); kind = "unknown"
        ev0 = (g("evidence") or [{}])[0]
        rid = "conv:" + h(uid, year, did, ev0.get("page_index"), kind, g("output_score_kind"), jdump(g("scope_admissions")), g("key"))
        ok, st = add_evidence("conversion_rule", rid, r)
        vs, rs = status_of(r, ok, st)
        appr = g("calc_approval") or "pending"
        reasons = [g("calc_block_reason")] if g("calc_block_reason") else []
        if appr not in ENUM["calc_approval"]:
            appr = "pending"
        if g("scope_status") != "confirmed":
            reasons.append("적용범위 미확인(scope_status≠confirmed)")
        if kind in ("unknown",):
            reasons.append("입력 점수 종류 불명")
        if kind in ("practical", "essay") and re.search(r"검정", jdump(g("scope_applicants")) or ""):
            reasons.append("대상자에 검정고시가 있으나 **입력 점수는 실기/논술 성적**이다 — 검정고시 과목점수·평균으로 계산 금지(가천대 2027 수시 87쪽 유형)")
        # 구간 검사 — **같은 과목(트랙)끼리만** 비교한다.
        # 전형·계열별로 표가 나뉘어 있으면 같은 점수 구간이 여러 번 나오는 것이 정상이다
        # (가톨릭관동대 2028: 학생부교과 / 실기 체육교육과 / 실기 스포츠레저 … 이 각각 0~90 구간을 갖는다)
        bands = [it for it in g("items") or [] if it.get("item_kind") == "band" and num(it.get("input_lower")) is not None]
        tracks = {}
        for it in bands:
            tracks.setdefault(it.get("subject"), []).append(it)
        for subj, grp in tracks.items():
            grp.sort(key=lambda x: num(x.get("input_lower")))
            tag = f"[{subj}] " if subj else ""
            for x, y in zip(grp, grp[1:]):
                xu = num(x.get("input_upper"))
                if xu is not None and xu > num(y.get("input_lower")):
                    reasons.append(f"{tag}구간 겹침 {x.get('input_raw')} / {y.get('input_raw')}")
                if xu is not None and xu == num(y.get("input_lower")) and x.get("upper_inclusive") and y.get("lower_inclusive"):
                    reasons.append(f"{tag}경계값 중복 포함 {x.get('input_raw')} / {y.get('input_raw')}")
        if not ok:
            reasons.append("근거 원문 확인 안 됨")
        if appr == "approved" and reasons:
            appr = "pending"
        con.execute("""INSERT OR REPLACE INTO conversion_rule (conversion_rule_id, university_id, academic_year, scope_phase, scope_admissions,
            scope_programs, scope_applicants, scope_stage, scope_status, input_score_kind, output_score_kind, conversion_method,
            included_subjects, excluded_subjects, elective_policy, exemption_policy, retake_policy, formula_raw, formula_structured,
            operation_order, rounding_stage, rounding_mode, decimal_places, grade_scale, score_min, score_max, attendance_substitution,
            nonacademic_substitution, missing_input_policy, document_id, value_status, review_status, calc_approval, calc_block_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (rid, uid, year, g("scope_phase"), jdump(g("scope_admissions")), sj(g("scope_programs")), sj(g("scope_applicants")),
                     sj(g("scope_stage")), g("scope_status") or "pending", kind, g("output_score_kind"), g("conversion_method"),
                     sj(g("included_subjects")), sj(g("excluded_subjects")), sj(g("elective_policy")), sj(g("exemption_policy")),
                     sj(g("retake_policy")), g("formula_raw"), sj(g("formula_structured")), sj(g("operation_order")),
                     sj(g("rounding_stage")), g("rounding_mode"), g("decimal_places"), None if g("grade_scale") is None else str(g("grade_scale")),
                     num(g("score_min")), num(g("score_max")), sj(g("attendance_substitution")), sj(g("nonacademic_substitution")),
                     sj(g("missing_input_policy")), did, vs, rs, appr, "; ".join(dict.fromkeys(x for x in reasons if x)) or None))
        track("conversion_rule", rid)
        for i, it in enumerate(g("items") or []):
            iid = "citem:" + h(rid, i, it.get("item_kind"), it.get("subject"), it.get("input_raw"))
            con.execute("""INSERT OR REPLACE INTO conversion_item (item_id, conversion_rule_id, item_kind, seq, subject, input_lower,
                input_upper, lower_inclusive, upper_inclusive, input_raw, output_grade, output_points, output_raw, weight, value_status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (iid, rid, it.get("item_kind") or "band", it.get("seq", i), it.get("subject"), num(it.get("input_lower")),
                         num(it.get("input_upper")), bi(it.get("lower_inclusive")), bi(it.get("upper_inclusive")),
                         None if it.get("input_raw") is None else str(it.get("input_raw")),
                         None if it.get("output_grade") is None else str(it.get("output_grade")), num(it.get("output_points")),
                         None if it.get("output_raw") is None else str(it.get("output_raw")), num(it.get("weight")), vs))
            track("conversion_item", iid)
        report["conversion_rule"] += 1
    elif tname == "csat_minimum":
        me = g("minimum_exists") or "unknown"
        rid = "csat:" + h(uid, year, g("scope_admission"), sj(g("scope_programs")), (g("raw_text") or "")[:120], did)
        ok, st = add_evidence("csat_minimum", rid, r)
        vs, rs = status_of(r, ok, st)
        appr = g("calc_approval") or "pending"
        reasons = [g("calc_block_reason")] if g("calc_block_reason") else []
        # 최저 유무를 모르면 계산에 쓸 수 없다. 에이전트가 approved 로 보내도 병합기가 막는다.
        # (2026-09-20: 가천대 3건·충남대 1건이 '지원자격' 문장을 최저 근거로 쓰고 승인돼 있었다)
        if me == "unknown":
            appr = "blocked"
            reasons.append("최저 유무가 미상이라 계산 금지 — 원문에서 등급 기준을 찾지 못함")
        if me == "yes" and not g("logical_expression"):
            reasons.append("논리식 없음"); appr = "pending" if appr == "approved" else appr
        if not ok and appr == "approved":
            appr = "pending"; reasons.append("근거 원문 확인 안 됨")
        con.execute("""INSERT OR REPLACE INTO csat_minimum (minimum_rule_id, university_id, academic_year, scope_admission, scope_programs,
            minimum_exists, test_participation_required, required_domains, candidate_domains, domain_count, grade_sum_limit,
            per_domain_limit, inquiry_as_one_domain, averaging_rule, mandatory_math_choice, inquiry_category, english_condition,
            history_condition, logical_expression, exceptions, raw_text, document_id, value_status, review_status, calc_approval,
            calc_block_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (rid, uid, year, g("scope_admission"), sj(g("scope_programs")), me, sj(g("test_participation_required")),
                     sj(g("required_domains")), sj(g("candidate_domains")), g("domain_count") if isinstance(g("domain_count"), int) else None,
                     num(g("grade_sum_limit")), sj(g("per_domain_limit")), sj(g("inquiry_as_one_domain")), sj(g("averaging_rule")),
                     sj(g("mandatory_math_choice")), sj(g("inquiry_category")), sj(g("english_condition")), sj(g("history_condition")),
                     sj(g("logical_expression")), sj(g("exceptions")), g("raw_text") or "", did, vs, rs, appr,
                     "; ".join(x for x in reasons if x) or None))
        track("csat_minimum", rid)
        report["csat_minimum"] += 1
    elif tname == "schedule":
        rid = "evt:" + h(uid, year, g("scope"), g("event_type"), g("start_at"), (g("raw_text") or "")[:80], did)
        ok, st = add_evidence("schedule_event", rid, r)
        vs, rs = status_of(r, ok, st)
        con.execute("""INSERT OR REPLACE INTO schedule_event (event_id, university_id, academic_year, scope, event_type, start_at, end_at,
            date_precision, confirmed_or_expected, deadline_basis, raw_text, document_id, value_status, review_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (rid, uid, year, g("scope"), g("event_type") or "기타", g("start_at"), g("end_at"), g("date_precision"),
                     g("confirmed_or_expected"), g("deadline_basis"), g("raw_text") or "", did, vs, rs))
        track("schedule_event", rid)
        report["schedule_event"] += 1
    elif tname == "documents":
        rid = "req:" + h(uid, year, g("scope"), g("applicant_condition"), g("document_name_raw"), did)
        ok, st = add_evidence("document_requirement", rid, r)
        vs, rs = status_of(r, ok, st)
        con.execute("""INSERT OR REPLACE INTO document_requirement (requirement_id, university_id, academic_year, scope, applicant_condition,
            document_name_raw, required_or_optional, issuing_authority, submission_channel, online_provision_range, substitute_form,
            max_pages, max_activities, max_characters, activity_period_rule, prohibited_content, due_text, raw_text, document_id,
            value_status, review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (rid, uid, year, g("scope"), g("applicant_condition"), g("document_name_raw") or "(서류명 없음)",
                     g("required_or_optional"), g("issuing_authority"), g("submission_channel"), sj(g("online_provision_range")),
                     g("substitute_form"), sj(g("max_pages")), sj(g("max_activities")), sj(g("max_characters")),
                     sj(g("activity_period_rule")), sj(g("prohibited_content")), sj(g("due_text")), g("raw_text") or "", did, vs, rs))
        track("document_requirement", rid)
        report["document_requirement"] += 1


def txt(x):
    """원문 조각 칸에 문자열만 들어가게 한다. 에이전트가 배열(다단 헤더 등)로 주면 ' > ' 로 잇는다."""
    if x is None or isinstance(x, str):
        return x
    if isinstance(x, (list, tuple)):
        return " > ".join(txt(i) or "" for i in x)
    if isinstance(x, dict):
        return jdump(x)
    return str(x)


def sj(x):
    if x is None:
        return None
    return x if isinstance(x, str) else jdump(x)


def bi(x):
    return None if x is None else int(bool(x))


if __name__ == "__main__":
    main()
