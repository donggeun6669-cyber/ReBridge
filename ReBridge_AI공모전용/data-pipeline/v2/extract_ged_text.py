"""앱의 "원문 보기"에 쓸 재료 — 대학별 검정고시 관련 페이지 원문을 뽑는다.

## 왜 필요한가
검정고시 지원 가부와 비교내신은 **틀리면 학생이 헛되이 원서를 쓴다.**
그래서 앱은 "가능/불가"만 보여주지 말고 **시행계획 원문 그 자리**를 같이 띄워야 한다.
사용자가 직접 확인할 수 있으면, 우리 판정이 애매한 82개 대학도 쓸모가 있다.

## 무엇을 뽑나
`out/text/{year}/{univId}.jsonl` (extract_text.py 산출물)에서
검정고시·비교내신 키워드가 걸린 페이지만 골라, 페이지 번호·원문·출처 파일명을 담는다.
**원문은 자르거나 고치지 않는다.** PDF에서 뽑은 그대로 넣는다(규칙 2).

## 산출
  out/plans_{year}/ged_text/{univId}.json
  {
    "univId": "...", "univ": "...", "year": 2028,
    "sources": [{"file": "...pdf", "sha256": "...", "campus": "본교", "pages": 41}],
    "pages": [{"page": 7, "text": "원문 그대로", "file": "...pdf", "hits": ["검정고시"]}],
    "verdict": "가능",            # ged_eligibility_univ 판정 (있으면)
    "verdictQuote": "…"
  }
  out/plans_{year}/ged_text/_index.json   — 앱이 목록을 한 번에 읽기 위한 색인

실행:
  python3 v2/extract_ged_text.py --year 2028
  python3 v2/extract_ged_text.py --year 2028 --max-pages 12
"""

import argparse
import json
import re
from collections import defaultdict

import common as C

# ingest_plans.KEYWORDS 와 같은 뜻이지만, 여기서는 '사람이 읽을 페이지'를 고른다.
# 지원자격(검정고시)과 비교내신 두 갈래만 남긴다 — 나머지는 원문 보기에 노이즈다.
HIT_RULES = [
    ("검정고시", re.compile(r"검정고시")),
    ("동등학력", re.compile(r"동등\s*이상의?\s*학력|학력\s*인정")),
    ("비교내신", re.compile(r"비교\s*내신")),
    ("환산표", re.compile(r"환산\s*(점수|등급|표)")),
    ("학생부없음", re.compile(r"학교생활기록부\s*(미보유|없는|가\s*없)")),
]
# 이 둘 중 하나라도 걸려야 페이지를 담는다. '환산표'만 걸린 페이지는 재학생용일 수 있다.
CORE = {"검정고시", "동등학력", "비교내신"}


def page_hits(text):
    t = C.squash(text)
    return [name for name, rx in HIT_RULES if rx.search(t)]


def run(year, max_pages=20):
    text_dir = C.OUT / "text" / str(year)
    man_path = text_dir / "_manifest.json"
    if not man_path.exists():
        raise SystemExit(f"먼저 실행하세요: python3 v2/extract_text.py --year {year}")
    man = C.jload(man_path)

    out_dir = C.OUT / f"plans_{year}" / "ged_text"
    out_dir.mkdir(parents=True, exist_ok=True)

    # 판정 결과가 DB에 있으면 같이 실어 준다(없어도 동작한다)
    verdicts = {}
    try:
        con = C.connect()
        for r in con.execute(
                "SELECT univ_id, verdict, quote, page FROM ged_eligibility_univ WHERE year=?",
                (year,)):
            verdicts[r["univ_id"]] = dict(r)
    except Exception as e:            # DB가 아직 없어도 원문 추출은 되어야 한다
        print(f"  (DB 판정 결과를 못 읽음: {e})")

    # 같은 대학의 캠퍼스별 PDF를 한 파일로 합친다
    by_univ = defaultdict(list)
    for it in man["items"]:
        by_univ[it["univId"]].append(it)

    written, empty, missing_text = [], [], []
    total_pages = 0

    for uid, items in sorted(by_univ.items()):
        pages_out, sources = [], []
        for it in items:
            meta = C.parse_plan_filename(it.get("file") or "")
            suffix = ""
            if meta["campus"] and meta["campus"] != "본교":
                suffix = "_" + re.sub(r"\W+", "", meta["campus"])
            jf = text_dir / f"{uid}{suffix}.jsonl"
            if not jf.exists():
                jf = text_dir / f"{uid}.jsonl"
            if not jf.exists():
                missing_text.append(it.get("file"))
                continue

            with open(jf, encoding="utf-8") as f:
                pages = [json.loads(l) for l in f]
            sources.append({"file": it.get("file"), "sha256": it.get("sha256"),
                            "campus": meta["campus"], "pages": len(pages)})
            for p in pages:
                hits = page_hits(p["text"])
                if not (set(hits) & CORE):
                    continue
                pages_out.append({"page": p["page"], "file": it.get("file"),
                                  "hits": hits, "text": p["text"]})

        if not pages_out:
            empty.append(uid)
            continue

        # 근거가 강한 순서로 자른다 — 검정고시 문구가 직접 나오는 페이지가 먼저다
        pages_out.sort(key=lambda p: (-len(set(p["hits"]) & CORE),
                                      0 if "검정고시" in p["hits"] else 1,
                                      p["page"]))
        pages_out = pages_out[:max_pages]
        pages_out.sort(key=lambda p: (p["file"] or "", p["page"]))
        total_pages += len(pages_out)

        v = verdicts.get(uid) or {}
        doc = {
            "univId": uid,
            "univ": items[0].get("univ"),
            "year": year,
            "sources": sources,
            "verdict": v.get("verdict"),
            "verdictQuote": v.get("quote"),
            "verdictPage": v.get("page"),
            "pages": pages_out,
        }
        C.jdump(doc, out_dir / f"{uid}.json")
        written.append({"univId": uid, "univ": doc["univ"],
                        "pages": len(pages_out), "verdict": doc["verdict"],
                        "file": f"{uid}.json"})

    C.jdump({"year": year, "generated": len(written), "items": written},
            out_dir / "_index.json")

    n_univ = len(by_univ)
    print("═" * 62)
    print(f"  시행계획 PDF          {len(man['items']):>4}개")
    print(f"  대학(중복 캠퍼스 합침) {n_univ:>4}개")
    print(f"  원문 뽑힘             {len(written):>4}개  ({len(written)}/{n_univ})")
    print(f"  검정고시 관련 페이지 0 {len(empty):>4}개  ← 원문 보기 재료 없음")
    if missing_text:
        print(f"  텍스트 파일 없음      {len(missing_text):>4}건")
    print(f"  담은 페이지 합계       {total_pages:>4}쪽 "
          f"(대학당 최대 {max_pages}쪽)")
    if empty:
        names = [by_univ[u][0].get("univ") or u for u in empty[:10]]
        print("  페이지 0인 대학 예:", ", ".join(names))
    print("═" * 62)
    print(f"  → {out_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--max-pages", type=int, default=20,
                    help="대학당 담을 최대 페이지 수 (기본 20)")
    a = ap.parse_args()
    run(a.year, a.max_pages)
