"""Phase B(모집요강) — 2027 모집요강에서 검정고시 관련 페이지를 대학별로 모은다.

## 왜 필요한가
검정고시 지원 가부와 비교내신은 **틀리면 학생이 헛되이 원서를 쓴다.**
그래서 앱은 판정만 보여주지 말고 **모집요강 원문 그 자리**를 같이 띄운다.
원문은 자르거나 고치지 않는다(v2 규칙 2).

## 입력
  out/text/guides_2027/{대학명}[_{캠퍼스}]_{susi|jeongsi}.json  (extract_guides_text.py)

## 산출
  out/guides_2027/ged_text/{univId}.json
    {"univId","univ","year":2027,
     "sources":[{"file","phase","campus","pages","sha256","sourceUrl"}],
     "pages":[{"page","phase","campus","source_file","hits":[…],"text":"원문 그대로"}]}
  out/guides_2027/ged_text/_index.json

실행:
  python3 v2/extract_guides_ged.py --year 2027
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C

PHASE_KO = {"susi": "수시", "jeongsi": "정시", "tonghap": "수시+정시"}

# 지시받은 키워드 6개를 그대로 규칙으로 옮긴 것.
HIT_RULES = [
    ("검정고시",      re.compile(r"검정고시")),
    ("비교내신",      re.compile(r"비교\s*내신")),
    ("동등학력",      re.compile(r"동등\s*이상의?\s*학력|이와\s*같은\s*수준\s*이상의?\s*학력")),
    ("학생부미보유",   re.compile(r"학교생활기록부\s*(미보유|없는|가\s*없|이\s*없)|"
                              r"학생부\s*(미보유|없는|가\s*없)")),
    ("대체산출",      re.compile(r"대체\s*산출|성적\s*대체|대체\s*하여\s*산출")),
    ("학력인정",      re.compile(r"학력\s*인정|학력을\s*인정")),
]
# 이 중 하나라도 걸려야 페이지를 담는다.
# '학력인정'만 걸린 페이지는 학교 유형 설명일 뿐이라 검정고시와 무관할 때가 많다.
CORE = {"검정고시", "비교내신", "동등학력", "학생부미보유", "대체산출"}


def page_hits(text):
    t = C.squash(text)
    return [name for name, rx in HIT_RULES if rx.search(t)]


def run(year=2027, max_pages=None):
    text_dir = C.OUT / "text" / f"guides_{year}"
    man_path = text_dir / "_manifest.json"
    if not man_path.exists():
        raise SystemExit(f"먼저 실행하세요: python3 v2/extract_guides_text.py --year {year}")
    man = C.jload(man_path)

    out_dir = C.OUT / f"guides_{year}" / "ged_text"
    out_dir.mkdir(parents=True, exist_ok=True)

    by_uid = defaultdict(list)
    for it in man["items"]:
        by_uid[it["univId"]].append(it)

    written, empty = [], []
    total_pages = 0

    for uid, items in sorted(by_uid.items()):
        pages_out, sources = [], []
        for it in items:
            out_json = Path(it["out"])
            if not out_json.exists():
                continue
            d = json.load(open(out_json, encoding="utf-8"))
            src_name = str(Path(it["file"]).parent.name) + "/" + Path(it["file"]).name
            sources.append({
                "file": src_name, "path": it["file"], "phase": it["phase"],
                "phaseKo": PHASE_KO[it["phase"]],
                "campus": it.get("campus"), "pages": it.get("pages"),
                "sha256": it.get("sha256"), "sourceUrl": it.get("sourceUrl"),
            })
            for p in d["pages"]:
                hits = page_hits(p["text"])
                if not (set(hits) & CORE):
                    continue
                pages_out.append({
                    "page": p["page"],
                    "phase": it["phase"],
                    "phaseKo": PHASE_KO[it["phase"]],
                    "campus": it.get("campus"),
                    "source_file": src_name,
                    "hits": hits,
                    "text": p["text"],          # 원문 그대로. 자르지 않는다
                })

        if not pages_out:
            empty.append((uid, items[0]["univ"]))
            continue

        # 근거가 강한 순서를 rank 로 매겨 둔다(파일 안 순서는 원래대로 유지).
        order = sorted(range(len(pages_out)), key=lambda i: (
            0 if "비교내신" in pages_out[i]["hits"] else 1,
            0 if "검정고시" in pages_out[i]["hits"] else 1,
            -len(set(pages_out[i]["hits"]) & CORE),
            pages_out[i]["page"]))
        for rank, i in enumerate(order, 1):
            pages_out[i]["rank"] = rank
        if max_pages:
            keep = set(order[:max_pages])
            pages_out = [p for i, p in enumerate(pages_out) if i in keep]
        pages_out.sort(key=lambda p: (p["source_file"], p["page"]))
        total_pages += len(pages_out)

        doc = {"univId": uid, "univ": items[0]["univ"], "year": year,
               "sources": sources, "pages": pages_out}
        C.jdump(doc, out_dir / f"{uid}.json")
        written.append({"univId": uid, "univ": doc["univ"],
                        "pages": len(pages_out),
                        "hasComparative": any("비교내신" in p["hits"] for p in pages_out),
                        "file": f"{uid}.json"})

    C.jdump({"year": year, "generated": len(written), "items": written,
             "emptyUnivs": [{"univId": u, "univ": n} for u, n in empty]},
            out_dir / "_index.json")

    print("═" * 62)
    print(f"  텍스트 있는 요강 파일   {len(man['items']):>4}개")
    print(f"  대학(univId 기준)      {len(by_uid):>4}개")
    print(f"  검정고시 관련 페이지 나온 대학 {len(written):>4}개")
    print(f"  관련 페이지 0인 대학    {len(empty):>4}개 "
          f"{[n for _, n in empty[:8]]}")
    print(f"  담은 페이지 합계        {total_pages:>5}쪽")
    print(f"  그중 '비교내신' 언급 대학 "
          f"{sum(1 for w in written if w['hasComparative']):>4}개")
    print("═" * 62)
    print(f"  → {out_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2027)
    ap.add_argument("--max-pages", type=int, default=None,
                    help="대학당 담을 최대 페이지 수 (기본: 제한 없음)")
    a = ap.parse_args()
    run(a.year, a.max_pages)
