"""어디가 '전년도 결과공개' 표를 2025·2026 입시결과 **대체 자료**로 받는다 (4년제 전용).

원칙 (동근님 2026-09-17): 대학 원문이 먼저. 원문이 없는 대학·연도만 이걸로 채우고 '대체'로 표시한다.
그래서 에이전트 수집이 끝난 뒤에 돌린다. 원문(원문여부=원문)이 이미 있는 대학·연도는 건너뛴다.

경로 (2026-09-17 확인)
  POST /uct/acd/ade/criteriaAndResultItemNewAjax.do
       searchSyr={학년도+1}&unvCd={코드}&tsrdCmphSlcnArtclUpCd=30
  searchSyr=2027 페이지의 '2026학년도 전형 결과' 탭 = 2026학년도 결과,
  searchSyr=2026 → 2025학년도 결과. (parse_adiga_csv.py 상단 검증 참고)
  전문대는 빈 조각(1KB 미만)이 온다 → 대상 아님.

받은 HTML 조각은 손대지 않고, 앞에 출처 주석만 붙여 .html 로 저장한다.
"""

import csv
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import rawlib as R

BASE = "https://www.adiga.kr"
EP = "/uct/acd/ade/criteriaAndResultItemNewAjax.do"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
WHO = "adiga_results"
PAGE = BASE + "/uct/acd/ade/criteriaAndResultPopup.do?searchSyr={s}&tsrdCmphSlcnArtclUpCd=30&unvCd={c}"


def codes():
    """univId → 어디가 unvCd. slug id(snu 등)는 2027 요강 1차 수집 manifest의 URL에서 찾는다."""
    m = {}
    man = R.APP_DATA / "pdf_sources" / "guides_2027" / "manifest.csv"
    with open(man, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            x = re.search(r"unvCd=(\d+)", r["출처URL"])
            if x:
                m.setdefault(r["univId"], x.group(1))
    out = {}
    for u in R.targets():
        if u["kind"] != "대학교":
            continue
        c = m.get(u["univId"]) or (u["univId"][2:] if u["univId"].startswith("uA") else None)
        if c:
            out[u["univId"]] = c
    return out


def fetch(code, year, dst):
    s = str(int(year) + 1)
    r = subprocess.run(
        ["curl", "-sSL", "-m", "90", "-A", UA, "-X", "POST",
         "-H", f"Referer: {PAGE.format(s=s, c=code)}",
         "--data", f"searchSyr={s}&unvCd={code}&tsrdCmphSlcnArtclUpCd=30&compUnvCd=",
         "-o", str(dst), BASE + EP],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise ConnectionError(r.stderr.strip()[:200])
    body = dst.read_text("utf-8", "replace")
    return body


def main(only=None):
    man = {y: R.load_manifest(y) for y in ("2025", "2026")}
    todo = codes()
    done = skip = empty = 0
    with tempfile.TemporaryDirectory() as tmp:
        for uid, code in todo.items():
            if only and uid not in only:
                continue
            for y in ("2025", "2026"):
                if any(r["univId"] == uid and r["상태"] == "확보" and r["원문여부"] == "원문" for r in man[y]):
                    skip += 1
                    continue
                p = Path(tmp) / "frag.html"
                try:
                    body = fetch(code, y, p)
                except Exception as e:
                    R.miss(y, WHO, uid, "입시결과_통합", f"[확인 못 함] 어디가 대체 수집 접속 실패 {e.__class__.__name__}")
                    continue
                time.sleep(1)
                if body.count("<table") == 0 or "전형결과" not in re.sub(r"\s", "", body):
                    R.miss(y, WHO, uid, "입시결과_통합",
                           f"대학 원문 없음 + 어디가 결과공개에도 {y}학년도 표 없음 (응답 {len(body)}자)",
                           url=PAGE.format(s=int(y) + 1, c=code))
                    empty += 1
                    continue
                src = PAGE.format(s=int(y) + 1, c=code)
                out = Path(tmp) / f"adiga_{y}.html"
                out.write_text(
                    f"<!-- 출처: 대학어디가 '전형 평가기준 및 전년도 결과공개' {y}학년도 전형 결과 탭\n"
                    f"     페이지 {src}\n     조각 POST {BASE}{EP} (searchSyr={int(y) + 1}, unvCd={code}, tsrdCmphSlcnArtclUpCd=30)\n"
                    f"     받은 날짜 {R.dt.date.today().isoformat()} · 대학 원문이 없어 대체로 받음. 아래는 받은 그대로 -->\n" + body,
                    encoding="utf-8",
                )
                if R.add(y, WHO, uid, "입시결과_통합", out, url=src, original="대체",
                         note=f"대학어디가 결과공개 HTML 표(대체). [공개: 어디가]"):
                    done += 1
    print(f"대체로 넣음 {done}, 원문 있어 건너뜀 {skip}, 어디가에도 없음 {empty}")


if __name__ == "__main__":
    main(set(sys.argv[1:]) or None)
