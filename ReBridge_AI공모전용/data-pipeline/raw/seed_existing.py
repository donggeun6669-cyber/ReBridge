"""이미 가진 2027·2028 원본을 RAW로 복사한다 (한 번만 돌린다).

2028 시행계획: DEAN 대입자료의 zip 4개(어디가에서 동근님이 받은 원래 형식 그대로)를 쓴다.
  pdf_sources/2028 의 PDF 중 34개는 HWP를 PDF로 바꾼 변환본이라 원문이 아니다 → 넣지 않는다.
2027 모집요강: pdf_sources/guides_2027 (어디가 대학별 다운로드, manifest.csv에 출처 URL 있음).
  '성공' 줄만 옮긴다. '못 구함' 줄은 1차 수집의 실패 기록이라 옮기지 않는다 — 다시 찾는다.
"""

import csv
import re
import tempfile
import zipfile
from pathlib import Path

import rawlib as R

ZIP_DIR = Path("/Users/r_o_und_12/Documents/DEAN/03_PROJECTS/Gumgomentor/ReBridge/대입자료")
G27 = R.APP_DATA / "pdf_sources" / "guides_2027"
WHO = "seed"


def key(s):
    s = R.nfc(s)
    s = re.sub(r"\[[^\]]*\]", "", s)
    return re.sub(r"[\s·・.,'\"’”_-]", "", s)


# 마스터 이름에 캠퍼스가 괄호로 붙은 대학 — 시행계획 파일의 [지역]으로 가른다
REGION_ALIAS = {
    ("가야대학교", "경남"): "uA0002748",   # 가야대학교(김해)
    ("영산대학교", "경남"): "uA0003194",   # 영산대학교(양산)
    ("영산대학교", "부산"): "uA0003193",   # 영산대학교(해운대)
}


def seed_2028():
    names = {}
    for u in R.targets():
        names.setdefault(key(u["name"]), []).append(u)
    done = skipped = 0
    unmatched = []
    with tempfile.TemporaryDirectory() as tmp:
        for z in sorted(ZIP_DIR.glob("*2028*시행계획*.zip")):
            with zipfile.ZipFile(z) as zf:
                for info in zf.infolist():
                    if info.is_dir():
                        continue
                    n = info.filename
                    if not info.flag_bits & 0x800:
                        n = n.encode("cp437").decode("cp949")
                    n = R.nfc(Path(n).name)
                    m = re.match(r"(.+?)\[([^\]]+)\]\[([^\]]+)\]", n)
                    if not m:
                        unmatched.append(n)
                        continue
                    hit = names.get(key(m.group(1)), [])
                    alias = REGION_ALIAS.get((key(m.group(1)), m.group(2)))
                    if alias:
                        hit = [R.by_id()[alias]]
                    if len(hit) != 1:
                        unmatched.append(n)
                        continue
                    out = Path(tmp) / f"x{Path(n).suffix}"
                    out.write_bytes(zf.read(info))
                    note = f"어디가 2028 시행계획(1차수) — 동근님 수집 zip '{R.nfc(z.name)}'. 원래 파일명: {n}"
                    campus = "" if m.group(3) == "본교" else f"{m.group(2)}_{m.group(3)}"
                    r = R.add("2028", WHO, hit[0]["univId"], "시행계획", out, url="", note=note,
                              campus=campus)
                    done += bool(r)
                    skipped += not r
    print(f"2028: 넣음 {done}, 같은 내용이라 건너뜀 {skipped}, 매칭 실패 {len(unmatched)}")
    for n in unmatched:
        print("  매칭 실패:", n)


def seed_2027():
    valid = R.by_id()
    done = skipped = 0
    bad = []
    with open(G27 / "manifest.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row["상태(성공/못 구함)"] != "성공":
                continue
            uid, fn = row["univId"], R.nfc(row["파일명"])
            src = G27 / fn
            if not src.exists():
                # 맥 NFD 파일명 대비
                cands = [p for p in G27.rglob("*") if R.nfc(str(p.relative_to(G27))) == fn]
                src = cands[0] if cands else src
            if uid not in valid or not src.exists():
                bad.append((uid, fn, "대상 아님" if uid not in valid else "파일 없음"))
                continue
            doc = "모집요강_정시" if "jeongsi" in fn else "모집요강_수시"
            note = f"어디가 2027 모집요강 — 1차 수집(pdf_sources/guides_2027). {R.nfc(row['비고'])}"
            camp = re.search(r"_([^_/]*캠퍼스)", fn)
            r = R.add("2027", WHO, uid, doc, src, url=row["출처URL"], note=note,
                      campus=camp.group(1) if camp else "")
            done += bool(r)
            skipped += not r
    print(f"2027: 넣음 {done}, 같은 내용이라 건너뜀 {skipped}, 문제 {len(bad)}")
    for b in bad:
        print("  ", b)


if __name__ == "__main__":
    if list((R.RAW / "2027" / "_manifests").glob("seed.csv")) or list((R.RAW / "2028" / "_manifests").glob("seed.csv")):
        raise SystemExit("이미 seed를 돌렸다. 다시 돌리려면 RAW/2027·2028 의 seed 결과를 먼저 지운다.")
    seed_2028()
    seed_2027()
