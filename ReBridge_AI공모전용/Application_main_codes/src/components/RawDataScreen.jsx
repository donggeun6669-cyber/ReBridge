import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, Download, Check } from 'lucide-react';
import {
  DATASETS, GROUPS, normalize, cellText, safeStringify, typeName,
} from '../lib/rawDatasets.js';
import '../styles.rawdata.css';

// 데이터 원본 — 팀 내부용 화면.
//
// 앱이 들고 있는 데이터를 가공 없이 그대로 본다. 점수 엔진·필터·라벨을 거치지 않는다.
// UI를 새로 짤 때 "어떤 필드가 실제로 있는지"를 확인하려고 만들었다.
//
// 사용자 동선에는 링크가 없다. 주소 뒤에 #data 를 붙여야 열린다.
//   https://gumgomentor.vercel.app/#data
//
// 화면 틀(.app-frame)이 모바일 폭이라 표를 보기 어려워서, 이 화면만 틀 밖으로
// 나와 전체 화면을 쓴다(.raw-root 가 position:fixed).

const PAGE = 100; // 한 번에 그리는 행 수. 2496행짜리 데이터가 있어서 끊어 그린다.

export default function RawDataScreen({ goBack = () => {} }) {
  const [activeKey, setActiveKey] = useState(DATASETS[0].key);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [openRow, setOpenRow] = useState(null);
  const [copied, setCopied] = useState(false);

  const ds = DATASETS.find((d) => d.key === activeKey) || DATASETS[0];

  // 데이터셋을 바꿀 때마다 그 파일만 동적으로 불러온다.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setData(null);
    setQuery('');
    setLimit(PAGE);
    setOpenRow(null);
    ds.load()
      .then((v) => { if (alive) { setData(v); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e); setLoading(false); } });
    return () => { alive = false; };
  }, [ds]);

  const { kind, meta, rows, columns } = useMemo(
    () => (data !== null
      ? normalize(data, Boolean(ds.module))
      : { kind: 'rows', meta: null, rows: [], columns: [] }),
    [data, ds],
  );

  // 검색 — 행 전체를 문자열로 만들어 부분 일치로만 거른다. 값은 건드리지 않는다.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => safeStringify(r).toLowerCase().includes(q));
  }, [rows, query]);

  const shown = filtered.slice(0, limit);

  function copyAll() {
    const text = safeStringify(kind === 'exports' ? rowsToObject(rows) : rows, 2);
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  function downloadAll() {
    const text = safeStringify(kind === 'exports' ? rowsToObject(rows) : rows, 2);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ds.key}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="raw-root">
      <header className="raw-topbar">
        <button className="raw-back" aria-label="뒤로" onClick={goBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="raw-topbar-text">
          <strong>데이터 원본</strong>
          <span>가공 없이 그대로 — 팀 내부용</span>
        </div>
      </header>

      <div className="raw-body">
        {/* 왼쪽: 데이터셋 목록 */}
        <nav className="raw-side" aria-label="데이터셋 목록">
          {GROUPS.map((g) => {
            const items = DATASETS.filter((d) => d.group === g.id);
            if (!items.length) return null;
            return (
              <div className="raw-side-group" key={g.id}>
                <h2 className="raw-side-label">{g.label}</h2>
                {items.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    className={`raw-side-item${d.key === activeKey ? ' is-on' : ''}`}
                    aria-current={d.key === activeKey ? 'true' : undefined}
                    onClick={() => setActiveKey(d.key)}
                  >
                    <span className="raw-side-title">{d.title}</span>
                    <code className="raw-side-file">{d.file.replace('src/data/', '')}</code>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* 오른쪽: 고른 데이터셋 */}
        <main className="raw-main">
          <div className="raw-head">
            <h1 className="raw-title">{ds.title}</h1>
            <code className="raw-path">{ds.file}</code>
            <p className="raw-note">{ds.note}</p>
            {ds.source && <p className="raw-source">출처 · {ds.source}</p>}
            {ds.join && <p className="raw-join">🔗 {ds.join}</p>}
            {ds.warn && <p className="raw-warn">⚠️ {ds.warn}</p>}
          </div>

          {loading && <p className="raw-msg">불러오는 중…</p>}
          {error && (
            <p className="raw-msg raw-msg-err">
              불러오지 못했어요 — {String(error.message || error)}
            </p>
          )}

          {!loading && !error && (
            <>
              {meta && (
                <details className="raw-meta" open>
                  <summary>meta — 이 파일이 스스로 적어둔 출처·산출 방법</summary>
                  <pre>{safeStringify(meta, 2)}</pre>
                </details>
              )}

              <div className="raw-tools">
                <input
                  className="raw-search"
                  type="search"
                  placeholder="값으로 찾기 — 이 파일에 실제로 있는 값만 (univId, 전형 이름 …)"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
                />
                <span className="raw-count">
                  {filtered.length.toLocaleString()}
                  {filtered.length !== rows.length && ` / ${rows.length.toLocaleString()}`}
                  {kind === 'exports' ? ' 개 export' : ' 행'}
                </span>
                <button type="button" className="raw-btn" onClick={copyAll}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '복사함' : 'JSON 복사'}
                </button>
                <button type="button" className="raw-btn" onClick={downloadAll}>
                  <Download size={14} /> 내려받기
                </button>
              </div>

              {!filtered.length && <p className="raw-msg">해당하는 값이 없어요.</p>}

              {!!filtered.length && (
                <div className="raw-tablewrap">
                  <table className="raw-table">
                    <thead>
                      <tr>
                        <th className="raw-th-idx">#</th>
                        {columns.map((c) => <th key={c}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((row, i) => {
                        const open = openRow === i;
                        return [
                          <tr
                            key={`r${i}`}
                            className={open ? 'is-open' : undefined}
                            onClick={() => setOpenRow(open ? null : i)}
                          >
                            <td className="raw-td-idx">{i + 1}</td>
                            {columns.map((c) => (
                              <td key={c} title={cellText(row?.[c])}>
                                {c === '값' && kind === 'exports'
                                  ? <span className="raw-dim">{typeName(row[c])}</span>
                                  : cellText(row?.[c])}
                              </td>
                            ))}
                          </tr>,
                          open && (
                            <tr key={`d${i}`} className="raw-detail">
                              <td colSpan={columns.length + 1}>
                                <pre>{safeStringify(row, 2)}</pre>
                              </td>
                            </tr>
                          ),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {filtered.length > limit && (
                <button
                  type="button"
                  className="raw-more"
                  onClick={() => setLimit((n) => n + PAGE)}
                >
                  {PAGE}행 더 보기 · 남은 {(filtered.length - limit).toLocaleString()}행
                </button>
              )}

              <p className="raw-foot">
                줄을 누르면 그 줄의 원본 JSON이 펼쳐져요.
                이 화면은 값을 고치지 않아요 — 보기 전용입니다.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// JS 모듈은 export 이름을 살려서 내보낸다.
function rowsToObject(rows) {
  return Object.fromEntries(rows.map((r) => [r.이름, r.값]));
}
