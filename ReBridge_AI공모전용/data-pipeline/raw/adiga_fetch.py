"""어디가 대학별 페이지에서 2027 모집요강·2028 시행계획 원문을 받는다 (4년제 전용).

전문대는 어디가에 대학 페이지가 없다(univDetail 이 univView 로 튕긴다) → 입학처에서 사람처럼 찾는다.

경로 (2026-09-03 실패원인_분류.md 에서 확인, 2026-09-17 재확인)
  GET  /ucp/uvt/uni/univDetail.do?menuId=PCUVTINF2000&unvCd={코드}&searchSyr={학년도}
       본문의 '대학입학전형 시행계획' / '수시 모집요강' / '정시 모집요강' 옆
       fnUnvFileDownOne(fileId, fileSn, 'Y', unvCd, 학년도)
  GET  /cmm/com/file/fileDown.do?fileId=…&fileSn=…&menuId=PCUVTINF2000&downLogYn=Y&unvCd=…&searchSyr=…

못 받은 것은 manifest 에 '못 구함'으로 쓰지 않는다 — 입학처에서 한 번 더 찾은 뒤에 쓴다.
남은 목록은 RAW/_work/adiga_left.tsv 로 남긴다.
"""

import csv
import html
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

import rawlib as R

BASE = "https://www.adiga.kr"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"  # 헤더는 ASCII만 된다
WHO = "adiga"
LABELS = {
    "2027": {"수시 모집요강": "모집요강_수시", "정시 모집요강": "모집요강_정시"},
    "2028": {"대학입학전형 시행계획": "시행계획"},
}


def get(url, timeout=60):
    """curl로 받는다. 파이썬 urllib은 이 맥에서 인증서 체인 검증에 실패한다(2026-09-17 실측).
    검증을 끄지 않기 위해 시스템 인증서를 쓰는 curl을 쓴다."""
    with tempfile.TemporaryDirectory() as t:
        hdr, body = Path(t) / "h", Path(t) / "b"
        r = subprocess.run(
            ["curl", "-sSL", "-m", str(timeout), "-A", UA, "-D", str(hdr), "-o", str(body),
             "-w", "%{url_effective}", url],
            capture_output=True, text=True,
        )
        if r.returncode != 0:
            raise ConnectionError(r.stderr.strip()[:200])
        headers = {}
        for line in hdr.read_text("latin-1").splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().title()] = v.strip()
        return r.stdout.strip(), headers, body.read_bytes()


def links(code, syr):
    url = f"{BASE}/ucp/uvt/uni/univDetail.do?menuId=PCUVTINF2000&unvCd={code}&searchSyr={syr}"
    final, _, body = get(url)
    if "univDetail" not in final:
        return url, None                           # 대학 페이지 없음
    s = html.unescape(body.decode("utf-8", "replace"))
    out = {}
    # 이름표는 링크 '안쪽 뒤'에 있다: <a onclick="fnUnvFileDownOne(…)"><span>수시<br />모집요강</span></a>
    # (2026-09-17 처음엔 링크 앞 글자를 읽어 한 칸씩 밀렸다 — 수시 칸에 정시 요강, 정시 칸에 재외국민 요강)
    for m in re.finditer(r"fnUnvFileDownOne\(\s*'(\d+)'\s*,\s*'(\d+)'\s*,\s*'Y'\s*,\s*'(\d+)'\s*,\s*'(\d+)'", s):
        end = s.find("</a>", m.end())
        ctx = s[m.end():end if end > 0 else m.end() + 300]
        ctx = re.sub(r"<[^>]+>", " ", ctx[ctx.find(">") + 1:])
        ctx = re.sub(r"\s+", " ", ctx).strip()
        for label, doc in LABELS[syr].items():
            if ctx == label and m.group(4) == syr:
                out[doc] = (m.group(1), m.group(2), m.group(3))
    return url, out


def download(file_id, sn, code, syr, tmpdir):
    url = (f"{BASE}/cmm/com/file/fileDown.do?fileId={file_id}&fileSn={sn}"
           f"&menuId=PCUVTINF2000&downLogYn=Y&unvCd={code}&searchSyr={syr}")
    _, headers, body = get(url, timeout=180)
    cd = headers.get("Content-Disposition", "")
    m = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", cd)
    name = urllib.parse.unquote(m.group(1)) if m else f"{file_id}.bin"
    try:
        name = name.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    p = Path(tmpdir) / f"dl{Path(name).suffix.lower() or '.bin'}"
    p.write_bytes(body)
    return url, R.nfc(name), p


def main(worklists):
    rows = []
    for w in worklists:
        with open(w, encoding="utf-8") as f:
            rows.extend(csv.DictReader(f, delimiter="\t"))
    left = []
    with tempfile.TemporaryDirectory() as tmp:
        for r in rows:
            need = dict(x.split(":") for x in r["필요한것"].split())
            code = r["어디가unvCd"]
            still = []
            for syr, docs in need.items():
                wanted = docs.replace("모집요강", "모집요강").split("+")
                try:
                    page, found = links(code, syr)
                except Exception as e:
                    still.append(f"{syr}:{docs}(어디가 접속 실패 {e.__class__.__name__})")
                    continue
                time.sleep(1)
                if found is None:
                    still.append(f"{syr}:{docs}(어디가 대학 페이지 없음)")
                    continue
                for doc in wanted:
                    if doc not in found:
                        still.append(f"{syr}:{doc}(어디가에 파일 없음)")
                        continue
                    try:
                        url, name, p = download(*found[doc], syr, tmp)
                    except Exception as e:
                        still.append(f"{syr}:{doc}(다운로드 실패 {e.__class__.__name__})")
                        continue
                    time.sleep(1)
                    fmt = R.sniff(p)
                    if fmt in ("HTML", "알수없음") or p.stat().st_size < 2000:
                        still.append(f"{syr}:{doc}(받은 파일이 문서가 아님: {fmt}, {p.stat().st_size}B)")
                        continue
                    R.add(syr, WHO, r["univId"], doc, p, url=url,
                          note=f"어디가 대학별 페이지({page}). 원래 파일명: {name}")
            if still:
                left.append({**r, "남은것": " ".join(still)})
                print(f"남음: {r['대학명']} — {' '.join(still)}")
    out = R.RAW / "_work" / "adiga_left.tsv"
    with open(out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[*rows[0].keys(), "남은것"], delimiter="\t")
        w.writeheader()
        w.writerows(left)
    print(f"대상 {len(rows)}곳 중 남은 곳 {len(left)} → {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
