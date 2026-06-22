# -*- coding: utf-8 -*-
"""
공공데이터 → universities.json + admissions(베이스라인) 변환기.

사용법:
  1) 아래 공공데이터 중 하나를 내려받아 이 폴더에 둔다(.csv 또는 .xlsx):
     - 교육부_대학교 주소기반 좌표정보  (위도/경도 포함, 권장)
       https://www.data.go.kr/data/15138981/fileData.do
     - 전국대학및전문대학정보표준데이터 (KCUE, 좌표 없으면 주소만)
       https://www.data.go.kr/data/15107736/standard.do
  2) python ingest_universities.py <파일명>
     예) python ingest_universities.py univ_coords.csv
  3) 먼저 헤더만 확인하려면: python ingest_universities.py <파일명> --headers

동작:
  - 4년제(대학교) + 전문대학만 필터, 본교 우선.
  - 큐레이션된 34곳(curated)은 의미있는 univId와 검증된 입학처 URL을 유지하고,
    나머지는 학교코드 기반 univId로 추가.
  - universities.json 전체 갱신.
  - admissions.json: 큐레이션 34곳의 검증 상세 행은 보존, 신규 학교는 일반규칙 베이스라인 행 생성.

원칙: 좌표/홈페이지 등 '사실'만 채우고, 미확인 전형 수치는 비운다(기획서 7-4).
"""
import sys, json, csv, os, re

HERE = os.path.dirname(os.path.abspath(__file__))

def col(row, *cands):
    """헤더 이름 후보 중 매칭되는 값 반환(공백/대소문자 무시, 부분일치)."""
    norm = {re.sub(r"\s", "", k): v for k, v in row.items() if k}
    for c in cands:
        cc = re.sub(r"\s", "", c)
        for k, v in norm.items():
            if cc in k:
                return (v or "").strip()
    return ""

def load_rows(path):
    if path.lower().endswith((".xlsx", ".xls")):
        try:
            import openpyxl
        except ImportError:
            sys.exit("xlsx 읽기에 openpyxl 필요: pip install openpyxl  (또는 CSV로 저장해 주세요)")
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        header = [str(h).strip() if h is not None else "" for h in next(it)]
        for r in it:
            yield {header[i]: (r[i] if i < len(r) else None) for i in range(len(header))}
    else:
        # 공공데이터 CSV는 보통 cp949(euc-kr)
        for enc in ("utf-8-sig", "cp949", "utf-8"):
            try:
                with open(path, encoding=enc) as f:
                    for r in csv.DictReader(f):
                        yield r
                return
            except UnicodeDecodeError:
                continue
        sys.exit("CSV 인코딩 판별 실패")

REGION_MAP = {  # 시도 → 앱 표기 region
    "서울":"서울","부산":"부산","대구":"대구","인천":"인천","광주":"광주","대전":"대전",
    "울산":"울산","세종":"세종","경기":"경기","강원":"강원","충북":"충북","충청북도":"충북",
    "충남":"충남","충청남도":"충남","전북":"전북","전라북도":"전북","전남":"전남","전라남도":"전남",
    "경북":"경북","경상북도":"경북","경남":"경남","경상남도":"경남","제주":"제주",
}
def region_of(sido):
    for k, v in REGION_MAP.items():
        if k in (sido or ""):
            return v
    return (sido or "").strip()

def estab_of(s):
    s = s or ""
    if "국립" in s or "국·공립" in s: return "국립"
    if "공립" in s: return "공립"
    if "사립" in s: return "사립"
    return s.strip() or "사립"

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = os.path.join(HERE, sys.argv[1]) if not os.path.isabs(sys.argv[1]) else sys.argv[1]
    if not os.path.exists(path):
        sys.exit(f"파일 없음: {path}")

    rows = list(load_rows(path))
    if "--headers" in sys.argv:
        print("HEADERS:", list(rows[0].keys()) if rows else "(빈 파일)")
        print("SAMPLE:", json.dumps(rows[0], ensure_ascii=False)[:800] if rows else "")
        return

    # 큐레이션 34곳: 검증된 baseline은 별도 파일에서 읽는다(universities.json은 출력 대상이라 덮어쓰임 주의).
    with open(os.path.join(HERE, "universities_curated.json"), encoding="utf-8") as f:
        curated = {u["name"]: u for u in json.load(f)}

    # 학부 입시 대상만: 학교구분=대학(4년제) 또는 전문대학.
    # 대학원/대학원대학 제외. 학제 중 사이버·방송통신·기능대학 제외. 폐교 제외(기존+신설만).
    EXCLUDE_HAKJE = ("사이버", "방송통신", "기능")

    def norm_url(u):
        u = (u or "").strip()
        if not u:
            return ""
        if not u.startswith(("http://", "https://")):
            u = "https://" + u
        return u.rstrip("/")

    out, seen = [], set()
    for r in rows:
        gubun = col(r, "학교구분")
        if gubun not in ("대학", "전문대학"):           # 대학원/대학원대학 제외
            continue
        hakje = col(r, "학제")
        if any(x in hakje for x in EXCLUDE_HAKJE):     # 사이버/방송통신/기능대학 제외
            continue
        if "폐교" in col(r, "학교상태"):                # 기존+신설만
            continue
        name = col(r, "학교명", "대학명")
        if name and any(x in name for x in ("사이버", "원격", "방송통신")):  # 학제 오분류 안전망
            continue
        if not name or name in seen:                 # 분교/제2캠퍼스는 본교명으로 1회만
            continue
        seen.add(name)
        if name in curated:                          # 검증된 34곳은 그대로 유지
            e = dict(curated[name]); e.setdefault("kind", "대학교")
            out.append(e); continue
        lat = col(r, "위도"); lng = col(r, "경도")
        try: lat = float(lat) if lat else None
        except: lat = None
        try: lng = float(lng) if lng else None
        except: lng = None
        code = col(r, "학교코드변환", "학교코드")
        uid = ("u" + re.sub(r"\W", "", code)) if code else ("u" + re.sub(r"\W", "", name))
        out.append({
            "univId": uid, "name": name,
            "region": region_of(col(r, "지역", "시도", "소재지")),
            "establishment": estab_of(col(r, "설립구분", "설립형태")),
            "admissionOfficeUrl": norm_url(col(r, "학교홈페이지", "홈페이지")),
            "guidelineYear": "2028학년도",
            "kind": "전문대학" if gubun == "전문대학" else "대학교",
            "lat": lat, "lng": lng,
        })

    # CSV에서 이름이 정확히 매칭되지 않은 큐레이션 학교는 누락되지 않게 보강
    emitted = {o["name"] for o in out}
    for nm, entry in curated.items():
        if nm not in emitted:
            e = dict(entry); e.setdefault("kind", "대학교")
            out.append(e)
            print(f"  [보강] CSV 미매칭 큐레이션 추가: {nm}")

    with open(os.path.join(HERE, "universities.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"universities.json: {len(out)}곳 (큐레이션 {sum(1 for o in out if o['name'] in curated)} 유지)")
    print("다음: python _gen_admissions.py  (신규 학교 일반규칙 베이스라인 행 생성)")

if __name__ == "__main__":
    main()
