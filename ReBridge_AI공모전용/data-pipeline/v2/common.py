"""공통 유틸 — 정규화·대학 매칭·경로.

v2 파이프라인의 모든 스크립트가 여기를 거친다.
특히 NFC 정규화는 반드시 통과시켜야 한다(아래 참고).

## macOS NFD 함정 (2026-09-02 실측)
맥에서 만든 파일명의 한글은 자모가 분리된 NFD로 저장된다.
JSON 안의 한글은 NFC다. 정규화 없이 비교하면 눈에는 같아 보여도 전부 불일치한다.
  실측: 2028 시행계획 PDF 213개 ↔ universities.json 351개
        정규화 전 일치 0건 → 정규화 후 189건
파일명에서 뽑은 문자열은 예외 없이 nfc()를 통과시킨다.
"""

import json
import re
import sqlite3
import unicodedata
from pathlib import Path

# ── 경로 ────────────────────────────────────────────────────────────
V2 = Path(__file__).resolve().parent
PIPELINE = V2.parent
ROOT = PIPELINE.parent                      # ReBridge_AI공모전용/
APP_DATA = ROOT / "Application_main_codes" / "src" / "data"
PDF_ROOT = APP_DATA / "pdf_sources"
OUT = V2 / "out"                            # 파이프라인 산출물(앱에 안 들어감)
DB_PATH = OUT / "rebridge.db"               # L1 작업대

OUT.mkdir(exist_ok=True)


# ── 정규화 ──────────────────────────────────────────────────────────
def nfc(s):
    """한글 NFC 정규화. None/숫자도 안전하게 문자열로."""
    return unicodedata.normalize("NFC", str(s or ""))


def squash(s):
    """공백 압축 + 앞뒤 제거."""
    return re.sub(r"\s+", " ", nfc(s)).strip()


def key_name(s):
    """대학명 비교용 키 — 대괄호 제거, 공백·구두점 제거, NFC.

    ⚠️ 소괄호는 **지우지 않는다.**
    '건국대학교(글로컬)'과 '건국대학교'는 다른 학교이고,
    괄호를 지우면 둘이 같은 키가 되어 서로를 무효화한다(2026-09-02 실측: 17개 매칭 실패).

    '가톨릭관동대학교[강원][본교]' → '가톨릭관동대학교'
    '건국대학교(글로컬)[충북][분교]' → '건국대학교(글로컬)'
    """
    s = nfc(s)
    s = re.sub(r"\[[^\]]*\]", "", s)                     # 대괄호(지역·캠퍼스 태그)만 제거
    s = re.sub(r"[\s·・.,'\"’”_-]", "", s)
    return s


def bare_name(s):
    """소괄호까지 뗀 느슨한 키. 1차 매칭이 실패했을 때만 쓴다."""
    return re.sub(r"[\(（][^\)）]*[\)）]", "", key_name(s))


# 대학명 표기 흔들림을 흡수하기 위한 변형 생성 규칙
_VARIANT_STRIPS = [
    (r"^국립", ""),          # 국립순천대학교 ↔ 순천대학교
    (r"^공립", ""),
    (r"^사립", ""),
    (r"대학교$", "대학"),      # 산업대학교 ↔ 산업대학
    (r"대학$", "대학교"),
]


def name_variants(name):
    """한 대학명에서 매칭 후보 키들을 만든다."""
    base = key_name(name)
    out = {base}
    for pat, rep in _VARIANT_STRIPS:
        v = re.sub(pat, rep, base)
        if v:
            out.add(v)
    # 국립+대학교 동시 제거형
    v = re.sub(r"^국립", "", base)
    v = re.sub(r"대학교$", "대학", v)
    if v:
        out.add(v)
    return {v for v in out if len(v) >= 2}


# ── 대학 마스터 / 매칭기 ────────────────────────────────────────────
def load_universities():
    with open(APP_DATA / "universities.json", encoding="utf-8") as f:
        return json.load(f)


class UnivMatcher:
    """대학명 문자열 → univId.

    같은 이름이 여러 캠퍼스로 나뉜 대학이 많아서(국립창원대 3곳, 가야대 2곳 …)
    단계를 나눠 매칭한다. 앞 단계에서 확정되면 뒤는 보지 않는다.

      1) 정확한 이름              '건국대학교(글로컬)' → 그 학교
      2) 정확한 이름 + 지역 힌트   같은 이름이 여럿일 때 [충북] 같은 태그로 가른다
      3) 괄호 뗀 느슨한 이름       유일할 때만
      4) 느슨한 이름 + 지역        '가야대학교'+[경남] → 가야대학교(김해)

    사용:
        m = UnivMatcher()
        m.match("가톨릭관동대학교[강원][본교]")            -> 'uA0000072'
        m.match("가야대학교", region="경남")               -> 'uA0002748'
        m.unmatched                                       -> 실패한 이름 Counter
    """

    def __init__(self, universities=None):
        from collections import Counter, defaultdict
        self.univs = universities or load_universities()
        self.by_id = {u["univId"]: u for u in self.univs}

        self.exact = defaultdict(list)      # 정확한 키 -> [univId…]
        self.loose = defaultdict(list)      # 괄호 뗀 키 -> [univId…]
        for u in self.univs:
            self.exact[key_name(u["name"])].append(u["univId"])
            for v in name_variants(u["name"]):
                self.loose[v].append(u["univId"])
            self.loose[bare_name(u["name"])].append(u["univId"])

        self.unmatched = Counter()
        self.hits = Counter()

    def _region_pick(self, ids, region):
        if not region:
            return None
        cand = [i for i in ids if (self.by_id[i].get("region") or "") == region]
        return cand[0] if len(cand) == 1 else None

    def match(self, raw, region=None):
        """대학명(파일명·PDF 본문·엑셀 셀 무엇이든) → univId 또는 None."""
        if not raw:
            return None
        if raw in self.by_id:            # 이미 univId면 그대로
            return raw

        k = key_name(raw)
        for table, key in ((self.exact, k), (self.loose, bare_name(raw))):
            ids = list(dict.fromkeys(table.get(key, [])))
            if len(ids) == 1:
                self.hits[ids[0]] += 1
                return ids[0]
            if len(ids) > 1:
                pick = self._region_pick(ids, region)
                if pick:
                    self.hits[pick] += 1
                    return pick
                # 같은 이름이 여럿이고 지역으로도 못 가르면 '본교'로 본다.
                # 캠퍼스명이 붙지 않은 항목이 본교다.
                plain = [i for i in ids if "(" not in self.by_id[i]["name"]]
                if len(plain) == 1:
                    self.hits[plain[0]] += 1
                    return plain[0]

        self.unmatched[squash(raw)] += 1
        return None

    def name_of(self, univ_id):
        u = self.by_id.get(univ_id)
        return u["name"] if u else None


