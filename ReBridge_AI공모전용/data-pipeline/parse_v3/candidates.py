"""전체 확대 1층 — 규칙 기반 후보 구간(candidate).

    python3 candidates.py [--univ id,id] [--force]

모집요강·시행계획의 모든 쪽(텍스트층 + OCR)에서 아래 주제의 원문 구간을 찾아 candidate 에 넣는다.
후보는 사실이 아니다(status=pending). 구조화 테이블로 옮기려면 원문 대조(에이전트 추출 + 메인 검증)가 필요하다.

  ged_eligibility     검정고시·동등학력·졸업학력 인정 문구 (+부정/추천/재학 신호)
  csat_minimum        수능 최저학력기준 문구
  ged_conversion      검정고시 성적 환산·비교내신 표가 있어 보이는 쪽 (+실기·논술 표 경고 신호)
  schedule            일정 키워드 + 날짜가 같은 줄
  required_documents  제출서류·학생부 대체서식·검정고시 증명서
  evaluation          전형방법·반영비율·단계별 선발
"""

import argparse
import re
from collections import Counter

from common import PARSER_VERSION, connect, text_db, log, h, jdump

EXTRACTOR = "candidates " + PARSER_VERSION
DATE = r"(20\d\d\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}|\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*[.일]?\s*\([월화수목금토일]\))"
RULES = {
    "ged_eligibility": re.compile(r"검정고시|동등\s*이상의?\s*학력|동등\s*학력|졸업\s*학력\s*인정|학력\s*인정"),
    "csat_minimum": re.compile(r"수능\s*최저|최저\s*학력\s*기준"),
    "required_documents": re.compile(r"제출\s*서류|학생부\s*대체|대체\s*서식|검정고시\s*(합격|성적)\s*증명서|성적\s*증명서"),
    "evaluation": re.compile(r"전형\s*방법|반영\s*비율|선발\s*방법|단계별|\d\s*배수|사정\s*방법"),
}
SCHED = re.compile(r"(원서\s*접수|서류\s*제출|면접|합격자\s*발표|등록|논술\s*고사|실기\s*고사|충원)")
SIG = {
    "negative": re.compile(r"검정고시[^.\n]{0,40}(불가|제외|할\s*수\s*없|지원\s*자격\s*없|인정하지\s*않)"),
    "recommendation": re.compile(r"학교장\s*(의\s*)?추천"),
    "enrollment": re.compile(r"재학\s*(중|기간)|졸업\s*예정|이수\s*학기|\d\s*학기"),
    "equivalence": re.compile(r"동등\s*이상의?\s*학력|동등\s*학력"),
    "explicit_ged": re.compile(r"검정고시"),
}
CONV_CTX = re.compile(r"환산|비교\s*내신|석차\s*등급|등급\s*부여|성적\s*산출|환산\s*점수")
CONV_WARN = {"practical": re.compile(r"실기"), "essay": re.compile(r"논술\s*(고사|성적|점수)"),
             "ged_average": re.compile(r"검정고시[^.\n]{0,30}(평균|과목\s*점수|성적)"),
             "csat": re.compile(r"수능|표준\s*점수|백분위")}


def windows(text, rx, span=350):
    out, last = [], -10**9
    for m in rx.finditer(text):
        if m.start() < last + span:
            continue
        s, e = max(0, m.start() - span), min(len(text), m.end() + span)
        out.append((m.start(), text[s:e]))
        last = m.start()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--univ")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    con, tdb = connect(), text_db()
    has_ocr = tdb.execute("SELECT name FROM sqlite_master WHERE name='page_ocr'").fetchone()
    q = """SELECT DISTINCT f.document_id, f.university_id FROM document_file f JOIN document d USING(document_id)
           JOIN university_campus u ON u.university_id=f.university_id
           WHERE d.document_type IN ('모집요강','시행계획') AND u.in_target=1 AND f.is_original_format_archive=0"""
    pairs = list(con.execute(q))
    if a.univ:
        pairs = [p for p in pairs if p[1] in a.univ.split(",")]
    st = Counter()
    for did, uid in pairs:
        if not a.force and con.execute("SELECT 1 FROM processing_log WHERE document_id=? AND stage='candidates' AND parser_version=? AND detail LIKE ?",
                                       (did, PARSER_VERSION, f"{uid}:%")).fetchone():
            continue
        con.execute("DELETE FROM candidate WHERE document_id=? AND university_id=?", (did, uid))
        pages = {pi: t or "" for pi, t in tdb.execute("SELECT page_index, text FROM page_text WHERE document_id=?", (did,))}
        if has_ocr:
            for pi, t in tdb.execute("SELECT page_index, text FROM page_ocr WHERE document_id=?", (did,)):
                pages[pi] = (pages.get(pi, "") + "\n[OCR]\n" + (t or ""))
        n = 0
        for pi, t in sorted(pages.items()):
            for kind, rx in RULES.items():
                for pos, w in windows(t, rx):
                    sig = {k: bool(r.search(w)) for k, r in SIG.items()} if kind == "ged_eligibility" else {}
                    con.execute("INSERT OR REPLACE INTO candidate VALUES (?,?,?,?,?,?,?,?,?,?)",
                                ("cand:" + h(did, uid, kind, pi, pos), did, uid, kind, pi, jdump(sig) if sig else None,
                                 None, w, "pending", EXTRACTOR))
                    n += 1
            # 환산표로 보이는 쪽: 검정고시 + 환산 맥락 + 숫자 많음
            if "검정고시" in t and CONV_CTX.search(t) and len(re.findall(r"\d+(\.\d+)?", t)) >= 12:
                warn = {k: bool(r.search(t)) for k, r in CONV_WARN.items()}
                sub = "practical?" if warn["practical"] and not warn["ged_average"] else ("ged?" if warn["ged_average"] else "unknown")
                con.execute("INSERT OR REPLACE INTO candidate VALUES (?,?,?,?,?,?,?,?,?,?)",
                            ("cand:" + h(did, uid, "ged_conversion", pi), did, uid, "ged_conversion", pi, jdump(warn), sub,
                             t[:4000], "pending", EXTRACTOR))
                n += 1
            for line in t.splitlines():
                if SCHED.search(line) and re.search(DATE, line):
                    con.execute("INSERT OR REPLACE INTO candidate VALUES (?,?,?,?,?,?,?,?,?,?)",
                                ("cand:" + h(did, uid, "schedule", pi, line), did, uid, "schedule", pi, None, None,
                                 line.strip()[:500], "pending", EXTRACTOR))
                    n += 1
        log(con, did, "candidates", "done" if n else "partial", f"{uid}: 후보 {n}개")
        st["docs"] += 1
        st["cands"] += n
        con.commit()
    print(dict(st))


if __name__ == "__main__":
    main()
