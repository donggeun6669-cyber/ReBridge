"""parse_v3 공통 — 경로·DB·ID 규칙.

RAW·manifest·앱 데이터는 읽기만 한다. 쓰는 곳은 parse_v3/work/ 아래뿐이다.
"""

import os
import datetime as dt
import hashlib
import json
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
PIPELINE = HERE.parent
ROOT = PIPELINE.parent                                   # ReBridge_AI공모전용/
# 원문 폴더. 평소에는 저장소의 RAW/ 이고, 회귀검사처럼 **가짜 원문으로 시험해야 할 때만**
# 환경변수 PARSE_V3_RAW 로 임시 폴더를 가리킨다(아래 WORK 과 같은 장치).
RAW = Path(os.environ["PARSE_V3_RAW"]) if os.environ.get("PARSE_V3_RAW") else ROOT / "RAW"
APP_DATA = ROOT / "Application_main_codes" / "src" / "data"
# 작업 폴더. 평소에는 이 폴더의 work/ 이고, 회귀검사처럼 정본을 건드리면 안 될 때만
# 환경변수 PARSE_V3_WORK 로 임시 폴더를 가리킨다. 정본 경로를 코드에서 바꾸지 않기 위한 장치다.
WORK = Path(os.environ["PARSE_V3_WORK"]) if os.environ.get("PARSE_V3_WORK") else HERE / "work"
DB_PATH = WORK / "parse_v3.sqlite"                       # 정본
TEXT_DB_PATH = WORK / "text_cache.sqlite"                # 쪽별 원문 텍스트 캐시(정본 아님, 재생성 가능)
AGENT_DIR = WORK / "agent_out"                           # 에이전트 임시 출력(정본 아님)
EXPORT_DIR = HERE / "exports"
REPORT_DIR = HERE / "reports"

PARSER_VERSION = "v3.0"

sys.path.insert(0, str(PIPELINE / "raw"))
import rawlib  # noqa: E402  (targets·load_manifest 읽기 전용 사용)


def nfc(s):
    return unicodedata.normalize("NFC", str(s or ""))


def now():
    return dt.datetime.now().isoformat(timespec="seconds")


def h(*parts, n=16):
    """결정적 ID 해시. 같은 입력이면 항상 같은 ID."""
    s = "\x1f".join(nfc(p) for p in parts)
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:n]


def doc_id(sha256):
    return "doc:" + sha256[:16]


def connect(path=DB_PATH):
    WORK.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=120)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout=120000")   # 여러 작업(OCR·파서)이 같은 DB를 쓸 때 잠금 대기
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def init_db():
    con = connect()
    con.executescript((HERE / "schema.sql").read_text(encoding="utf-8"))
    con.commit()
    return con


def text_db():
    con = connect(TEXT_DB_PATH)
    con.execute("""CREATE TABLE IF NOT EXISTS page_text (
        document_id TEXT NOT NULL, page_index INTEGER NOT NULL,
        text TEXT, char_count INTEGER, image_count INTEGER, method TEXT,
        PRIMARY KEY (document_id, page_index))""")
    con.commit()
    return con


def log(con, document_id, stage, status, detail=""):
    con.execute("INSERT OR REPLACE INTO processing_log VALUES (?,?,?,?,?,?)",
                (document_id, stage, PARSER_VERSION, status, detail[:2000], now()))


YEAR_RE = re.compile(r"(20[2-3]\d)\s*학년도")


def detect_years(text):
    return sorted({int(m) for m in YEAR_RE.findall(text or "")})


def jdump(x):
    return json.dumps(x, ensure_ascii=False)