def univ_from_filename(fname):
    """'가톨릭관동대학교[강원][본교]_2028_시행계획(1차수).pdf' → '가톨릭관동대학교'

    대괄호·언더바 앞부분을 대학명으로 본다. NFC 정규화 포함.
    소괄호는 학교 이름의 일부일 수 있어 남긴다('건국대학교(글로컬)').
    """
    stem = nfc(Path(fname).stem)
    m = re.match(r"([^\[\]_]+)", stem)
    return squash(m.group(1)) if m else ""


def parse_plan_filename(fname):
    """시행계획 PDF 파일명을 쪼갠다.

    '건국대학교(글로컬)[충북][분교]_2028_시행계획(1차수).pdf'
      → {'name': '건국대학교(글로컬)', 'region': '충북', 'campus': '분교', 'year': 2028}

    대괄호 태그가 없는 파일명이면 region/campus는 None이 된다.
    """
    stem = nfc(Path(fname).stem)
    tags = re.findall(r"\[([^\]]+)\]", stem)
    return {
        "name": univ_from_filename(fname),
        "region": squash(tags[0]) if len(tags) >= 1 else None,
        "campus": squash(tags[1]) if len(tags) >= 2 else None,
        "year": parse_year(re.sub(r"^[^_]*", "", stem)),   # 이름 뒤쪽에서만 연도를 찾는다
    }


# ── 학년도 ──────────────────────────────────────────────────────────
def parse_year(s):
    """'2028학년도', '2028', 2028 → 2028 (없으면 None)"""
    m = re.search(r"(20\d{2})", nfc(s))
    return int(m.group(1)) if m else None


# 내신 등급 체계가 바뀌는 경계.
# 2028학년도 입학전형부터 고교 내신이 5등급 상대평가로 바뀐다.
# → 2027 이하(9등급)와 2028 이상(5등급)의 합격선은 직접 비교하면 안 된다.
GRADE_SCALE_SPLIT_YEAR = 2028


def grade_scale(year):
    """해당 학년도의 내신 등급 체계. '9' 또는 '5'."""
    if year is None:
        return None
    return "5" if year >= GRADE_SCALE_SPLIT_YEAR else "9"


# ── 전형 구분 정규화 ────────────────────────────────────────────────
ADMISSION_TYPES = ["학생부교과", "학생부종합", "논술", "실기", "수능위주", "일반(서류)"]

_TYPE_ALIASES = {
    "교과": "학생부교과", "학생부교과전형": "학생부교과", "학생부(교과)": "학생부교과",
    "종합": "학생부종합", "학생부종합전형": "학생부종합", "학생부(종합)": "학생부종합",
    "학생부위주(교과)": "학생부교과", "학생부위주(종합)": "학생부종합",
    "논술위주": "논술", "논술전형": "논술",
    "실기위주": "실기", "실기/실적": "실기", "실기전형": "실기",
    "수능": "수능위주", "수능위주전형": "수능위주", "정시수능": "수능위주",
}


def norm_admission_type(s):
    s = squash(s)
    if not s:
        return None
    if s in ADMISSION_TYPES:
        return s
    k = re.sub(r"\s", "", s)
    if k in _TYPE_ALIASES:
        return _TYPE_ALIASES[k]
    for t in ADMISSION_TYPES:
        if t in k:
            return t
    return None


def norm_phase(s):
    s = squash(s)
    if "수시" in s:
        return "수시"
    if "정시" in s:
        return "정시"
    return None


# ── DB ──────────────────────────────────────────────────────────────
def connect(path=DB_PATH):
    con = sqlite3.connect(path)
    con.execute("PRAGMA busy_timeout = 30000")
    con.execute("PRAGMA foreign_keys = ON")
    con.row_factory = sqlite3.Row
    return con


def init_db(path=DB_PATH, drop=False):
    """schema.sql을 적용한 커넥션을 돌려준다."""
    if drop and Path(path).exists():
        Path(path).unlink()
    con = connect(path)
    con.executescript((V2 / "schema.sql").read_text(encoding="utf-8"))
    return con


# ── 파일 지문 ───────────────────────────────────────────────────────
def sha256(path, _chunk=1 << 20):
    """원본 파일 지문. 같은 PDF를 두 번 넣지 않기 위해."""
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while (b := f.read(_chunk)):
            h.update(b)
    return h.hexdigest()


def jdump(obj, path):
    """앱이 읽을 JSON — 한글 그대로, 줄바꿈 없이 작게."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return Path(path).stat().st_size


def jload(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)
